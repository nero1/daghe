import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import path from "path";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "connect-src 'self' https: https://generativelanguage.googleapis.com https://api.openai.com https://api.deepseek.com",
    ].join("; ")
  }
];

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
  // Workspace packages ship TypeScript source — Next.js must transpile them.
  transpilePackages: ["@daghe/cervical-via", "@daghe/shared"],
  webpack(config, { webpack }) {
    // @tensorflow/tfjs-tflite@0.0.1-alpha.10 dist files reference tflite_web_api_client
    // as a relative require, but the file is not in the npm package (it's a browser CDN
    // module). Replace every occurrence with a stub so webpack can resolve the graph.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /tflite_web_api_client/,
        path.resolve(__dirname, "lib/ai/stubs/tflite-web-api-stub.js")
      )
    );
    return config;
  },
  async headers() {
    return [
      // sw.js must never be cached — browser must re-fetch it on every load
      // so it detects new deployments within seconds, not up to 24 hours.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-store, no-cache" }],
      },
      { source: "/:path*", headers: securityHeaders },
    ];
  }
};

export default withBundleAnalyzer(nextConfig);
