import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs"],
  transpilePackages: ["@react-email/components"],
};

export default nextConfig;
