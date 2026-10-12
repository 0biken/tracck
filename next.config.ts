import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @tracck/core ships TypeScript source and is shared with the API and worker.
  transpilePackages: ["@tracck/core"],
  // Pin the workspace root so a lockfile in a parent folder is never picked up.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
