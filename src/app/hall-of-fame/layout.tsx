import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "👑 Hall of Fame",
  description:
    "Sanctuary of Legendary Season Champions in Heroes of Madness MLBB Arena. View past season winners grouped by year.",
  openGraph: {
    title: "👑 Hall of Fame - Heroes of Madness",
    description:
      "Sanctuary of Legendary Season Champions in Heroes of Madness MLBB Arena.",
  },
};

export default function HallOfFameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
