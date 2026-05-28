// AI provider configuration — all costs stored as strings for Decimal.js parsing

export const AI_CONSTANTS = {
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",

  // Provider base URLs — hardcoded, never user-controlled (SSRF guard)
  geminiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  openaiBaseUrl: "https://api.openai.com/v1",
  deepseekBaseUrl: "https://api.deepseek.com/v1",

  costRates: {
    gemini: {
      inputPer1k: process.env.GEMINI_FLASH_COST_PER_1K_INPUT_TOKENS ?? "0.000075",
      outputPer1k: process.env.GEMINI_FLASH_COST_PER_1K_OUTPUT_TOKENS ?? "0.0003",
    },
    gpt4o: {
      inputPer1k: process.env.OPENAI_GPT4O_COST_PER_1K_INPUT_TOKENS ?? "0.005",
      outputPer1k: process.env.OPENAI_GPT4O_COST_PER_1K_OUTPUT_TOKENS ?? "0.015",
    },
    deepseek: {
      inputPer1k: process.env.DEEPSEEK_COST_PER_1K_INPUT_TOKENS ?? "0.00014",
      outputPer1k: process.env.DEEPSEEK_COST_PER_1K_OUTPUT_TOKENS ?? "0.00028",
    },
  },
} as const;

// SSRF guard: only these provider hostnames are allowed for outbound AI calls
export const ALLOWED_AI_DOMAINS = [
  "generativelanguage.googleapis.com",
  "api.openai.com",
  "api.deepseek.com",
] as const;

export function isAllowedAiUrl(url: string): boolean {
  try {
    return (ALLOWED_AI_DOMAINS as readonly string[]).includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Confidence score thresholds for TFLite output → ConfidenceBand mapping
export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  moderate: 0.65,
} as const;
