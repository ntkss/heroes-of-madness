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
  title: "HEROES OF MADNESS - MLBB Random Team Arena",
  description: "Street Fighter styled Random Team Generator for Mobile Legends: Bang Bang, featuring dynamic synthesizers, slot rolling, and database history.",
};

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
