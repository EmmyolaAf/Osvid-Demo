import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 90, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
      },
      {
        protocol: "https",
        hostname: "oc0zbmw1i8.ufs.sh",
      },
      {
        protocol: "https",
        hostname: "mighty.tools",
      },
      {
        protocol: "https",
        hostname: "fakeimg.pl",
      },
      {
        protocol: "https",
        hostname: "themazine.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
    ],
  },
};

export default nextConfig;

