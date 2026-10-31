"use client";

import React, { useState } from "react";
import pkg from "../../../package.json";
import styles from "./styles.module.css";
import { seedMockData, clearMockData } from "@/utils/firebase";
import { playCoin, playBeep } from "@/utils/audio";

export default function DebugBar() {
  const [loading, setLoading] = useState(false);

  const handleSeed = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    playCoin();
    try {
      await seedMockData();
      playBeep(523, 0.2, "sine");
      window.location.reload();
    } catch (err) {
      console.error("Failed to seed mock data:", err);
      alert("Failed to seed mock data: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    if (!window.confirm("Are you sure you want to clear seeded mock data?"))
      return;
    setLoading(true);
    playBeep(220, 0.2, "sawtooth");
    try {
      await clearMockData();
      window.location.reload();
    } catch (err) {
      console.error("Failed to clear mock data:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className={styles.versionBadge} aria-label="App Version & Dev Tools">
      <span>v{pkg.version}</span>
      <button
        type="button"
        onClick={handleSeed}
        disabled={loading}
        className={styles.seedBtn}
        title="Seed complete mock data (Underdog matches, badges, podiums, players) for UI inspection"
      >
        {loading ? "..." : "🧪 SEED MOCK"}
      </button>
      <button
        type="button"
        onClick={handleClear}
        disabled={loading}
        className={styles.clearBtn}
        title="Clear seeded mock data"
      >
        ✕ RESET
      </button>
    </aside>
  );
}
