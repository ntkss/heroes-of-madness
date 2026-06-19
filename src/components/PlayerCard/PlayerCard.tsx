"use client";

import React from "react";
import Image from "next/image";
import styles from "./styles.module.css";

// ─── Rank Badge component ──────────────────────────────────────────────
function RankBadge({
  rank,
  rankClass,
}: {
  rank: string | null;
  rankClass: "high" | "normal" | "low" | null;
}) {
  if (!rank) return null;

  let bgGradient = styles.rankBadgeDefault;

  if (rankClass === "high") {
    bgGradient = styles.rankBadgeHigh;
  } else if (rankClass === "normal") {
    bgGradient = styles.rankBadgeNormalTier;
  } else if (rankClass === "low") {
    bgGradient = styles.rankBadgeLow;
  } else {
    // Fallbacks for legacy rank names
    if (rank.includes("Mythic")) {
      bgGradient = styles.rankBadgeHigh;
    } else if (rank === "Legend") {
      bgGradient = styles.rankBadgeNormalTier;
    } else if (rank === "Epic") {
      bgGradient = styles.rankBadgeLow;
    }
  }

  const isThai = /[\u0E00-\u0E7F]/.test(rank);
  const fontClass = isThai
    ? "font-thai text-xl tracking-wide"
    : "font-pixel text-xs uppercase tracking-wider";

  return (
    <div className={`${styles.rankBadge} ${fontClass} ${bgGradient}`}>
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

  const cardBorderClass = `${styles.playerCardBorder} ${
    rolling
      ? styles.cardRolling
      : isBlue
        ? styles.cardBlueBorder
        : styles.cardRedBorder
  } ${rolling ? "" : styles.cardNormalState} ${
    isLoser ? styles.cardLoser : styles.cardWinner
  }`;

  return (
    <div
      className={`
        ${styles.playerCard}
        ${isBlue ? styles.cardBlue : styles.cardRed}
        ${cardBorderClass}
      `}
    >
      {/* Glow highlight on drafting slot */}
      {rolling && <div className={styles.draftGlow} />}

      {/* Unskewed Content Wrapper */}
      <div className={styles.contentWrapper}>
        {/* Rank Banner (Top Center) */}
        {locked && name !== "???" && name !== "DRAFTING" && (
          <RankBadge rank={finalRank} rankClass={rankClass || null} />
        )}

        {/* Background Portrait Image */}
        <div className={styles.portraitContainer}>
          {locked && name !== "???" && name !== "DRAFTING" && finalImageURL ? (
            <Image
              src={finalImageURL}
              alt={name}
              fill
              className={`object-cover object-center opacity-85 ${styles.animateFadeIn}`}
              unoptimized
              crossOrigin="anonymous"
            />
          ) : !locked ? (
            <div className={styles.draftSlot}>
              <span className={styles.draftQuestion}>?</span>
            </div>
          ) : (
            <div className={styles.vacantSlot}>
              <span className={styles.vacantText}>DRAFT</span>
            </div>
          )}
        </div>

        {/* Ambient Dark Gradient Bottom Overlay to make text legible */}
        <div
          className={`${styles.ambientOverlay} ${
            isBlue ? styles.overlayBlue : styles.overlayRed
          }`}
        />

        {/* Winner Badge Banner */}
        {isWinner && (
          <div className={styles.winnerBanner}>
            <span className={styles.winnerBadge}>WIN</span>
          </div>
        )}

        {/* Bottom Hero & Player detail card */}
        <div className={styles.detailsContainer}>
          {/* Player drafted Name (Large font, full-width focus) */}
          <span
            className={`
              ${styles.playerName}
              ${
                /[\u0E00-\u0E7F]/.test(displayName || name)
                  ? styles.playerNameThai
                  : styles.playerNameEnglish
              }
            `}
          >
            {displayName || name}
          </span>

          {/* Player Role / Lane */}
          {role && <span className={styles.playerRole}>{role}</span>}

          {/* Loading Stats Bottom row */}
          <div className={styles.statsBox}>
            <div className={styles.statsHeader}>
              <span className={styles.percentageText}>{percentage}%</span>
              <span className={styles.loadingLabel}>LOADING</span>
            </div>
            <div className={styles.progressBarOuter}>
              <div
                className={`${styles.progressBarInner} ${
                  isBlue
                    ? styles.progressBarInnerBlue
                    : styles.progressBarInnerRed
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
