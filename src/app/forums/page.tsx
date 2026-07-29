"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import CRTOverlay from "@/components/CRTOverlay";
import styles from "./styles.module.css";
import { useAuth } from "@/utils/AuthContext";
import {
  fetchPosts,
  savePost,
  fetchPlayers,
  fetchMatches,
  extractAutomaticTags,
  ForumPost,
  DbPlayer,
  Match,
} from "@/utils/firebase";
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

        // Compress as JPEG with 0.75 quality to keep file size reasonable (~40-80KB)
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function ForumsPage() {
  const { user, login, isAdmin } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "news" | "forum">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modals / Creating Post
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postDescription, setPostDescription] = useState("");
  const [postType, setPostType] = useState<"news" | "forum">("forum");
  const [postImageBase64, setPostImageBase64] = useState("");
  const [postImagePreview, setPostImagePreview] = useState("");

  // Mentions insert selectors
  const [mentionPlayerId, setMentionPlayerId] = useState("");
  const [mentionMatchId, setMentionMatchId] = useState("");

  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [postsList, playersList, matchesList] = await Promise.all([
          fetchPosts(),
          fetchPlayers(),
          fetchMatches(),
        ]);
        setPosts(postsList);
        setPlayers(playersList);
        setRecentMatches(matchesList.slice(0, 15)); // Show recent 15 matches for mention autocomplete
      } catch (err) {
        console.error("Error loading forums data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!user) {
      setFormError("LOGIN REQUIRED TO POST!");
      return;
    }

    const titleTrimmed = postTitle.trim();
    const descTrimmed = postDescription.trim();

    if (!titleTrimmed) {
      setFormError("TITLE REQUIRED!");
      return;
    }

    if (titleTrimmed.length > 80) {
      setFormError("TITLE TOO LONG (MAX 80 CHARS)!");
      return;
    }

    if (!descTrimmed) {
      setFormError("DESCRIPTION REQUIRED!");
      return;
    }

    setFormSubmitting(true);
    try {
      // Automatic Tagging Extraction
      const finalTags = extractAutomaticTags(
        titleTrimmed,
        descTrimmed,
        postType,
      );

      // Parse description for mention dependencies
      const mentionedPlayers: string[] = [];
      const mentionedMatches: string[] = [];

      const playerRegex = /@player:([\w\d_-]+)/g;
      const matchRegex = /@match:([\w\d_-]+)/g;

      let match;
      while ((match = playerRegex.exec(descTrimmed)) !== null) {
        mentionedPlayers.push(match[1]);
      }
      while ((match = matchRegex.exec(descTrimmed)) !== null) {
        mentionedMatches.push(match[1]);
      }

      // If mentioned elements exist, auto group in the tags list
      if (mentionedPlayers.length > 0 && !finalTags.includes("players")) {
        finalTags.push("players");
      }
      if (mentionedMatches.length > 0 && !finalTags.includes("match")) {
        finalTags.push("match");
      }

      const saved = await savePost({
        title: titleTrimmed,
        description: descTrimmed,
        type: postType,
        imageUrl: postImageBase64 || undefined,
        authorId: user.uid,
        authorName: user.displayName || "ANONYMOUS FIGHTER",
        authorAvatar:
          user.photoURL ||
          `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.uid}&backgroundColor=1a1a2e`,
        tags: finalTags,
        mentionedPlayers,
        mentionedMatches,
      });

      setPosts((prev) => [saved, ...prev]);

      // Clear inputs
      setPostTitle("");
      setPostDescription("");
      setPostImageBase64("");
      setPostImagePreview("");
      setMentionPlayerId("");
      setMentionMatchId("");
      setPostType("forum");
      setIsModalOpen(false);

      playCoin();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "FAILED TO CREATE THREAD!",
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleImageUploadChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormError("");
    if (file.size > 12 * 1024 * 1024) {
      setFormError("IMAGE FILE SIZE TOO LARGE (MAX 12MB)!");
      return;
    }

    try {
      const compressed = await compressPostImage(file);
      setPostImageBase64(compressed);
      setPostImagePreview(compressed);
    } catch {
      setFormError("FAILED TO COMPRESS PORTRAIT!");
    }
  };

  const handleClearImage = () => {
    setPostImageBase64("");
    setPostImagePreview("");
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const oldText = postDescription;
    const newText =
      oldText.substring(0, start) + textToInsert + oldText.substring(end);

    setPostDescription(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd =
        start + textToInsert.length;
    }, 0);
  };

  // Compile list of all distinct tags in current posts for the sidebar
  const allDistinctTags = Array.from(
    new Set(posts.flatMap((p) => p.tags)),
  ).sort();

  // Filter logic
  const filteredPosts = posts.filter((post) => {
    // Search filter
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.description.toLowerCase().includes(searchQuery.toLowerCase());

    // Tab filter
    const matchesTab = activeTab === "all" || post.type === activeTab;

    // Tag filter
    const matchesTag = !selectedTag || post.tags.includes(selectedTag);

    return matchesSearch && matchesTab && matchesTag;
  });

  return (
    <CRTOverlay>
      <div className={styles.container}>
        {/* Navigation Breadcrumb */}
        <Link
          href="/"
          className={styles.backLink}
          onClick={() => playBeep(200, 0.1, "sine")}
        >
          ◀ BACK TO CABINET MAIN
        </Link>

        {/* Header bar */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>BBS FORUMS & NEWS</h1>
            <p className="text-xs text-[#a0a0c0] mt-1 font-mono tracking-wider">
              RETRO DIGITAL COMMUNITY ARCHIVE SYSTEM v2.0
            </p>
          </div>
          <div className={styles.headerActions}>
            {user ? (
              <button
                onClick={() => {
                  playBeep(440, 0.15, "triangle");
                  setFormError("");
                  setIsModalOpen(true);
                }}
                className={styles.actionBtnYellow}
              >
                📝 CREATE THREAD
              </button>
            ) : (
              <button
                onClick={() => {
                  playCoin();
                  login();
                }}
                className={styles.actionBtn}
              >
                🔐 LOGIN GOOGLE TO POST
              </button>
            )}
          </div>
        </header>

        {/* Filters Panel */}
        <div className={styles.filterRow}>
          <div className={styles.tabGroup}>
            <button
              onClick={() => {
                playBeep(600, 0.05, "sine");
                setActiveTab("all");
              }}
              className={`${styles.tabBtn} ${activeTab === "all" ? styles.tabBtnActive : ""}`}
            >
              ALL POSTS
            </button>
            <button
              onClick={() => {
                playBeep(600, 0.05, "sine");
                setActiveTab("news");
              }}
              className={`${styles.tabBtn} ${activeTab === "news" ? styles.tabBtnActive : ""}`}
            >
              📢 NEWS / EVENTS
            </button>
            <button
              onClick={() => {
                playBeep(600, 0.05, "sine");
                setActiveTab("forum");
              }}
              className={`${styles.tabBtn} ${activeTab === "forum" ? styles.tabBtnActive : ""}`}
            >
              💬 DISCUSSIONS
            </button>
          </div>

          <div className={styles.searchBar}>
            <input
              type="text"
              placeholder="SEARCH TOPICS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.searchIcon}>🔍</div>
          </div>
        </div>

        {/* Content Section */}
        <div className={styles.board}>
          {/* Main Feed */}
          <div>
            {loading ? (
              <div className="text-center font-pixel text-xs text-[#a0a0c0] py-16 animate-pulse select-none">
                CONNECTING BBS TERMINAL...
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center text-slate-500 font-pixel text-[11px] border border-dashed border-slate-800 py-16 uppercase">
                NO THREADS FOUND
              </div>
            ) : (
              <div className={styles.postList}>
                {filteredPosts.map((post) => (
                  <article
                    key={post.id}
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
                      <h2 className={styles.postTitle}>
                        <Link
                          href={`/forums/${post.slug}`}
                          onClick={() => playBeep(520, 0.1, "sine")}
                        >
                          {post.title}
                        </Link>
                      </h2>
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
                        <span>
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>

                        <span>•</span>
                        <span className={styles.metaItem}>
                          👀 {post.views || 0} VIEWS
                        </span>

                        <span>•</span>
                        <span className={styles.metaItem}>
                          👍 {post.likes || 0} LIKES
                        </span>
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
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar widget panel */}
          <div className={styles.sidebar}>
            {/* Tag cloud */}
            <div className={styles.widget}>
              <h3 className={styles.widgetTitle}>TAG GROUPINGS</h3>
              <div className={styles.widgetTagsList}>
                <button
                  onClick={() => {
                    playBeep(400, 0.05, "sine");
                    setSelectedTag(null);
                  }}
                  className={`${styles.widgetTagBtn} ${!selectedTag ? styles.widgetTagActive : ""}`}
                >
                  #ALL-TAGS ({posts.length})
                </button>
                {allDistinctTags.map((tag) => {
                  const count = posts.filter((p) =>
                    p.tags.includes(tag),
                  ).length;
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        playBeep(400, 0.05, "sine");
                        setSelectedTag(tag);
                      }}
                      className={`${styles.widgetTagBtn} ${selectedTag === tag ? styles.widgetTagActive : ""}`}
                    >
                      #{tag} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Forums Rulebook */}
            <div className={styles.widget}>
              <h3 className={styles.widgetTitle}>SYSTEM PROTOCOLS</h3>
              <ul className="text-xs text-slate-400 space-y-2 font-mono list-disc list-inside">
                <li>ONLY LOGGED-IN USERS CAN OPEN THREADS.</li>
                <li>POSTS WILL BE AUTOMATICALLY INDEXED BY CORE TOPICS.</li>
                <li>INJECT PLAYER MENTIONS WITH @player:NAME.</li>
                <li>INJECT MATCH PROFILE BADGES WITH @match:ID.</li>
                <li>COMMUNITY ETIQUETTE MANDATORY. NO SENSELESS HATE.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* POST CREATION MODAL */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  CREATE NEW COMMUNITY THREAD
                </h2>
                <button
                  onClick={() => {
                    playBeep(150, 0.1, "sine");
                    setIsModalOpen(false);
                  }}
                  className={styles.closeBtn}
                >
                  ✕ CLOSE
                </button>
              </div>

              <form onSubmit={handleCreatePost} className={styles.formBody}>
                {/* Title */}
                <div className={styles.inputGroup}>
                  <label className={styles.label}>TOPIC TITLE (REQ)</label>
                  <input
                    type="text"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="e.g. Patch updates review or squad scrim results!"
                    className={styles.inputField}
                    maxLength={80}
                    disabled={formSubmitting}
                  />
                </div>

                {/* Subcategory selectors */}
                {isAdmin && (
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>POST CATEGORY</label>
                    <select
                      value={postType}
                      onChange={(e) =>
                        setPostType(e.target.value as "news" | "forum")
                      }
                      className={styles.selectField}
                      disabled={formSubmitting}
                    >
                      <option value="forum">
                        💬 GENERAL DISCUSSION (FORUMS)
                      </option>
                      <option value="news">
                        📢 OFFICIAL ANNOUNCEMENT (NEWS)
                      </option>
                    </select>
                  </div>
                )}

                {/* Description Body */}
                <div className={styles.inputGroup}>
                  <label className={styles.label}>DESCRIPTION TEXT (REQ)</label>
                  <textarea
                    ref={textareaRef}
                    value={postDescription}
                    onChange={(e) => setPostDescription(e.target.value)}
                    placeholder="Write details... Support inline mentions of fighters and matches!"
                    className={styles.textareaField}
                    disabled={formSubmitting}
                  />
                </div>

                {/* Mention Selector Helpers */}
                <div className={styles.mentionsHelper}>
                  <div className={styles.mentionsHeader}>
                    ⚡ INSERT MENTION DEPENDENCY:
                  </div>
                  <div className="flex flex-col gap-3">
                    {/* Players dropdown */}
                    <div className="flex gap-1.5">
                      <select
                        value={mentionPlayerId}
                        onChange={(e) => setMentionPlayerId(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-white p-1.5 flex-grow font-tech outline-none"
                        disabled={formSubmitting}
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
                          if (mentionPlayerId) {
                            insertTextAtCursor(`@player:${mentionPlayerId}`);
                            playBeep(700, 0.05, "sine");
                          }
                        }}
                        className="bg-sky-950 border border-sky-700 text-sky-400 px-2 text-xs font-pixel"
                        disabled={!mentionPlayerId || formSubmitting}
                      >
                        ADD
                      </button>
                    </div>

                    {/* Matches dropdown */}
                    <div className="flex gap-1.5">
                      <select
                        value={mentionMatchId}
                        onChange={(e) => setMentionMatchId(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-white p-1.5 flex-grow font-tech outline-none"
                        disabled={formSubmitting}
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
                          if (mentionMatchId) {
                            insertTextAtCursor(`@match:${mentionMatchId}`);
                            playBeep(700, 0.05, "sine");
                          }
                        }}
                        className="bg-rose-950 border border-rose-700 text-rose-400 px-2 text-xs font-pixel"
                        disabled={!mentionMatchId || formSubmitting}
                      >
                        ADD
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optional Image upload */}
                <div className={styles.inputGroup}>
                  <label className={styles.label}>
                    ATTACH SCREENSHOT / PREVIEW PHOTO
                  </label>
                  <div className={styles.imageUploadContainer}>
                    {postImagePreview ? (
                      <>
                        <div className={styles.uploadPreview}>
                          <img src={postImagePreview} alt="Image Preview" />
                        </div>
                        <button
                          type="button"
                          onClick={handleClearImage}
                          className={styles.removeImageBtn}
                          disabled={formSubmitting}
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
                            onChange={handleImageUploadChange}
                            disabled={formSubmitting}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* Error field */}
                {formError && (
                  <div className={styles.errorBox}>⚠️ {formError}</div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className={styles.submitBtn}
                >
                  {formSubmitting
                    ? "COMPILING SYSTEM POST..."
                    : "🚀 PUBLISH POST"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </CRTOverlay>
  );
}
