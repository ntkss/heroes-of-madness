import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const rawId = resolvedParams.id || "Fighter";
  const name = decodeURIComponent(rawId);
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    title: `⚔️ ${capitalized} - Fighter Profile`,
    description: `Detailed match statistics, win rates, lane performance, and battle dossier for ${capitalized} in Heroes of Madness.`,
    openGraph: {
      title: `⚔️ ${capitalized} - Fighter Profile - Heroes of Madness`,
      description: `Battle statistics and dossier for ${capitalized} in Heroes of Madness MLBB Arena.`,
    },
  };
}

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
