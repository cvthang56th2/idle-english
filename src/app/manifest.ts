import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/coach",
    name: "IdleEnglish",
    short_name: "IdleEnglish",
    description:
      "Swipe-style micro English lessons for builders waiting on AI and deploys.",
    start_url: "/coach",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0f0c",
    theme_color: "#22c55e",
    lang: "en",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
