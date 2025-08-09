import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.pixabay.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/telegram-webhook/:secret",
        destination: "/api/telegram?secret=:secret",
      },
    ];
  },
};

export default nextConfig;
