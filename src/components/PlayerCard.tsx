"use client";

import React from "react";
import Image from "next/image";

// ─── Rank Badge component ──────────────────────────────────────────────
function RankBadge({
  rank,
  rankClass,
}: {
  rank: string | null;
  rankClass: "high" | "normal" | "low" | null;
}) {
  if (!rank) return null;

  let bgGradient =
    "from-slate-600 to-slate-800 border-slate-400 text-slate-100";

  if (rankClass === "high") {
    bgGradient =
      "from-purple-600 via-indigo-700 to-purple-800 border-purple-400 text-yellow-200 shadow-[0_0_6px_rgba(168,85,247,0.5)]";
  } else if (rankClass === "normal") {
    bgGradient =
      "from-amber-600 via-orange-600 to-amber-700 border-orange-400 text-amber-100 shadow-[0_0_6px_rgba(249,115,22,0.5)]";
  } else if (rankClass === "low") {
    bgGradient =
      "from-emerald-600 to-teal-700 border-emerald-400 text-emerald-100 shadow-[0_0_6px_rgba(16,185,129,0.5)]";
  } else {
    // Fallbacks for legacy rank names
    if (rank.includes("Mythic")) {
      bgGradient =
        "from-purple-600 via-indigo-700 to-purple-800 border-purple-400 text-yellow-200 shadow-[0_0_6px_rgba(168,85,247,0.5)]";
    } else if (rank === "Legend") {
      bgGradient =
        "from-amber-600 via-orange-600 to-amber-700 border-orange-400 text-amber-100 shadow-[0_0_6px_rgba(249,115,22,0.5)]";
    } else if (rank === "Epic") {
      bgGradient =
        "from-emerald-600 to-teal-700 border-emerald-400 text-emerald-100 shadow-[0_0_6px_rgba(16,185,129,0.5)]";
    }
  }

  const isThai = /[\u0E00-\u0E7F]/.test(rank);
  const fontClass = isThai
    ? "font-thai text-xl tracking-wide"
    : "font-pixel text-xs uppercase tracking-wider";

  return (
    <div
      className={`absolute top-1 left-1/2 transform -translate-x-1/2 z-20 px-1.5 py-0.5 border leading-none rounded-sm bg-gradient-to-r ${fontClass} ${bgGradient}`}
    >
      {rank}
    </div>
  );
}

// ─── Player Card ───────────────────────────────────────────────────────────────
export interface PlayerCardProps {
  name: string;
  displayName?: string;
  role: string;
  locked: boolean;
  team: "A" | "B";
  imageURL?: string;
  isWinner: boolean;
  isLoser: boolean;
  percentage: number;
  currentRank?: string;
  rankClass?: "high" | "normal" | "low" | null;
}

export default function PlayerCard({
  name,
  displayName,
  role,
  locked,
  team,
  imageURL,
  isWinner,
  isLoser,
  percentage,
  currentRank,
  rankClass,
}: PlayerCardProps) {
  const isBlue = team === "A";
  const rolling = !locked;

  // Use fallback Dicebear pixel-art avatar if no imageURL is provided to prevent ugly empty avatars
  const avatarSeed = name.toLowerCase();
  const finalImageURL =
    name !== "???" && name !== "DRAFTING"
      ? imageURL ||
        `https://api.dicebear.com/9.x/pixel-art/svg?seed=${avatarSeed}&backgroundColor=1a1a2e`
      : null;

  // Simple deterministic hash based on name characters for fallbacks (e.g. bots)
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const finalRank =
    currentRank ||
    (name !== "???" && name !== "DRAFTING"
      ? hash % 3 === 0
        ? "Mythic"
        : hash % 3 === 1
          ? "Legend"
          : "Epic"
      : null);

  return (
    <div
      className={`
        relative flex flex-col overflow-hidden border-2
        transition-all duration-300 origin-bottom transform -skew-x-[9deg]
        ${rolling ? "scale-105 z-10" : "scale-100"}
        ${isLoser ? "opacity-35 grayscale" : "opacity-100"}
        ${
          rolling
            ? "border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.7)] animate-pulse"
            : isBlue
              ? "border-[#c5a059] shadow-[0_0_8px_rgba(0,191,255,0.2)]"
              : "border-[#b85b5b] shadow-[0_0_8px_rgba(239,68,68,0.2)]"
        }
      `}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        aspectRatio: "1/2.2",
        maxHeight: "300px",
        minHeight: "130px",
        background: isBlue
          ? "linear-gradient(to bottom, #071324 0%, #0d1e36 50%, #0b1522 100%)"
          : "linear-gradient(to bottom, #1d050a 0%, #2e0911 50%, #1c050a 100%)",
      }}
    >
      {/* Glow highlight on drafting slot */}
      {rolling && (
        <div className="absolute inset-0 bg-yellow-400/5 animate-pulse z-0 pointer-events-none" />
      )}

      {/* Unskewed Content Wrapper */}
      <div className="w-full h-full transform skew-x-[9deg] relative flex flex-col justify-between p-0.5 sm:p-1 z-10 select-none">
        {/* Rank Banner (Top Center) */}
        {locked && name !== "???" && name !== "DRAFTING" && (
          <RankBadge rank={finalRank} rankClass={rankClass || null} />
        )}

        {/* Background Portrait Image */}
        <div className="absolute inset-0 w-[140%] -left-[20%] h-full pointer-events-none z-0">
          {locked && name !== "???" && name !== "DRAFTING" && finalImageURL ? (
            <Image
              src={finalImageURL}
              alt={name}
              fill
              className="object-cover object-center opacity-85 animate-fade-in"
              unoptimized
            />
          ) : !locked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 border border-yellow-500/20">
              <span className="text-yellow-500/40 font-action text-7xl font-black animate-pulse select-none drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]">
                ?
              </span>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
              <span className="text-slate-600 font-pixel text-[6px] animate-pulse">
                DRAFT
              </span>
            </div>
          )}
        </div>

        {/* Ambient Dark Gradient Bottom Overlay to make text legible */}
        <div
          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none z-10"
          style={{
            background: isBlue
              ? "linear-gradient(to top, rgba(3, 8, 20, 0.98) 0%, rgba(3, 8, 20, 0.8) 55%, rgba(3, 8, 20, 0.1) 85%, transparent 100%)"
              : "linear-gradient(to top, rgba(20, 3, 5, 0.98) 0%, rgba(20, 3, 5, 0.8) 55%, rgba(20, 3, 5, 0.1) 85%, transparent 100%)",
          }}
        />

        {/* Winner Badge Banner */}
        {isWinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <span className="text-yellow-400 font-action text-[12px] sm:text-base font-black rotate-[-15deg] glow-yellow tracking-wider select-none border border-yellow-400/80 px-1.5 py-0.5 bg-black/80 shadow-[0_0_10px_rgba(250,204,21,0.5)]">
              WIN
            </span>
          </div>
        )}

        {/* Bottom Hero & Player detail card */}
        <div className="mt-auto w-full relative z-20 flex flex-col pt-2">
          {/* Player drafted Name (Large font, full-width focus) */}
          <span
            className={`
              text-white text-center block truncate mt-0.5 tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]
              ${
                /[\u0E00-\u0E7F]/.test(displayName || name)
                  ? "font-thai text-xs sm:text-sm md:text-base lg:text-3xl font-bold"
                  : "font-action text-xs sm:text-sm md:text-base lg:text-3xl font-black"
              }
            `}
          >
            {displayName || name}
          </span>

          {/* Player Role / Lane */}
          {role && (
            <span className="font-pixel text-[5.5px] sm:text-[6.5px] md:text-[7.5px] lg:text-[8.5px] italic text-amber-400 text-center block tracking-widest leading-none mt-1 uppercase drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.9)]">
              {role}
            </span>
          )}

          {/* Loading Stats Bottom row */}
          <div className="flex flex-col w-full mt-1.5 p-1 bg-black/60 rounded border border-white/5 shadow-inner">
            <div className="flex justify-between items-center w-full leading-none mb-1">
              <span className="font-mono text-[8px] sm:text-[9.5px] font-bold text-white pl-0.5 leading-none">
                {percentage}%
              </span>
              <span className="text-[6.5px] sm:text-[7.5px] text-slate-400 font-pixel uppercase tracking-tighter leading-none">
                LOADING
              </span>
            </div>
            <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  isBlue
                    ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
                    : "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]"
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
