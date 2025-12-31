/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: [
      "img.clerk.com",
      "images.clerk.dev",
      "localhost",
      // Add your backend domain here
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/socket/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/socket/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
