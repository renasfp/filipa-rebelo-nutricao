import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// A barra de comentários da Vercel só existe nos deploys de pré-visualização.
const vercelLive = process.env.VERCEL_ENV === "preview" ? " https://vercel.live" : "";

// CSP sem nonces (ver node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
// os nonces obrigariam a gerar todas as páginas a cada pedido, incluindo a página inicial estática.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${vercelLive}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data:${vercelLive}${vercelLive && " https://vercel.com"}`,
  "font-src 'self'",
  `connect-src 'self'${vercelLive}${vercelLive && " wss://ws-us3.pusher.com"}`,
  `frame-src${vercelLive || " 'none'"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
