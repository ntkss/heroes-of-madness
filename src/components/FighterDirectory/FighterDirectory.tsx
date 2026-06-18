"use client";

import React, { useState } from "react";
import Image from "next/image";
import { DbPlayer } from "@/utils/firebase";
import styles from "./styles.module.css";

interface FighterDirectoryProps {
  availablePlayers: DbPlayer[];
  names: string[];
  onTogglePlayer: (player: DbPlayer) => void;
}

export default function FighterDirectory({
  availablePlayers,
  names,
  onTogglePlayer,
}: FighterDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPlayers = availablePlayers.filter((player) => {
    const search = searchTerm.toLowerCase();
    return (
      player.name.toLowerCase().includes(search) ||
      player.alias.toLowerCase().includes(search)
    );
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>
          FIGHTER DIRECTORY (CLICK TO TOGGLE DRAFT)
        </span>

        {/* Search Input */}
        <input
          type="text"
          placeholder="SEARCH FIGHTER..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {filteredPlayers.length === 0 ? (
        <div className={styles.noFighters}>
          NO FIGHTERS FOUND MATCHING &quot;{searchTerm}&quot;
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredPlayers.map((player) => {
            const isSelected = names.includes(player.name);
            const isThaiName = /[\u0E00-\u0E7F]/.test(player.name);
            const isThaiRank = /[\u0E00-\u0E7F]/.test(player.current_rank);

            const rankColor = player.current_rank.includes("Mythic")
              ? "text-purple-400"
              : player.current_rank === "Legend"
                ? "text-orange-400"
                : player.current_rank === "Epic"
                  ? "text-green-400"
                  : "text-slate-400";

            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onTogglePlayer(player)}
                className={`${styles.fighterBtn} ${
                  isSelected
                    ? styles.fighterBtnSelected
                    : styles.fighterBtnUnselected
                }`}
              >
                {/* Small Avatar */}
                <div className={styles.avatarContainer}>
                  <Image
                    src={player.avatar}
                    alt={player.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className={styles.info}>
                  <span
                    className={`${styles.name} ${
                      isThaiName ? styles.thaiName : styles.englishName
                    }`}
                  >
                    {player.name}
                  </span>
                  <span className={styles.subInfo}>
                    {player.alias} •{" "}
                    <span
                      className={`${rankColor} ${
                        isThaiRank ? styles.thaiRank : ""
                      }`}
                    >
                      {player.current_rank}
                    </span>
                  </span>
                </div>
                {/* WR badge if match played > 0 */}
                {player.total_match_played > 0 && (
                  <span className={styles.wrBadge}>{player.winrate}% WR</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
