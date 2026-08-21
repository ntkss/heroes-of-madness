import { fetchPostBySlug } from "@/utils/firebase";
import type { Metadata } from "next";
import ForumPostDetailClient from "./ForumPostDetailClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const post = await fetchPostBySlug(resolvedParams.slug);

  if (!post) {
    return {
      title: "Thread Not Found | Heroes of Madness Forums",
    };
  }

  // Strip mentions placeholders or markdown if any
  const cleanDescription = post.description
    .replace(/@player:([\w\d_-]+)/g, "@$1")
    .replace(/@match:([\w\d_-]+)/g, "Match #$1");

  const shortDesc =
    cleanDescription.substring(0, 150) +
    (cleanDescription.length > 150 ? "..." : "");

  // Only use imageUrl if it is present and not a base64 data URL (scrapers cannot render inline base64)
  const ogImageUrl =
    post.imageUrl && !post.imageUrl.startsWith("data:")
      ? post.imageUrl
      : undefined;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  return {
    metadataBase: new URL(siteUrl),
    title: `${post.title} | Heroes of Madness Forums`,
    description: shortDesc,
    openGraph: {
      title: post.title,
      description: shortDesc,
      type: "article",
      images: ogImageUrl
        ? [
            {
              url: ogImageUrl,
              width: 800,
              height: 600,
              alt: post.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: shortDesc,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
  };
}

export default async function Page({ params }: PageProps) {
  return <ForumPostDetailClient params={params} />;
}
