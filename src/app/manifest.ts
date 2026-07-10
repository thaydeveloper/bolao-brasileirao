import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bolão Brasileirão",
    short_name: "Bolão",
    description: "Bolão do Campeonato Brasileiro entre amigos",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#15803d",
    orientation: "portrait",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
