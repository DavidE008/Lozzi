import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@lozzi/domain", "@lozzi/ui"],
  poweredByHeader: false,
  turbopack: {
    root: path.join(import.meta.dirname, "../.."),
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
