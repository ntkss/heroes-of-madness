import React from "react";
import Link from "next/link";
import { ForumPost, extractYouTubeId } from "@/utils/firebase";
import { playBeep } from "@/utils/audio";
import styles from "./styles.module.css";

interface PostCardProps {
  post: ForumPost;
}

export default function PostCard({ post }: PostCardProps) {
  const hasVideo = Boolean(
    extractYouTubeId(post.youtubeUrl) || extractYouTubeId(post.description),
  );

  return (
    <Link
      href={`/forums/${post.slug}`}
      onClick={() => playBeep(520, 0.1, "sine")}
      className={`${styles.postCard} ${post.type === "news" ? styles.postCardNews : ""}`}
    >
      {post.imageUrl && (
        <div className={styles.postCardThumb}>
          <img
            src={post.imageUrl}
            className={styles.thumbImg}
            alt="post thumb"
          />
        </div>
      )}
      <div className={styles.postCardContent}>
        <h2 className={styles.postTitle}>{post.title}</h2>
        <p className={styles.postExcerpt}>
          {post.description.length > 180
            ? post.description.substring(0, 180) + "..."
            : post.description}
        </p>

        {/* Meta information row */}
        <div className={styles.postMeta}>
          <span
            className={`${styles.badgeType} ${post.type === "news" ? styles.badgeTypeNews : ""}`}
          >
            {post.type}
          </span>

          {hasVideo && (
            <span className="bg-red-900/80 border border-red-500 text-white font-pixel text-[9px] px-1.5 py-0.5 uppercase tracking-wider">
              🎥 VIDEO
            </span>
          )}

          <div className={styles.postAuthor}>
            <img
              src={post.authorAvatar}
              className={styles.authorAvatar}
              alt="author avatar"
            />
            <span className="text-slate-300 font-semibold">
              {post.authorName}
            </span>
          </div>

          <span>•</span>
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>

          <span>•</span>
          <span className={styles.metaItem}>👀 {post.views || 0} VIEWS</span>

          <span>•</span>
          <span className={styles.metaItem}>👍 {post.likes || 0} LIKES</span>
        </div>

        {/* Display Post Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className={styles.postTags}>
            {post.tags.map((tag) => (
              <span key={tag} className={styles.tagBadge}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
