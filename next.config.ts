import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'ioredis',
    'redis',
    '@opentelemetry/instrumentation-ioredis',
    '@opentelemetry/instrumentation-redis',
  ],
};

export default nextConfig;
