import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: "#050508",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Heroes of Madness",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    title: "HEROES OF MADNESS - MLBB Random Team Arena",
    description:
      "Arcade-styled MLBB Random Team Generator, Season Standings, Player Dossiers, Hall of Fame, and Community Forums.",
    type: "website",
  },
};

import { AuthProvider } from "@/utils/AuthContext";
import GlassNavbar from "@/components/GlassNavbar";

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
        <AuthProvider>
          <div className="min-h-full flex flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom,0px)*0.35)] md:pb-20">
            {children}
            <GlassNavbar />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
