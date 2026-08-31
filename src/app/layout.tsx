import type { Metadata } from "next";
import { Teko, Press_Start_2P, Orbitron, Pattaya } from "next/font/google";
import "./globals.css";

const teko = Teko({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-teko",
});

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-orbitron",
});

const pattaya = Pattaya({
  subsets: ["thai", "latin"],
  weight: "400",
  variable: "--font-pattaya",
});

export const metadata: Metadata = {
  title: {
    default: "HEROES OF MADNESS - MLBB Random Team Arena",
    template: "%s | HEROES OF MADNESS",
  },
  description:
    "Arcade-styled MLBB Random Team Generator, Season Standings, Player Dossiers, Hall of Fame, and Community Forums.",
  keywords: [
    "MLBB",
    "Mobile Legends",
    "Random Team Generator",
    "Heroes of Madness",
    "Hall of Fame",
    "Esports",
  ],
  openGraph: {
    title: "HEROES OF MADNESS - MLBB Random Team Arena",
    description:
      "Arcade-styled MLBB Random Team Generator, Season Standings, Player Dossiers, Hall of Fame, and Community Forums.",
    type: "website",
  },
};

import { AuthProvider } from "@/utils/AuthContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${teko.variable} ${pressStart.variable} ${orbitron.variable} ${pattaya.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
