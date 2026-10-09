"use client";

import React from "react";
import { MatchMode } from "@/utils/firebase";
import { playBeep } from "@/utils/audio";
import styles from "./styles.module.css";

interface SegmentedControlProps {
  activeMode: MatchMode;
  onChange: (mode: MatchMode) => void;
}

interface ModeOption {
  id: MatchMode;
  icon: string;
  shortLabel: string;
  fullLabel: string;
  activeClass: string;
}

const MODES: ModeOption[] = [
  {
    id: "TEAM_LANE",
    icon: "⚔️",
    shortLabel: "TEAM DRAFT",
    fullLabel: "RANDOM TEAM + LANE",
    activeClass: styles.tabBtnActiveTeamLane,
  },
  {
    id: "HERO_ROV",
    icon: "🔥",
    shortLabel: "ROV HEROES",
    fullLabel: "RANDOM HERO – ROV",
    activeClass: styles.tabBtnActiveRov,
  },
  {
    id: "HERO_MLBB",
    icon: "⚡",
    shortLabel: "MLBB HEROES",
    fullLabel: "RANDOM HERO – MLBB",
    activeClass: styles.tabBtnActiveMlbb,
  },
];

export default function SegmentedControl({
  activeMode,
  onChange,
}: SegmentedControlProps) {
  return (
    <div className={styles.container}>
      <div
        className={styles.selectorWrapper}
        role="tablist"
        aria-label="Game Mode Selector"
      >
        {MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => {
                playBeep(440, 0.08, "triangle");
                onChange(mode.id);
              }}
              className={`${styles.tabBtn} ${isActive ? mode.activeClass : ""}`}
            >
              <span className={styles.tabIcon}>{mode.icon}</span>
              <span className={styles.labelShort}>{mode.shortLabel}</span>
              <span className={styles.labelFull}>{mode.fullLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
