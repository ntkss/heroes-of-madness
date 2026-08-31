import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "💬 Community Forums",
  description:
    "Discuss MLBB matches, strategy, player callouts, match debates, and community announcements in Heroes of Madness.",
  openGraph: {
    title: "💬 Community Forums - Heroes of Madness",
    description:
      "Discuss MLBB matches, strategy, player callouts, and community announcements in Heroes of Madness.",
  },
};

export default function ForumsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
