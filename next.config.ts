import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "playwright", "playwright-core"],
};

export default nextConfig;
