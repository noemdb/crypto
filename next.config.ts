import type { NextConfig } from "next";

const allowedServerActionOrigins = [
  process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, ""),
  "localhost:3000",
  "127.0.0.1:3000",
  "localhost:3001",
  "127.0.0.1:3001",
  "*.githubpreview.dev",
  "*.preview.app.github.dev",
].filter((value): value is string => Boolean(value));

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "playwright", "playwright-core"],
  experimental: {
    serverActions: {
      allowedOrigins: allowedServerActionOrigins,
    },
  },
};

export default nextConfig;
