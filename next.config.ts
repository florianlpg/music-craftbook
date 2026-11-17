import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
