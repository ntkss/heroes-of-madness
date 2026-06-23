"use client";

import React, { useState, useEffect } from "react";
import { DbPlayer } from "@/utils/firebase";
import styles from "./styles.module.css";

interface EditFighterFormProps {
  player: DbPlayer;
  onSubmit: (name: string, alias: string, avatar: string) => Promise<void>;
  onClose: () => void;
}

// Client-side image compression helper using Canvas
const compressImage = (
  file: File,
  maxWidth = 128,
  maxHeight = 128,
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

        // Compress as JPEG with 0.7 quality to keep size under ~15KB
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        resolve(compressedBase64);
      };
      img.onerror = (err) => {
        reject(err);
      };
    };
    reader.onerror = (err) => {
      reject(err);
    };
  });
};

export default function EditFighterForm({
  player,
  onSubmit,
  onClose,
}: EditFighterFormProps) {
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [avatarBase64, setAvatarBase64] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-populate fields on initialization or when player changes
  useEffect(() => {
    setName(player.name || "");
    setAlias(player.alias || "");
    const avatarVal = player.avatar || player.imageURL || "";
    setAvatarBase64(avatarVal);
    setAvatarPreview(avatarVal);
    setError("");
  }, [player]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    if (file.size > 10 * 1024 * 1024) {
      setError("FILE SIZE TOO LARGE (MAX 10MB)!");
      return;
    }

    try {
      const compressed = await compressImage(file);
      setAvatarBase64(compressed);
      setAvatarPreview(compressed);
    } catch {
      setError("FAILED TO PROCESS IMAGE!");
    }
  };

  const handleClearImage = () => {
    setAvatarBase64("");
    setAvatarPreview("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("FIGHTER NAME REQUIRED!");
      return;
    }

    if (trimmedName.length > 16) {
      setError("NAME TOO LONG (MAX 16 CHARS)!");
      return;
    }

    setLoading(true);
    try {
      let finalAvatar = avatarBase64;
      if (!finalAvatar) {
        // Fallback to Dicebear pixel art if no image uploaded or removed
        const seed = trimmedName.toLowerCase();
        finalAvatar = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=1a1a2e`;
      }

      await onSubmit(trimmedName, alias.trim(), finalAvatar);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "FAILED TO UPDATE FIGHTER!";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`${styles.form} ${styles.animateScaleUp}`}
    >
      <div className={styles.header}>
        <span>EDIT FIGHTER PROFILE: {player.name}</span>
        <button type="button" onClick={onClose} className={styles.closeBtn}>
          ✕ CANCEL
        </button>
      </div>

      <div className={styles.inputsGrid}>
        {/* Fighter Name */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>DISPLAY NAME (REQ)</label>
          <input
            type="text"
            placeholder="e.g. Nutty"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.inputField}
            disabled={loading}
          />
        </div>

        {/* Alias */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>ALIAS</label>
          <input
            type="text"
            placeholder="e.g. nutty"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className={styles.inputField}
            disabled={loading}
          />
        </div>

        {/* Portrait Photo */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>PROFILE PHOTO</label>
          <div className={styles.avatarRow}>
            {avatarPreview ? (
              <div className={styles.avatarPreviewContainer}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarPreview}
                  alt="Avatar Preview"
                  className={styles.avatarImg}
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className={styles.removeBtn}
                  disabled={loading}
                >
                  REMOVE
                </button>
              </div>
            ) : (
              <div className={styles.vacantPlaceholder}>?</div>
            )}
            <label className={styles.uploadBtnLabel}>
              {avatarPreview ? "CHANGE" : "UPLOAD"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className={styles.uploadInputHidden}
                disabled={loading}
              />
            </label>
          </div>
        </div>
      </div>

      {error && <div className={styles.errorBox}>⚠️ {error}</div>}

      <button type="submit" disabled={loading} className={styles.submitBtn}>
        {loading ? "SAVING..." : "SAVE CHANGES"}
      </button>
    </form>
  );
}
