import type { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const rawSlug = resolvedParams.slug || "Thread";
  const cleanTitle = decodeURIComponent(rawSlug).replace(/-/g, " ");
  const capitalized = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  return {
    title: `💬 ${capitalized}`,
    description: `Read and join the discussion on "${capitalized}" in Heroes of Madness community forums.`,
    openGraph: {
      title: `💬 ${capitalized} - Heroes of Madness Forums`,
      description: `Read and join the discussion on "${capitalized}" in Heroes of Madness community forums.`,
    },
  };
}

export default function ForumPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
