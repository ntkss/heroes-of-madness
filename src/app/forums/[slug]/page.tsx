"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import CRTOverlay from "@/components/CRTOverlay";
import styles from "../styles.module.css";
import { useAuth } from "@/utils/AuthContext";
import {
  fetchPostBySlug,
  fetchPosts,
  incrementPostViews,
  togglePostFeedback,
  fetchPostComments,
  savePostComment,
  deletePostComment,
  ForumPost,
  ForumComment,
} from "@/utils/firebase";
import { parseMentions } from "@/utils/mentions";
import { playBeep, playCoin } from "@/utils/audio";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function ForumPostDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const { user, login, isAdmin } = useAuth();

  const [post, setPost] = useState<ForumPost | null>(null);
  const [postsList, setPostsList] = useState<ForumPost[]>([]);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");

  const [loading, setLoading] = useState(true);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");

  // Load Post and Comments
  useEffect(() => {
    const loadPostData = async () => {
      try {
        const activePost = await fetchPostBySlug(slug);
        if (activePost) {
          setPost(activePost);

          // Increment views
          await incrementPostViews(activePost.id);
          // Refresh views count locally
          activePost.views = (activePost.views || 0) + 1;

          // Fetch comments
          const commentsList = await fetchPostComments(activePost.id);
          setComments(commentsList);
        }

        // Fetch posts for recommendation widget
        const allPosts = await fetchPosts();
        setPostsList(allPosts.filter((p) => p.slug !== slug).slice(0, 5));
      } catch (err) {
        console.error("Error loading post data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPostData();
  }, [slug]);

  const handleVote = async (type: "likes" | "dislikes") => {
    if (!user || !post) {
      playBeep(120, 0.15, "sawtooth");
      alert("PLEASE LOGIN TO RATE THIS POST!");
      return;
    }

    playBeep(type === "likes" ? 650 : 350, 0.1, "sine");
    try {
      const updated = await togglePostFeedback(post.id, type, user.uid);
      if (updated) {
        setPost(updated);
      }
    } catch (err) {
      console.error("Error rating post:", err);
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError("");

    if (!user || !post) {
      setCommentError("LOGIN REQUIRED TO POST COMMENTS!");
      return;
    }

    const textTrimmed = newCommentText.trim();
    if (!textTrimmed) return;

    if (textTrimmed.length > 500) {
      setCommentError("COMMENT TOO LONG (MAX 500 CHARS)!");
      return;
    }

    setCommentSubmitting(true);
    try {
      const saved = await savePostComment(post.id, textTrimmed, {
        userId: user.uid,
        authorName: user.displayName || "ANONYMOUS FIGHTER",
        authorAvatar:
          user.photoURL ||
          `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.uid}&backgroundColor=1a1a2e`,
      });

      setComments((prev) => [...prev, saved]);
      setNewCommentText("");
      playCoin();
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "FAILED TO PUBLISH COMMENT!",
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!post) return;
    if (!confirm("ARE YOU SURE YOU WANT TO DELETE THIS COMMENT?")) return;

    playBeep(150, 0.15, "sawtooth");
    try {
      const success = await deletePostComment(post.id, commentId);
      if (success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
  };

  if (loading) {
    return (
      <CRTOverlay>
        <div className={styles.container}>
          <div className="text-center font-pixel text-xs text-[#a0a0c0] py-24 select-none animate-pulse">
            LOADING DATA PACKET...
          </div>
        </div>
      </CRTOverlay>
    );
  }

  if (!post) {
    return (
      <CRTOverlay>
        <div className={styles.container}>
          <Link
            href="/forums"
            className={styles.backLink}
            onClick={() => playBeep(200, 0.1, "sine")}
          >
            ◀ RETURN TO FORUMS LIST
          </Link>
          <div className="text-center py-20 border border-dashed border-red-500/30">
            <h2 className="text-neon-red font-pixel text-sm glow-red uppercase select-none">
              ⚠️ TARGET FILE DELETED OR INVALID SLUG
            </h2>
            <p className="text-slate-500 font-mono text-xs mt-2">
              THE FILE YOU ARE LOOKING FOR IS NOT ON THE BBS SERVER.
            </p>
          </div>
        </div>
      </CRTOverlay>
    );
  }

  // Find user's vote
  const activeVote = user ? post.userVotes?.[user.uid] || null : null;

  return (
    <CRTOverlay>
      <div className={styles.container}>
        {/* Back Link */}
        <Link
          href="/forums"
          className={styles.backLink}
          onClick={() => playBeep(200, 0.1, "sine")}
        >
          ◀ FORUMS INDEX
        </Link>

        {/* Content Layout */}
        <div className={styles.detailGrid}>
          {/* Main Column */}
          <div>
            <article className={styles.detailCard}>
              {/* Type Category Badge */}
              <span
                className={`${styles.badgeType} ${post.type === "news" ? styles.badgeTypeNews : ""}`}
              >
                {post.type}
              </span>

              {/* Title */}
              <h1
                className={`${styles.detailTitle} ${post.type === "news" ? "text-neon-red glow-red" : "text-white"}`}
              >
                {post.title}
              </h1>

              {/* Meta row */}
              <div className={styles.detailMeta}>
                <div className={styles.postAuthor}>
                  <img
                    src={post.authorAvatar}
                    className={styles.authorAvatar}
                    alt="author avatar"
                  />
                  <span className="text-slate-200 font-semibold">
                    {post.authorName}
                  </span>
                </div>
                <span>•</span>
                <span>{new Date(post.createdAt).toLocaleString()}</span>
                <span>•</span>
                <span>👀 {post.views || 0} VIEWS</span>
              </div>

              {/* Post Image */}
              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  className={`${styles.postMainImage} ${post.type === "news" ? styles.postMainImageNews : ""}`}
                  alt="post attach"
                />
              )}

              {/* Description Body with Mentions Parser */}
              <div className={styles.description}>
                {parseMentions(post.description)}
              </div>

              {/* Ratings and Reactions */}
              <div className={styles.feedbackBlock}>
                <div className={styles.feedbackActions}>
                  <button
                    onClick={() => handleVote("likes")}
                    className={`${styles.feedbackBtn} ${
                      activeVote === "likes" ? styles.feedbackBtnLikeActive : ""
                    }`}
                  >
                    👍 LIKES ({post.likes || 0})
                  </button>
                  <button
                    onClick={() => handleVote("dislikes")}
                    className={`${styles.feedbackBtn} ${
                      activeVote === "dislikes"
                        ? styles.feedbackBtnDislikeActive
                        : ""
                    }`}
                  >
                    👎 DISLIKES ({post.dislikes || 0})
                  </button>
                </div>
                <div className="text-[11px] text-slate-600 font-mono">
                  POST REF: #{post.id.substring(0, 8)}
                </div>
              </div>
            </article>

            {/* Comments Thread Section */}
            <div className={styles.commentsContainer}>
              <h3 className={styles.commentsHeading}>
                COMMENT LOGS ({comments.length})
              </h3>

              <div className={styles.commentsList}>
                {comments.length === 0 ? (
                  <div className={styles.noComments}>
                    NO SIGNALS RECORDED ON THIS THREAD. BE THE FIRST TO RESPOND.
                  </div>
                ) : (
                  comments.map((comment) => {
                    const isAuthor = user && comment.userId === user.uid;
                    const canDelete = isAuthor || isAdmin;

                    return (
                      <div key={comment.id} className={styles.commentCard}>
                        <div className={styles.commentHeader}>
                          <div className={styles.commentAuthor}>
                            <img
                              src={comment.authorAvatar}
                              className={styles.authorAvatar}
                              alt="author avatar"
                            />
                            <span>{comment.authorName}</span>
                          </div>
                          <div className="flex items-center">
                            <span className={styles.commentDate}>
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className={styles.deleteCommentBtn}
                              >
                                ⚡ DELETE
                              </button>
                            )}
                          </div>
                        </div>
                        <p className={styles.commentText}>{comment.text}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Comment Form */}
              {user ? (
                <form
                  onSubmit={handleCreateComment}
                  className={styles.commentForm}
                >
                  <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Contribute to debate... (max 500 chars)"
                    className={styles.commentTextarea}
                    maxLength={500}
                    disabled={commentSubmitting}
                    required
                  />
                  {commentError && (
                    <div className={styles.errorBox}>⚠️ {commentError}</div>
                  )}
                  <button
                    type="submit"
                    disabled={commentSubmitting || !newCommentText.trim()}
                    className={styles.submitBtn}
                  >
                    {commentSubmitting
                      ? "TRANSMITTING COMMENT..."
                      : "💬 INJECT COMMENT"}
                  </button>
                </form>
              ) : (
                <div className={styles.loginPrompt}>
                  <p>
                    YOU MUST LOGIN TO WRITE RESPONSES ON THIS CABINET BOARD.
                  </p>
                  <button
                    onClick={() => {
                      playCoin();
                      login();
                    }}
                    className={styles.loginPromptBtn}
                  >
                    🔐 LOGIN GOOGLE
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar recommendations widget */}
          <div>
            <div className={styles.sidebarCard}>
              <h3 className={styles.widgetTitle}>OTHER POSTS</h3>
              {postsList.length === 0 ? (
                <p className="text-xs text-slate-500 font-pixel text-center">
                  NO OTHERS FOUND
                </p>
              ) : (
                <div className={styles.listRow}>
                  {postsList.map((p) => (
                    <Link
                      key={p.id}
                      href={`/forums/${p.slug}`}
                      className={styles.listItem}
                      onClick={() => playBeep(300, 0.1, "sine")}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-xs truncate max-w-[240px] hover:text-neon-blue">
                          {p.title}
                        </span>
                        <span className={styles.listItemMeta}>
                          {p.type === "news" ? "📢 News" : "💬 Forum"} • 👀{" "}
                          {p.views || 0}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CRTOverlay>
  );
}
