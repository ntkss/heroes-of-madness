"use client";

import React, { useState } from "react";
import Link from "next/link";
import CRTOverlay from "@/components/CRTOverlay";
import { useAuth } from "@/utils/AuthContext";
import { db, SeasonPlayerStat } from "@/utils/firebase";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  getDoc,
  DocumentData,
} from "firebase/firestore";

interface MigrationLog {
  type: "info" | "success" | "warning" | "error";
  message: string;
}

export default function MigratePage() {
  const { user, isAdmin, login } = useAuth();
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [targetId, setTargetId] = useState("p' chaa");
  const [newName, setNewName] = useState("chalawan");
  const [newId, setNewId] = useState("chalawan");
  const [previewData, setPreviewData] = useState<{
    playerFound: boolean;
    playerData: DocumentData | null;
    affectedMatches: string[];
    affectedSeasons: string[];
  } | null>(null);

  const addLog = (message: string, type: MigrationLog["type"] = "info") => {
    setLogs((prev) => [...prev, { type, message }]);
  };

  const checkImpact = async () => {
    const database = db;
    if (!database) {
      addLog("Firebase Database is not configured.", "error");
      return;
    }

    addLog(`Checking migration impact for player ID/Name: "${targetId}"...`);
    try {
      const lowerTarget = targetId.toLowerCase();

      // 1. Check Player Document
      const playerDocRef = doc(database, "players", targetId);
      const playerDocSnap = await getDoc(playerDocRef);

      // Also check lowercase version in case it was created differently
      const playerDocRefLower = doc(database, "players", lowerTarget);
      const playerDocSnapLower = await getDoc(playerDocRefLower);

      let found = false;
      let data: DocumentData | null = null;
      let actualDocId = targetId;

      if (playerDocSnap.exists()) {
        found = true;
        data = playerDocSnap.data();
        actualDocId = targetId;
        addLog(
          `Found player document with ID "${targetId}": "${data.name}"`,
          "success",
        );
      } else if (playerDocSnapLower.exists()) {
        found = true;
        data = playerDocSnapLower.data();
        actualDocId = lowerTarget;
        addLog(
          `Found player document with lowercase ID "${lowerTarget}": "${data.name}"`,
          "success",
        );
      } else {
        addLog(
          `Player document "${targetId}" or "${lowerTarget}" not found directly in Firestore. Will search dynamically in all players...`,
          "warning",
        );
        const playersSnap = await getDocs(collection(database, "players"));
        playersSnap.forEach((d) => {
          const p = d.data();
          if (
            d.id.toLowerCase() === lowerTarget ||
            p.name?.toLowerCase() === lowerTarget
          ) {
            found = true;
            data = p;
            actualDocId = d.id;
            addLog(
              `Found player dynamically under document ID "${d.id}": "${p.name}"`,
              "success",
            );
          }
        });
      }

      if (!found) {
        addLog(
          `No player record found for "${targetId}". We can still scan references.`,
          "warning",
        );
      }

      // 2. Scan Matches
      const matchesSnap = await getDocs(collection(database, "matches"));
      const affectedMatches: string[] = [];
      matchesSnap.forEach((d) => {
        const m = d.data();
        const hasTeamA = m.teamA?.some(
          (name: string) =>
            name.toLowerCase() === lowerTarget ||
            name.toLowerCase() === actualDocId.toLowerCase(),
        );
        const hasTeamB = m.teamB?.some(
          (name: string) =>
            name.toLowerCase() === lowerTarget ||
            name.toLowerCase() === actualDocId.toLowerCase(),
        );
        const hasWinner =
          m.winner?.toLowerCase() === lowerTarget ||
          m.winner?.toLowerCase() === actualDocId.toLowerCase();

        let hasFeedback = false;
        if (m.feedback) {
          const keys = Object.keys(m.feedback);
          if (
            keys.includes(actualDocId) ||
            keys.includes(lowerTarget) ||
            keys.some((k) => k.toLowerCase() === lowerTarget)
          ) {
            hasFeedback = true;
          }
        }

        if (hasTeamA || hasTeamB || hasWinner || hasFeedback) {
          affectedMatches.push(d.id);
        }
      });

      addLog(
        `Found ${affectedMatches.length} affected match logs.`,
        affectedMatches.length > 0 ? "info" : "success",
      );

      // 3. Scan Seasons
      const seasonsSnap = await getDocs(collection(database, "seasons"));
      const affectedSeasons: string[] = [];
      seasonsSnap.forEach((d) => {
        const s = d.data();
        const inPodium = s.podium?.some(
          (p: SeasonPlayerStat) =>
            p.id?.toLowerCase() === lowerTarget ||
            p.name?.toLowerCase() === lowerTarget,
        );
        const inLastPlace =
          s.lastPlace?.id?.toLowerCase() === lowerTarget ||
          s.lastPlace?.name?.toLowerCase() === lowerTarget;
        const inStats = s.fighterStats?.some(
          (p: SeasonPlayerStat) =>
            p.id?.toLowerCase() === lowerTarget ||
            p.name?.toLowerCase() === lowerTarget,
        );

        if (inPodium || inLastPlace || inStats) {
          affectedSeasons.push(d.id);
        }
      });

      addLog(
        `Found ${affectedSeasons.length} affected season records.`,
        affectedSeasons.length > 0 ? "info" : "success",
      );

      setPreviewData({
        playerFound: found,
        playerData: data,
        affectedMatches,
        affectedSeasons,
      });
    } catch (e) {
      const error = e as Error;
      addLog(`Error checking impact: ${error.message}`, "error");
    }
  };

  const runMigration = async () => {
    const database = db;
    if (!database) return;
    setIsMigrating(true);
    setLogs([]);
    addLog(
      `STARTING MIGRATION: "${targetId}" -> "${newId}" (${newName})`,
      "info",
    );

    try {
      const batch = writeBatch(database);
      const lowerTarget = targetId.toLowerCase();
      const lowerNewId = newId.toLowerCase();

      // 1. Migrate Player Document
      let actualOldDocId = targetId;
      let playerDocData: DocumentData | null = null;

      // Find correct old document
      const docRef1 = doc(database, "players", targetId);
      const snap1 = await getDoc(docRef1);
      const docRef2 = doc(database, "players", lowerTarget);
      const snap2 = await getDoc(docRef2);

      if (snap1.exists()) {
        playerDocData = snap1.data();
        actualOldDocId = targetId;
      } else if (snap2.exists()) {
        playerDocData = snap2.data();
        actualOldDocId = lowerTarget;
      } else {
        // dynamic search
        const playersSnap = await getDocs(collection(database, "players"));
        playersSnap.forEach((d) => {
          if (
            d.id.toLowerCase() === lowerTarget ||
            d.data().name?.toLowerCase() === lowerTarget
          ) {
            playerDocData = d.data();
            actualOldDocId = d.id;
          }
        });
      }

      if (playerDocData) {
        addLog(
          `Copying player document "${actualOldDocId}" -> "${lowerNewId}"...`,
        );
        const newPlayerRef = doc(database, "players", lowerNewId);

        const updatedPlayerData = {
          ...playerDocData,
          name: newName,
          alias: lowerNewId,
        };

        batch.set(newPlayerRef, updatedPlayerData);
        addLog(
          `Scheduling delete of old player document "${actualOldDocId}"...`,
        );
        batch.delete(doc(database, "players", actualOldDocId));
      } else {
        addLog(
          `No source player document found under "${targetId}" to migrate. Creating new document instead...`,
          "warning",
        );
        const newPlayerRef = doc(database, "players", lowerNewId);
        batch.set(newPlayerRef, {
          name: newName,
          alias: lowerNewId,
          avatar: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${lowerNewId}&backgroundColor=1a1a2e`,
          current_rank: "Unranked",
          highest_rank: "Unranked",
          role: "ALL-ROUNDER",
          winrate: 0,
          total_match_played: 0,
          createdAt: Date.now(),
          allTimeWins: 0,
          allTimeMatches: 0,
          allTimeWinrate: 0,
        });
      }

      // 2. Migrate Match Logs
      addLog("Scanning matches for references...");
      const matchesSnap = await getDocs(collection(database, "matches"));
      let matchesUpdated = 0;

      matchesSnap.forEach((matchDoc) => {
        const m = matchDoc.data();
        let changed = false;

        // Update Team A
        const newTeamA = m.teamA?.map((name: string) => {
          if (
            name.toLowerCase() === lowerTarget ||
            name.toLowerCase() === actualOldDocId.toLowerCase()
          ) {
            changed = true;
            return newName; // Replace name/id with new name
          }
          return name;
        });

        // Update Team B
        const newTeamB = m.teamB?.map((name: string) => {
          if (
            name.toLowerCase() === lowerTarget ||
            name.toLowerCase() === actualOldDocId.toLowerCase()
          ) {
            changed = true;
            return newName; // Replace name/id with new name
          }
          return name;
        });

        // Update Winner
        let newWinner = m.winner;
        if (
          m.winner?.toLowerCase() === lowerTarget ||
          m.winner?.toLowerCase() === actualOldDocId.toLowerCase()
        ) {
          changed = true;
          newWinner =
            m.winner === "teamA" || m.winner === "teamB" ? m.winner : newName;
        }

        // Update Feedback
        const newFeedback = m.feedback ? { ...m.feedback } : undefined;
        if (m.feedback) {
          const oldFeedbackKeys = Object.keys(m.feedback);
          const oldKey = oldFeedbackKeys.find(
            (k) =>
              k.toLowerCase() === lowerTarget ||
              k.toLowerCase() === actualOldDocId.toLowerCase(),
          );

          if (oldKey) {
            changed = true;
            const voteData = m.feedback[oldKey];
            newFeedback[lowerNewId] = voteData;
            delete newFeedback[oldKey];
          }
        }

        if (changed) {
          batch.update(doc(database, "matches", matchDoc.id), {
            teamA: newTeamA,
            teamB: newTeamB,
            winner: newWinner,
            ...(newFeedback ? { feedback: newFeedback } : {}),
          });
          matchesUpdated++;
          addLog(`Scheduled updates for match ID "${matchDoc.id}"`, "success");
        }
      });

      addLog(`Total matches updated in transaction batch: ${matchesUpdated}`);

      // 3. Migrate Season Logs
      addLog("Scanning seasons for references...");
      const seasonsSnap = await getDocs(collection(database, "seasons"));
      let seasonsUpdated = 0;

      seasonsSnap.forEach((seasonDoc) => {
        const s = seasonDoc.data();
        let changed = false;

        const updateStatArray = (arr: SeasonPlayerStat[] | undefined) => {
          if (!arr) return arr;
          return arr.map((p) => {
            if (
              p.id?.toLowerCase() === lowerTarget ||
              p.id?.toLowerCase() === actualOldDocId.toLowerCase() ||
              p.name?.toLowerCase() === lowerTarget
            ) {
              changed = true;
              return {
                ...p,
                id: lowerNewId,
                name: newName,
                alias: lowerNewId,
              };
            }
            return p;
          });
        };

        const newPodium = updateStatArray(s.podium);
        const newStats = updateStatArray(s.fighterStats);

        let newLastPlace = s.lastPlace;
        if (
          s.lastPlace?.id?.toLowerCase() === lowerTarget ||
          s.lastPlace?.id?.toLowerCase() === actualOldDocId.toLowerCase() ||
          s.lastPlace?.name?.toLowerCase() === lowerTarget
        ) {
          changed = true;
          newLastPlace = {
            ...s.lastPlace,
            id: lowerNewId,
            name: newName,
            alias: lowerNewId,
          };
        }

        if (changed) {
          batch.update(doc(database, "seasons", seasonDoc.id), {
            podium: newPodium,
            fighterStats: newStats,
            lastPlace: newLastPlace,
          });
          seasonsUpdated++;
          addLog(
            `Scheduled updates for season document ID "${seasonDoc.id}"`,
            "success",
          );
        }
      });

      addLog(`Total season archives updated in batch: ${seasonsUpdated}`);

      // Commit transaction
      addLog("Committing migration transaction batch to Firestore...");
      await batch.commit();
      addLog("Firestore migration committed successfully!", "success");

      // Clear LocalStorage cache to force refresh
      if (typeof window !== "undefined") {
        addLog("Clearing local storage caches...");
        localStorage.removeItem("mlbb_generator_players");
        localStorage.removeItem("mlbb_generator_matches");
        localStorage.removeItem("mlbb_generator_seasons");
        addLog(
          "Local caches cleared. Database stats will reload automatically on next visit.",
          "success",
        );
      }

      addLog("MIGRATION COMPLETE!", "success");
    } catch (e) {
      const error = e as Error;
      addLog(`MIGRATION FAILED: ${error.message}`, "error");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <CRTOverlay>
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-mono">
        <div className="max-w-4xl mx-auto border-4 border-double border-red-500/50 bg-black/80 p-8 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <h1 className="text-2xl font-black text-red-500 mb-6 uppercase tracking-wider text-center select-none animate-pulse">
            ⚔️ Database Migration Utility ⚔️
          </h1>

          <div className="bg-slate-900/80 border border-slate-800 p-4 mb-6 text-sm leading-relaxed">
            <p className="text-yellow-400 font-bold mb-2">Instructions:</p>
            <p>
              Use this dashboard to rename a player ID / Name in Firestore. This
              tool will:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
              <li>
                Find and rename the player document in{" "}
                <code className="text-red-300">players</code>
              </li>
              <li>
                Scan and replace the name in all matching{" "}
                <code className="text-red-300">matches</code> rosters
              </li>
              <li>Move and aggregate feedback counts to the new key</li>
              <li>
                Update archived stats in{" "}
                <code className="text-red-300">seasons</code>
              </li>
              <li>Invalidate browser localStorage caches</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs uppercase text-slate-400 mb-1">
                Target ID / Name
              </label>
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 outline-none focus:border-red-500"
                placeholder="e.g. p' chaa"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-slate-400 mb-1">
                New Display Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 outline-none focus:border-red-500"
                placeholder="e.g. Chalawan"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-slate-400 mb-1">
                New Document ID
              </label>
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-3 py-2 text-slate-200 outline-none focus:border-red-500"
                placeholder="e.g. chalawan"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={checkImpact}
              disabled={isMigrating}
              className="px-6 py-3 bg-blue-950 border border-blue-500 hover:bg-blue-900 text-blue-300 font-bold uppercase transition-all duration-100 disabled:opacity-50 cursor-pointer"
            >
              🔍 Dry Run / Preview
            </button>

            {isAdmin ? (
              <button
                onClick={runMigration}
                disabled={isMigrating}
                className="px-6 py-3 bg-red-950 border border-red-500 hover:bg-red-900 text-red-300 font-bold uppercase transition-all duration-100 disabled:opacity-50 cursor-pointer"
              >
                🚀 Run Migration
              </button>
            ) : user ? (
              <div className="flex items-center text-xs text-rose-500 border border-rose-900 bg-rose-950/20 px-4 py-2 font-bold uppercase">
                ⚠️ Admin privileges required to execute migration
              </div>
            ) : (
              <button
                onClick={login}
                className="px-6 py-3 bg-rose-950 border border-rose-500 hover:bg-rose-900 text-rose-300 font-bold uppercase transition-all duration-100 cursor-pointer"
              >
                🔑 Log In to Authorize
              </button>
            )}
          </div>

          {previewData && (
            <div className="border border-slate-800 bg-slate-950 p-4 mb-6 text-xs">
              <h3 className="font-bold text-yellow-400 mb-2 uppercase">
                Migration Preview:
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p>
                    Player Document Found:{" "}
                    <span
                      className={
                        previewData.playerFound
                          ? "text-emerald-400"
                          : "text-rose-500"
                      }
                    >
                      {previewData.playerFound ? "YES" : "NO"}
                    </span>
                  </p>
                  {previewData.playerFound && (
                    <ul className="list-disc list-inside ml-2 mt-1 text-slate-400">
                      <li>Name: {previewData.playerData?.name}</li>
                      <li>Role: {previewData.playerData?.role}</li>
                      <li>
                        Matches Played:{" "}
                        {previewData.playerData?.total_match_played}
                      </li>
                    </ul>
                  )}
                </div>
                <div>
                  <p>
                    Affected Match Logs:{" "}
                    <span className="text-cyan-400 font-bold">
                      {previewData.affectedMatches.length}
                    </span>
                  </p>
                  <p>
                    Affected Season Records:{" "}
                    <span className="text-cyan-400 font-bold">
                      {previewData.affectedSeasons.length}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border border-slate-800 bg-black/90 p-4">
            <h3 className="text-xs uppercase text-slate-400 mb-2 font-bold tracking-widest">
              Console Output Log
            </h3>
            <div className="h-64 overflow-y-auto font-mono text-xs space-y-1.5 pr-2 select-text text-slate-300">
              {logs.length === 0 ? (
                <p className="text-slate-600">
                  Console idle. Click &quot;Dry Run&quot; or &quot;Run
                  Migration&quot; to start...
                </p>
              ) : (
                logs.map((log, idx) => {
                  let colorClass = "text-slate-300";
                  if (log.type === "success")
                    colorClass = "text-emerald-400 font-semibold";
                  if (log.type === "warning") colorClass = "text-yellow-400";
                  if (log.type === "error")
                    colorClass = "text-rose-500 font-bold";
                  return (
                    <div key={idx} className={`${colorClass} leading-relaxed`}>
                      [{new Date().toLocaleTimeString()}] {log.message}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 text-center text-xs">
            <Link href="/" className="text-cyan-400 hover:underline">
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </CRTOverlay>
  );
}
