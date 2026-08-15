/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["node-edge-tts", "ws"],
  },
};

export default nextConfig;
