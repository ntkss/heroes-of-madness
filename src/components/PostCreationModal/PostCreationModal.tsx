import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/utils/AuthContext";
import {
  savePost,
  fetchPlayers,
  fetchMatches,
  extractAutomaticTags,
  DbPlayer,
  Match,
  ForumPost,
  uploadBase64Image,
} from "@/utils/firebase";
import { playBeep, playCoin } from "@/utils/audio";
import styles from "./styles.module.css";

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

interface PostCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPost: ForumPost) => void;
}

export default function PostCreationModal({
  isOpen,
  onClose,
  onSuccess,
}: PostCreationModalProps) {
  const { user, isAdmin } = useAuth();

  const [postTitle, setPostTitle] = useState("");
  const [postDescription, setPostDescription] = useState("");
  const [postType, setPostType] = useState<"news" | "forum">("forum");
  const [postImageBase64, setPostImageBase64] = useState("");
  const [postImagePreview, setPostImagePreview] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [mentionPlayerId, setMentionPlayerId] = useState("");
  const [mentionMatchId, setMentionMatchId] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadHelpers = async () => {
      try {
        const [playersList, matchesList] = await Promise.all([
          fetchPlayers(),
          fetchMatches(),
        ]);
        setPlayers(playersList);
        setRecentMatches(matchesList.slice(0, 15));
      } catch (e) {
        console.error("Error loading creation helpers:", e);
      }
    };
    loadHelpers();
  }, []);

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
      setFormError("FAILED TO COMPRESS IMAGE!");
    }
  };

  const handleClearImage = () => {
    setPostImageBase64("");
    setPostImagePreview("");
  };

  const handleCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!user) {
      setFormError("YOU MUST BE LOGGED IN!");
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
      const automaticTags = extractAutomaticTags(
        titleTrimmed,
        descTrimmed,
        postType,
      );

      // Extract players & matches dependencies
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

      // Add extra system indexing tags if player/match mentions are used
      if (mentionedPlayers.length > 0 && !automaticTags.includes("players")) {
        automaticTags.push("players");
      }
      if (mentionedMatches.length > 0 && !automaticTags.includes("match")) {
        automaticTags.push("match");
      }

      let uploadedUrl: string | undefined = undefined;
      if (postImageBase64) {
        const storagePath = `forums/${user.uid}-${Date.now()}.jpg`;
        uploadedUrl = await uploadBase64Image(postImageBase64, storagePath);
      }

      const saved = await savePost({
        title: titleTrimmed,
        description: descTrimmed,
        type: postType,
        imageUrl: uploadedUrl,
        tags: automaticTags,
        mentionedPlayers,
        mentionedMatches,
        authorId: user.uid,
        authorName: user.displayName || "ANONYMOUS RECRUIT",
        authorAvatar:
          user.photoURL ||
          `https://api.dicebear.com/9.x/pixel-art/svg?seed=${user.uid}&backgroundColor=1a1a2e`,
      });

      onSuccess(saved);
      onClose();
      playCoin();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "FAILED TO COMPILE NEW THREAD!",
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>CREATE NEW COMMUNITY THREAD</h2>
          <button
            type="button"
            onClick={() => {
              playBeep(150, 0.1, "sine");
              onClose();
            }}
            className={styles.closeBtn}
          >
            ✕ CLOSE
          </button>
        </div>

        <form onSubmit={handleCreatePostSubmit} className={styles.formBody}>
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
                <option value="forum">💬 GENERAL DISCUSSION (FORUMS)</option>
                <option value="news">📢 OFFICIAL ANNOUNCEMENT (NEWS)</option>
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
                    const date = new Date(m.createdAt).toLocaleDateString();
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
          {formError && <div className={styles.errorBox}>⚠️ {formError}</div>}

          {/* Submit button */}
          <button
            type="submit"
            disabled={formSubmitting}
            className={styles.submitBtn}
          >
            {formSubmitting ? "COMPILING SYSTEM POST..." : "🚀 PUBLISH POST"}
          </button>
        </form>
      </div>
    </div>
  );
}
