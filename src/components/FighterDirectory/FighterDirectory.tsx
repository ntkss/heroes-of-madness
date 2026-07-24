"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DbPlayer } from "@/utils/firebase";
import { playBeep, playCoin } from "@/utils/audio";
import EditFighterForm from "@/components/EditFighterForm";
import styles from "./styles.module.css";

interface FighterDirectoryProps {
  availablePlayers: DbPlayer[];
  names: string[];
  onTogglePlayer: (player: DbPlayer) => void;
  onDeletePlayer: (playerId: string) => Promise<void>;
  onUpdatePlayer: (
    oldPlayerId: string,
    name: string,
    alias: string,
    avatar: string,
  ) => Promise<DbPlayer>;
  isAdmin?: boolean;
}

export default function FighterDirectory({
  availablePlayers,
  names,
  onTogglePlayer,
  onDeletePlayer,
  onUpdatePlayer,
  isAdmin = false,
}: FighterDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<DbPlayer | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState<DbPlayer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredPlayers = availablePlayers.filter((player) => {
    const search = searchTerm.toLowerCase();
    return (
      player.name.toLowerCase().includes(search) ||
      player.alias.toLowerCase().includes(search)
    );
  });

  const handleConfirmDelete = async () => {
    if (!deletingPlayer) return;
    setIsDeleting(true);
    try {
      playBeep(120, 0.35, "sawtooth", 0.15); // alarm warning sound
      await onDeletePlayer(deletingPlayer.id);
      setDeletingPlayer(null);
    } catch (e) {
      console.error("Delete player failed:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async (
    name: string,
    alias: string,
    avatar: string,
  ) => {
    if (!editingPlayer) return;
    try {
      await onUpdatePlayer(editingPlayer.id, name, alias, avatar);
      playCoin(); // retro success chime
      setEditingPlayer(null);
    } catch (e) {
      // Propagation of throw will let EditFighterForm display the error locally
      throw e;
    }
  };

  return (
    <div className={styles.container}>
      {/* Inline Forms and Notifications at the top of the directory container */}

      {/* Deletion Dialog */}
      {deletingPlayer && (
        <div className={styles.deleteConfirmOverlay}>
          <div className={styles.deleteConfirmBox}>
            <span className={styles.deleteTitle}>ALERT: DELETE FIGHTER?</span>
            <p className={styles.deleteMsg}>
              ARE YOU ABSOLUTELY SURE YOU WANT TO DISCHARGE &quot;
              {deletingPlayer.name}&quot; FROM THE SYSTEM? THIS WILL PERMANENTLY
              ERASE THEIR DOSSIER.
            </p>
            <div className={styles.deleteActions}>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className={styles.confirmDeleteBtn}
                disabled={isDeleting}
              >
                {isDeleting ? "DELETING..." : "CONFIRM DELETION"}
              </button>
              <button
                type="button"
                onClick={() => setDeletingPlayer(null)}
                className={styles.cancelDeleteBtn}
                disabled={isDeleting}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing Modal/Form */}
      {editingPlayer && (
        <EditFighterForm
          key={editingPlayer.id}
          player={editingPlayer}
          onSubmit={handleSaveEdit}
          onClose={() => setEditingPlayer(null)}
        />
      )}

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
            const isSelected = names.includes(player.id);
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
              <div
                key={player.id}
                className={`${styles.fighterCard} ${
                  isSelected
                    ? styles.fighterCardSelected
                    : styles.fighterCardUnselected
                }`}
              >
                {/* Main clickable toggle draft zone */}
                <button
                  type="button"
                  onClick={() => onTogglePlayer(player)}
                  className={styles.fighterSelectBtn}
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
                    <Link
                      href={`/players/${player.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        playBeep(300, 0.1, "sine");
                      }}
                      className={styles.profileLinkBtn}
                    >
                      PROFILE 👤
                    </Link>
                  </div>
                  {/* WR badge if match played > 0 */}
                  {player.total_match_played > 0 && (
                    <span className={styles.wrBadge}>{player.winrate}% WR</span>
                  )}
                </button>

                {/* Edit & Delete Action Panel */}
                {isAdmin && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playBeep(440, 0.08, "triangle");
                        setEditingPlayer(player);
                      }}
                      className={`${styles.actionBtn} ${styles.editBtn}`}
                      title="Edit Profile"
                    >
                      <svg
                        className="w-3.5 h-3.5 fill-current"
                        viewBox="0 0 24 24"
                      >
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playBeep(220, 0.15, "sawtooth");
                        setDeletingPlayer(player);
                      }}
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      title="Delete Profile"
                    >
                      <svg
                        className="w-3.5 h-3.5 fill-current"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
