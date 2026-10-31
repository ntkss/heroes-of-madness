import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HEROES OF MADNESS - MLBB Random Team Arena",
    short_name: "Heroes of Madness",
    description:
      "Arcade-styled MLBB Random Team Generator, Season Standings, Player Dossiers, Hall of Fame, and Community Forums.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#050508",
    theme_color: "#050508",
    orientation: "portrait",
    categories: ["games", "entertainment", "sports"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "สุ่มทีม (Arena)",
        short_name: "Arena",
        description: "เข้าสู่สังเวียนสุ่มทีมรบ",
        url: "/",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "ตารางคะแนน (Seasons)",
        short_name: "Seasons",
        description: "ดูตารางคะแนนและอันดับประจำซีซั่น",
        url: "/seasons",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "หอเกียรติยศ (Hall of Fame)",
        short_name: "Hall of Fame",
        description: "ทำเนียบแชมป์และสถิติไร้พ่าย",
        url: "/hall-of-fame",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
