/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // A foto de perfil vai no corpo do Server Action como data URL (imagem
    // redimensionada). 2 MB dá margem folgada para o avatar comprimido.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
