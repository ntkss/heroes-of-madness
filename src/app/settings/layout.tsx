import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "⚙️ System Settings & Ranks",
  description:
    "Configure rank winrate thresholds, tier definitions, season controls, player roster, and administrator tools.",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
