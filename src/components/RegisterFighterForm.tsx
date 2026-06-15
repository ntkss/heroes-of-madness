"use client";

import React, { useState } from "react";

interface RegisterFighterFormProps {
  onSubmit: (data: { name: string; alias: string; avatarSeed: string }) => Promise<void>;
  onClose: () => void;
}

export default function RegisterFighterForm({ onSubmit, onClose }: RegisterFighterFormProps) {
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("FIGHTER NAME REQUIRED!");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        alias: alias.trim(),
        avatarSeed: avatarSeed.trim(),
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

        {/* Avatar Seed */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 font-pixel text-[7.5px] uppercase">AVATAR SEED</label>
          <input
            type="text"
            placeholder="Leave blank to use name"
            value={avatarSeed}
            onChange={(e) => setAvatarSeed(e.target.value)}
            className="bg-slate-900 border border-slate-700 p-2 text-white focus:border-neon-yellow focus:outline-none"
            disabled={loading}
          />
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
