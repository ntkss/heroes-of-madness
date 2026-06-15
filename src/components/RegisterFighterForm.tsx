"use client";

import React, { useState } from "react";

interface RegisterFighterFormProps {
  onSubmit: (data: { name: string; alias: string; avatar: string }) => Promise<void>;
  onClose: () => void;
}

// Client-side image compression helper using Canvas
const compressImage = (file: File, maxWidth = 128, maxHeight = 128): Promise<string> => {
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

export default function RegisterFighterForm({ onSubmit, onClose }: RegisterFighterFormProps) {
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [avatarBase64, setAvatarBase64] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    } catch (err: any) {
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

    if (!name.trim()) {
      setError("FIGHTER NAME REQUIRED!");
      return;
    }

    setLoading(true);
    try {
      let finalAvatar = avatarBase64;
      if (!finalAvatar) {
        // Fallback to Dicebear pixel art if no image uploaded
        const seed = name.trim().toLowerCase();
        finalAvatar = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=1a1a2e`;
      }

      await onSubmit({
        name: name.trim(),
        alias: alias.trim(),
        avatar: finalAvatar,
      });
    } catch (err: any) {
      setError(err?.message || "FAILED TO SAVE FIGHTER!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-black/60 border-2 border-neon-yellow/30 p-4 mb-5 flex flex-col gap-3 animate-scaleUp"
    >
      <div className="font-pixel text-[10px] text-neon-yellow uppercase tracking-widest border-b border-slate-800 pb-1.5 mb-1 glow-yellow flex justify-between items-center">
        <span>NEW FIGHTER REGISTRATION</span>
        <button
          type="button"
          onClick={onClose}
          className="text-neon-red hover:text-white font-pixel text-[8px] cursor-pointer"
        >
          ✕ CLOSE
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-tech text-xs">
        {/* Fighter Name */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-pixel text-[7.5px] uppercase">NAME (REQ)</label>
          <input
            type="text"
            placeholder="e.g. Nutty"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
            disabled={loading}
          />
        </div>

        {/* Alias */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-pixel text-[7.5px] uppercase">ALIAS</label>
          <input
            type="text"
            placeholder="e.g. nutty"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
            disabled={loading}
          />
        </div>

        {/* Portrait Photo */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-pixel text-[7.5px] uppercase">PORTRAIT PHOTO</label>
          <div className="flex items-center gap-2">
            {avatarPreview ? (
              <div className="relative w-10 h-10 border border-neon-yellow bg-slate-950 flex-shrink-0 overflow-hidden">
                <img
                  src={avatarPreview}
                  alt="Avatar Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute inset-0 bg-black/85 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-150 text-[7px] font-pixel text-neon-red cursor-pointer"
                  disabled={loading}
                >
                  REMOVE
                </button>
              </div>
            ) : (
              <div className="w-10 h-10 border border-dashed border-slate-700 bg-slate-950/40 flex items-center justify-center flex-shrink-0 text-slate-600 font-pixel text-[12px] select-none">
                ?
              </div>
            )}
            <label className="flex-1 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 p-2 text-[9px] font-pixel text-slate-300 hover:text-white cursor-pointer transition-colors text-center select-none uppercase h-full min-h-[34px]">
              {avatarPreview ? "CHANGE" : "UPLOAD"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[8.5px] font-pixel text-neon-red glow-red uppercase">
          ⚠️ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="self-end mt-2 font-pixel text-[9px] text-black bg-neon-yellow border-2 border-white px-4 py-2 hover:bg-white transition-colors cursor-pointer uppercase font-bold disabled:opacity-50"
      >
        {loading ? "SAVING..." : "SUBMIT FIGHTER"}
      </button>
    </form>
  );
}

