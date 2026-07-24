import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "udebjfrhnwqoawziuhgu.supabase.co", // Supabase storage domain
      "tower-exchange.vercel.app", // Production domain
      "localhost",
      "127.0.0.1",
    ],
  },
};

export default nextConfig;
