import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "🏆 Seasons Archive",
  description:
    "Historical Season Standings, Podium Finishers, and Archived Match Records in Heroes of Madness MLBB Arena.",
  openGraph: {
    title: "🏆 Seasons Archive - Heroes of Madness",
    description:
      "Historical Season Standings and Podium Finishers in Heroes of Madness.",
  },
};

export default function SeasonsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
