"use client";

import React, { useState, useEffect, use, useRef } from "react";
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
  updatePost,
  fetchPlayers,
  fetchMatches,
  extractAutomaticTags,
  DbPlayer,
  Match,
  uploadBase64Image,
} from "@/utils/firebase";
import { parseMentions } from "@/utils/mentions";
import { playBeep, playCoin } from "@/utils/audio";

// Client-side image compression helper using Canvas
const compressPostImage = (
  file: File,
  maxWidth = 800,
  maxHeight = 600,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio scale
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context could not be created"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function ForumPostDetailClient({ params }: PageProps) {
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

  // Edit Post State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageBase64, setEditImageBase64] = useState("");
  const [editImagePreview, setEditImagePreview] = useState("");
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [editMentionPlayerId, setEditMentionPlayerId] = useState("");
  const [editMentionMatchId, setEditMentionMatchId] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const [shareText, setShareText] = useState("🔗 SHARE");

  const editDescTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleOpenEdit = async () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditDescription(post.description);
    setEditImageBase64(post.imageUrl || "");
    setEditImagePreview(post.imageUrl || "");
    setEditError("");

    playBeep(440, 0.15, "triangle");
    setIsEditModalOpen(true);

    try {
      const [playersList, matchesList] = await Promise.all([
        fetchPlayers(),
        fetchMatches(),
      ]);
      setPlayers(playersList);
      setRecentMatches(matchesList.slice(0, 15));
    } catch (e) {
      console.error("Error loading edit helpers:", e);
    }
  };

  const handleUpdatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");

    if (!user || !post) return;

    const titleTrimmed = editTitle.trim();
    const descTrimmed = editDescription.trim();

    if (!titleTrimmed) {
      setEditError("TITLE REQUIRED!");
      return;
    }

    if (titleTrimmed.length > 80) {
      setEditError("TITLE TOO LONG (MAX 80 CHARS)!");
      return;
    }

    if (!descTrimmed) {
      setEditError("DESCRIPTION REQUIRED!");
      return;
    }

    setEditSubmitting(true);
    try {
      const finalTags = extractAutomaticTags(
        titleTrimmed,
        descTrimmed,
        post.type,
      );

      const mentionedPlayers: string[] = [];
      const mentionedMatches: string[] = [];

      const playerRegex = /@player:([\w\d_\-\u0E00-\u0E7F\p{L}\p{N}]+)/gu;
      const matchRegex = /@match:([\w\d_\-\u0E00-\u0E7F\p{L}\p{N}]+)/gu;

      let match;
      while ((match = playerRegex.exec(descTrimmed)) !== null) {
        mentionedPlayers.push(match[1]);
      }
      while ((match = matchRegex.exec(descTrimmed)) !== null) {
        mentionedMatches.push(match[1]);
      }

      if (mentionedPlayers.length > 0 && !finalTags.includes("players")) {
        finalTags.push("players");
      }
      if (mentionedMatches.length > 0 && !finalTags.includes("match")) {
        finalTags.push("match");
      }

      let imageUrlToSave = editImageBase64 || undefined;
      if (editImageBase64 && editImageBase64.startsWith("data:")) {
        const storagePath = `forums/${post.id}-${Date.now()}.jpg`;
        imageUrlToSave = await uploadBase64Image(editImageBase64, storagePath);
      }

      const success = await updatePost(post.id, {
        title: titleTrimmed,
        description: descTrimmed,
        imageUrl: imageUrlToSave,
        tags: finalTags,
        mentionedPlayers,
        mentionedMatches,
      });

      if (success) {
        setPost({
          ...post,
          title: titleTrimmed,
          description: descTrimmed,
          imageUrl: imageUrlToSave,
          tags: finalTags,
          mentionedPlayers,
          mentionedMatches,
        });
        setIsEditModalOpen(false);
        playCoin();
      } else {
        setEditError("FAILED TO UPDATE THREAD DATA!");
      }
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "FAILED TO UPDATE THREAD!",
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleEditImageUploadChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEditError("");
    if (file.size > 12 * 1024 * 1024) {
      setEditError("IMAGE FILE SIZE TOO LARGE (MAX 12MB)!");
      return;
    }

    try {
      const compressed = await compressPostImage(file);
      setEditImageBase64(compressed);
      setEditImagePreview(compressed);
    } catch {
      setEditError("FAILED TO COMPRESS PORTRAIT!");
    }
  };

  const handleClearEditImage = () => {
    setEditImageBase64("");
    setEditImagePreview("");
  };

  const insertEditMentionAtCursor = (textToInsert: string) => {
    const textarea = editDescTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const oldText = editDescription;
    const newText =
      oldText.substring(0, start) + textToInsert + oldText.substring(end);

    setEditDescription(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd =
        start + textToInsert.length;
    }, 0);
  };

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

  const handleShare = async () => {
    if (!post) return;
    const shareUrl = window.location.href;
    const shareData = {
      title: `${post.title} | Heroes of Madness Forums`,
      text: post.description.substring(0, 100),
      url: shareUrl,
    };

    playCoin();

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare(shareData)
    ) {
      try {
        await navigator.share(shareData);
        setShareText("🔗 SHARED!");
        setTimeout(() => setShareText("🔗 SHARE"), 2000);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Error sharing:", err);
        }
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareText("📋 COPIED!");
        setTimeout(() => setShareText("🔗 SHARE"), 2000);
      } catch (err) {
        console.error("Clipboard copy failed:", err);
        alert("COULD NOT COPY LINK TO CLIPBOARD. PLEASE COPY THE URL BAR.");
      }
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
            ◀ FORUMS
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
          ◀ FORUMS
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
                <span>•</span>
                <button
                  onClick={handleShare}
                  className="text-neon-blue hover:text-white transition-colors cursor-pointer text-xs font-pixel"
                >
                  {shareText}
                </button>
                {user && post.authorId === user.uid && (
                  <>
                    <span>•</span>
                    <button
                      onClick={handleOpenEdit}
                      className="text-[#ffd200] hover:text-white transition-colors cursor-pointer text-xs font-pixel"
                    >
                      ✏️ EDIT THREAD
                    </button>
                  </>
                )}
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

        {/* EDIT POST MODAL */}
        {isEditModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>EDIT THREAD</h2>
                <button
                  onClick={() => {
                    playBeep(150, 0.1, "sine");
                    setIsEditModalOpen(false);
                  }}
                  className={styles.closeBtn}
                >
                  ✕ CLOSE
                </button>
              </div>

              <form
                onSubmit={handleUpdatePostSubmit}
                className={styles.formBody}
              >
                {/* Title */}
                <div className={styles.inputGroup}>
                  <label className={styles.label}>TOPIC TITLE (REQ)</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Topic title..."
                    className={styles.inputField}
                    maxLength={80}
                    disabled={editSubmitting}
                  />
                </div>

                {/* Description Body */}
                <div className={styles.inputGroup}>
                  <label className={styles.label}>DESCRIPTION TEXT (REQ)</label>
                  <textarea
                    ref={editDescTextareaRef}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Write details... Support inline mentions of fighters and matches!"
                    className={styles.textareaField}
                    disabled={editSubmitting}
                  />
                </div>

                {/* Mention Autocomplete selector helpers */}
                <div className={styles.mentionsHelper}>
                  <div className={styles.mentionsHeader}>
                    ⚡ INSERT MENTION DEPENDENCY:
                  </div>
                  <div className="flex flex-col gap-3">
                    {/* Players */}
                    <div className="flex gap-1.5">
                      <select
                        value={editMentionPlayerId}
                        onChange={(e) => setEditMentionPlayerId(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-white p-1.5 flex-grow font-tech outline-none"
                        disabled={editSubmitting}
                      >
                        <option value="">-- CHOOSE PLAYER --</option>
                        {players.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (editMentionPlayerId) {
                            insertEditMentionAtCursor(
                              `@player:${editMentionPlayerId}`,
                            );
                            playBeep(700, 0.05, "sine");
                          }
                        }}
                        className="bg-sky-950 border border-sky-700 text-sky-400 px-2 text-xs font-pixel"
                        disabled={!editMentionPlayerId || editSubmitting}
                      >
                        ADD
                      </button>
                    </div>

                    {/* Matches */}
                    <div className="flex gap-1.5">
                      <select
                        value={editMentionMatchId}
                        onChange={(e) => setEditMentionMatchId(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-white p-1.5 flex-grow font-tech outline-none"
                        disabled={editSubmitting}
                      >
                        <option value="">-- CHOOSE MATCH --</option>
                        {recentMatches.map((m) => {
                          const date = new Date(
                            m.createdAt,
                          ).toLocaleDateString();
                          return (
                            <option key={m.id} value={m.id}>
                              Match: {m.teamA[0]} vs {m.teamB[0]} ({date})
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (editMentionMatchId) {
                            insertEditMentionAtCursor(
                              `@match:${editMentionMatchId}`,
                            );
                            playBeep(700, 0.05, "sine");
                          }
                        }}
                        className="bg-rose-950 border border-rose-700 text-rose-400 px-2 text-xs font-pixel"
                        disabled={!editMentionMatchId || editSubmitting}
                      >
                        ADD
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optional image edit */}
                <div className={styles.inputGroup}>
                  <label className={styles.label}>
                    ATTACH SCREENSHOT / PREVIEW PHOTO
                  </label>
                  <div className={styles.imageUploadContainer}>
                    {editImagePreview ? (
                      <>
                        <div className={styles.uploadPreview}>
                          <img src={editImagePreview} alt="Edit Preview" />
                        </div>
                        <button
                          type="button"
                          onClick={handleClearEditImage}
                          className={styles.removeImageBtn}
                          disabled={editSubmitting}
                        >
                          REMOVE PHOTO
                        </button>
                      </>
                    ) : (
                      <>
                        <div className={styles.uploadPreview}>
                          <span className={styles.uploadPlaceholder}>🖼️</span>
                        </div>
                        <label className={styles.uploadBtn}>
                          UPLOAD IMAGE
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditImageUploadChange}
                            disabled={editSubmitting}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* Errors */}
                {editError && (
                  <div className={styles.errorBox}>⚠️ {editError}</div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className={styles.submitBtn}
                >
                  {editSubmitting
                    ? "UPDATING SYSTEM THREAD..."
                    : "💾 SAVE CHANGES"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </CRTOverlay>
  );
}
