import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Die Batzi's are a static app in public/batzis; its relative links need the real file URL.
  async redirects() {
    return [{ source: "/batzis", destination: "/batzis/index.html", permanent: false }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
