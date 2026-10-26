import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Permit 25 MiB animated evidence plus multipart headers through proxy.
    proxyClientMaxBodySize: "26mb",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
