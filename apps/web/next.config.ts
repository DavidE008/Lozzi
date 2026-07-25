import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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
