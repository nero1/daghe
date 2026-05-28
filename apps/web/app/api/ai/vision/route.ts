import { NextRequest } from "next/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { requireAuthenticatedUser, getBearerToken } from "@/lib/server/auth";
import { ok, fail, requestIdFrom } from "@/lib/server/api-response";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { AI_CONSTANTS, isAllowedAiUrl } from "@/lib/ai/constants";
import { decryptKey } from "@/lib/server/byok";

const bodySchema = z.object({
  imageBase64: z.string().min(100).max(5_000_000),
  moduleId: z.string().min(1).max(64),
  encounterId: z.string().uuid(),
  patientAgeBand: z.string().min(1).max(20),
  screeningContext: z.enum(["routine", "referral", "hpv-positive-triage"]),
  byokProvider: z.enum(["gemini", "openai", "deepseek"]).optional(),
});

type ByokRow = {
  encrypted_key_iv: string;
  encrypted_key_ciphertext: string;
  encrypted_key_tag: string;
};

async function fetchByokKey(userId: string, provider: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const endpoint = new URL(`${url}/rest/v1/user_api_keys`);
    endpoint.searchParams.set("select", "encrypted_key_iv,encrypted_key_ciphertext,encrypted_key_tag");
    endpoint.searchParams.set("user_id", `eq.${userId}`);
    endpoint.searchParams.set("provider", `eq.${provider}`);
    endpoint.searchParams.set("limit", "1");
    const res = await fetch(endpoint.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as ByokRow[];
    const row = rows[0];
    if (!row) return null;
    return decryptKey({
      iv: row.encrypted_key_iv,
      ciphertext: row.encrypted_key_ciphertext,
      tag: row.encrypted_key_tag,
    });
  } catch {
    return null;
  }
}

function buildSystemPrompt(): string {
  return [
    "You are an AI assistant supporting trained healthcare workers in a cervical cancer VIA screening programme.",
    "Analyse the provided colposcopy or VIA image and respond with a JSON object:",
    '{ "classification": "POSITIVE"|"NEGATIVE"|"REFER", "confidenceBand": "HIGH"|"MODERATE"|"LOW", "confidenceScore": 0.0-1.0, "confidenceSentence": "...", "recommendedAction": "..." }',
    "CRITICAL SAFETY RULES:",
    "1. If you are uncertain at all, set confidenceBand to LOW or MODERATE and classification to REFER.",
    "2. Never fabricate clinical certainty. A low-confidence REFER is always safer than a high-confidence misclassification.",
    "3. Respond ONLY with the JSON object. No other text.",
  ].join("\n");
}

function buildUserPrompt(patientAgeBand: string, screeningContext: string): string {
  return [
    "---USER_CONTEXT_START---",
    `Patient age band: ${patientAgeBand}`,
    `Screening context: ${screeningContext}`,
    "Please analyse the attached VIA image.",
    "---USER_CONTEXT_END---",
  ].join("\n");
}

async function callGemini(
  imageBase64: string,
  patientAgeBand: string,
  screeningContext: string,
  apiKey: string
): Promise<{ result: Record<string, unknown>; inputTokens: number; outputTokens: number }> {
  const url = `${AI_CONSTANTS.geminiBaseUrl}/models/${AI_CONSTANTS.geminiModel}:generateContent?key=${apiKey}`;
  if (!isAllowedAiUrl(url)) throw new Error("SSRF guard: blocked URL");

  const body = {
    contents: [{
      parts: [
        { text: buildSystemPrompt() + "\n\n" + buildUserPrompt(patientAgeBand, screeningContext) },
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
      ],
    }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;

  return { result: JSON.parse(text) as Record<string, unknown>, inputTokens, outputTokens };
}

async function callOpenAI(
  imageBase64: string,
  patientAgeBand: string,
  screeningContext: string,
  apiKey: string
): Promise<{ result: Record<string, unknown>; inputTokens: number; outputTokens: number }> {
  const url = `${AI_CONSTANTS.openaiBaseUrl}/chat/completions`;
  if (!isAllowedAiUrl(url)) throw new Error("SSRF guard: blocked URL");

  const body = {
    model: AI_CONSTANTS.openaiModel,
    response_format: { type: "json_object" },
    temperature: 0.1,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: [
          { type: "text", text: buildUserPrompt(patientAgeBand, screeningContext) },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = json.choices?.[0]?.message?.content ?? "{}";
  const inputTokens = json.usage?.prompt_tokens ?? 0;
  const outputTokens = json.usage?.completion_tokens ?? 0;

  return { result: JSON.parse(text) as Record<string, unknown>, inputTokens, outputTokens };
}

function calcCost(provider: "gemini" | "gpt4o" | "deepseek", inputTokens: number, outputTokens: number): string {
  const rates = AI_CONSTANTS.costRates[provider];
  const inputCost = new Decimal(rates.inputPer1k).mul(inputTokens).div(1000);
  const outputCost = new Decimal(rates.outputPer1k).mul(outputTokens).div(1000);
  return inputCost.plus(outputCost).toFixed(8);
}

async function logAiUsage(
  userId: string,
  encounterId: string,
  provider: string,
  keyType: "platform" | "byok",
  inputTokens: number,
  outputTokens: number,
  estimatedCostUsd: string
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/ai_usage_log`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        encounter_id: encounterId,
        provider,
        task_type: "via_classification",
        key_type: keyType,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: estimatedCostUsd,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Non-fatal: logging failure must not block the clinical result
  }
}

export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request);

  const user = await requireAuthenticatedUser(request.headers.get("authorization"));
  if (!user) return fail(401, "unauthorized", "Authentication required", requestId);

  const rl = await checkRateLimit(`ai_vision:${user.id}`, 20, 60_000);
  if (!rl.ok) {
    return fail(429, "rate_limited", "Too many AI requests", requestId);
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return fail(400, "invalid_body", "Request body validation failed", requestId);
  }

  const { imageBase64, encounterId, patientAgeBand, screeningContext } = body;

  // Attempt Gemini first, fall back to OpenAI
  let provider: "gemini" | "gpt4o" = "gemini";
  let result: Record<string, unknown> | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let keyType: "platform" | "byok" = "platform";

  // Check for BYOK key
  const byokProvider = body.byokProvider ?? "gemini";
  const byokKey = await fetchByokKey(user.id, byokProvider);
  const geminiKey = byokKey && byokProvider === "gemini" ? byokKey : (process.env.GEMINI_API_KEY ?? "");
  if (byokKey) keyType = "byok";

  if (process.env.GEMINI_ENABLED === "true" && geminiKey) {
    try {
      const res = await callGemini(imageBase64, patientAgeBand, screeningContext, geminiKey);
      result = res.result;
      inputTokens = res.inputTokens;
      outputTokens = res.outputTokens;
      provider = "gemini";
    } catch {
      result = null;
    }
  }

  if (!result && process.env.OPENAI_ENABLED === "true") {
    const openaiByokKey = byokProvider === "openai" ? byokKey : null;
    const openaiKey = openaiByokKey ?? (process.env.OPENAI_API_KEY ?? "");
    if (openaiKey) {
      try {
        const res = await callOpenAI(imageBase64, patientAgeBand, screeningContext, openaiKey);
        result = res.result;
        inputTokens = res.inputTokens;
        outputTokens = res.outputTokens;
        provider = "gpt4o";
        if (openaiByokKey) keyType = "byok";
      } catch {
        result = null;
      }
    }
  }

  if (!result) {
    return fail(503, "ai_unavailable", "All AI providers unavailable", requestId);
  }

  const costMap: Record<string, "gemini" | "gpt4o" | "deepseek"> = { gemini: "gemini", gpt4o: "gpt4o" };
  const costProvider = costMap[provider] ?? "gemini";
  const estimatedCostUsd = calcCost(costProvider, inputTokens, outputTokens);

  await logAiUsage(user.id, encounterId, provider, keyType, inputTokens, outputTokens, estimatedCostUsd);

  // Never include imageBase64 in response
  return ok({
    classification: result["classification"],
    confidenceBand: result["confidenceBand"],
    confidenceScore: result["confidenceScore"],
    confidenceSentence: result["confidenceSentence"],
    recommendedAction: result["recommendedAction"],
    inferenceMethod: provider === "gemini" ? "gemini" : "gpt4o",
    estimatedCostUsd,
    provider,
  }, requestId);
}
