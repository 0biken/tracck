import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @tracck/shared ships TypeScript source and is shared with the backend and workers.
  transpilePackages: ["@tracck/shared"],
  // The root is the repository, not this folder, so the linked ../shared package is
  // inside it. Pinning it also stops a lockfile in a parent folder being picked up.
  turbopack: { root: path.resolve(__dirname, "..") },
};

export default nextConfig;
