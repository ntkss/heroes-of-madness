"use client";

import React, { useState } from "react";
import Image from "next/image";
import { playBeep, playCoin } from "@/utils/audio";
import { DbPlayer } from "@/utils/firebase";
import RegisterFighterForm from "@/components/RegisterFighterForm";
import FighterDirectory from "@/components/FighterDirectory";
import styles from "./styles.module.css";

interface PlayerInputProps {
  names: string[];
  onChange: (names: string[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  availablePlayers: DbPlayer[];
  onAddPlayer: (player: Omit<DbPlayer, "id">) => Promise<DbPlayer>;
}

export default function PlayerInput({
  names,
  onChange,
  onGenerate,
  isGenerating,
  availablePlayers,
  onAddPlayer,
}: PlayerInputProps) {
  const [isAdding, setIsAdding] = useState(false);

  const currentCount = names.length;
  const isReady = currentCount >= 10;

  const handleTogglePlayer = (player: DbPlayer) => {
    if (isGenerating) return;

    const exists = names.includes(player.name);
    if (exists) {
      playBeep(220, 0.1, "sawtooth");
      onChange(names.filter((n) => n !== player.name));
    } else {
      if (names.length >= 10) {
        playBeep(120, 0.2, "sawtooth"); // Error beep, draft full
        return;
      }
      playCoin();
      onChange([...names, player.name]);
    }
  };

  const handleRemoveName = (nameToRemove: string) => {
    if (isGenerating) return;
    playBeep(220, 0.1, "sawtooth");
    onChange(names.filter((n) => n !== nameToRemove));
  };

  const handleClear = () => {
    playBeep(220, 0.15, "sawtooth");
    onChange([]);
  };

  const handleQuickFill = () => {
    playCoin();
    // Find players not yet selected
    const unselected = availablePlayers.filter((p) => !names.includes(p.name));
    // Shuffle unselected
    const shuffled = [...unselected].sort(() => Math.random() - 0.5);
    // Take what is needed to reach 10
    const needed = 10 - names.length;
    if (needed <= 0) return;
    const toAdd = shuffled.slice(0, needed).map((p) => p.name);
    onChange([...names, ...toAdd]);
  };

  const toggleAddForm = () => {
    playBeep(440, 0.08, "triangle");
    setIsAdding(!isAdding);
  };

  return (
    <div className={styles.container}>
      {/* Decorative metal rivets/screws */}
      <div className={`${styles.rivet} ${styles.rivetTopLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetTopRight}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
      <div className={`${styles.rivet} ${styles.rivetBottomRight}`} />

      {/* Screen Title */}
      <div className={styles.header}>
        <h2 className={styles.title}>SELECT FIGHTERS</h2>
        <span
          className={`${styles.counterBox} ${
            isReady ? styles.counterReady : styles.counterNotReady
          }`}
        >
          DRAFT: {currentCount}/10
        </span>
      </div>

      {/* Split layout: Left (Active Roster) & Right (Draft Actions) */}
      <div className={styles.layout}>
        {/* Left Side: Visual Draft Queue Grid */}
        <div className={styles.leftCol}>
          <span className={styles.rosterLabel}>
            ACTIVE FIGHTER ROSTER SLOTS
          </span>
          <div className={styles.slotsGrid}>
            {Array.from({ length: 10 }).map((_, index) => {
              const selectedName = names[index];
              const playerObj = availablePlayers.find(
                (p) => p.name === selectedName,
              );

              return selectedName ? (
                <div
                  key={index}
                  onClick={() => handleRemoveName(selectedName)}
                  className={styles.slotSelected}
                >
                  <div className={styles.slotAvatar}>
                    <Image
                      src={
                        playerObj?.avatar ||
                        `https://api.dicebear.com/9.x/pixel-art/svg?seed=${selectedName.toLowerCase()}&backgroundColor=1a1a2e`
                      }
                      alt={selectedName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <span className={styles.slotName}>{selectedName}</span>
                  <span className={styles.slotAlias}>
                    {playerObj?.alias || "Fighter"}
                  </span>
                  {/* Remove Hover overlay */}
                  <div className={styles.removeOverlay}>
                    <span className={styles.removeText}>REMOVE</span>
                  </div>
                </div>
              ) : (
                <div key={index} className={styles.slotVacant}>
                  <span className={styles.vacantPlus}>+</span>
                  <span className={styles.vacantLabel}>VACANT</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Quick Fill, Clear, Add new, Fight */}
        <div className={styles.rightCol}>
          <p className={styles.description}>
            SELECT 10 PLAYERS FROM THE DATABASE BELOW. USE QUICK FILL TO LET
            RANDOM BOTS FILL THE VOID.
          </p>

          <div className={styles.actionsGrid}>
            <button
              type="button"
              onClick={handleQuickFill}
              className={styles.quickFillBtn}
              disabled={isGenerating}
            >
              QUICK FILL
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={styles.clearAllBtn}
              disabled={isGenerating}
            >
              CLEAR ALL
            </button>
          </div>

          <div className={styles.actionsCol}>
            <button
              type="button"
              onClick={toggleAddForm}
              className={`${styles.toggleFormBtn} ${
                isAdding
                  ? styles.toggleFormBtnActive
                  : styles.toggleFormBtnInactive
              }`}
            >
              {isAdding ? "✕ CLOSE FORM" : "➕ ADD NEW FIGHTER"}
            </button>

            <button
              type="button"
              onClick={() => {
                playBeep(880, 0.15, "sawtooth");
                onGenerate();
              }}
              disabled={isGenerating || !isReady}
              className={`${styles.randomizeBtn} ${
                isGenerating || !isReady
                  ? styles.randomizeBtnDisabled
                  : styles.randomizeBtnActive
              }`}
            >
              {isGenerating ? "DRAFTING..." : "FIGHT! RANDOMIZE"}
            </button>

            {!isReady && (
              <div className={styles.draftError}>
                ⚠️ DRAFT INCOMPLETE ({currentCount}/10). SELECT 10 PLAYERS!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add New Fighter Form Pane */}
      {isAdding && (
        <RegisterFighterForm
          onSubmit={async (data) => {
            const trimmedName = (data.name || "").trim();
            if (!trimmedName) {
              throw new Error("FIGHTER NAME REQUIRED!");
            }

            // Check uniqueness
            const nameExists = availablePlayers.some(
              (p) =>
                p.name.toLowerCase() === trimmedName.toLowerCase() ||
                p.id.toLowerCase() === trimmedName.toLowerCase(),
            );
            if (nameExists) {
              throw new Error("FIGHTER NAME ALREADY EXISTS!");
            }

            const added = await onAddPlayer({
              name: trimmedName,
              alias: (data.alias || "").trim() || trimmedName.toLowerCase(),
              avatar: data.avatar,
              imageURL: data.avatar,
              winrate: 0,
              current_rank: "Epic",
              highest_rank: "Legend",
              total_match_played: 0,
              role: "ALL-ROUNDER",
            });

            setIsAdding(false);
            playCoin();

            // Auto-add new player to draft if there's space
            if (names.length < 10) {
              onChange([...names, added.name]);
            }
          }}
          onClose={() => setIsAdding(false)}
        />
      )}

      {/* Bottom section: filterable list of player buttons */}
      <FighterDirectory
        availablePlayers={availablePlayers}
        names={names}
        onTogglePlayer={handleTogglePlayer}
      />
    </div>
  );
}
