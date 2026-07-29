"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { fetchPlayers, fetchMatches, DbPlayer, Match } from "@/utils/firebase";

// Custom component to fetch and render player mention badge
export function PlayerMentionBadge({ playerId }: { playerId: string }) {
  const [player, setPlayer] = useState<DbPlayer | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await fetchPlayers();
        const found = list.find(
          (p) =>
            p.id.toLowerCase() === playerId.toLowerCase() ||
            p.name.toLowerCase() === playerId.toLowerCase(),
        );
        if (found) setPlayer(found);
      } catch (e) {
        console.error("Error fetching player for mention:", e);
      }
    };
    load();
  }, [playerId]);

  return (
    <Link
      href={`/players/${playerId}`}
      className="inline-flex items-center gap-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 px-1.5 py-0.5 rounded-none font-tech text-[11px] uppercase tracking-wide hover:bg-sky-500 hover:text-black transition-all duration-150 select-none mx-0.5 align-middle font-semibold"
    >
      <span className="text-[10px]">👤</span>
      <span>{player ? player.name : playerId}</span>
    </Link>
  );
}

// Custom component to fetch and render match mention badge with interactive modal
export function MatchMentionBadge({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (matchId.startsWith("local_")) {
          // Fallback for local storage matches
          const stored = localStorage.getItem("mlbb_generator_matches");
          if (stored) {
            const list = JSON.parse(stored) as Match[];
            const found = list.find((m) => m.id === matchId);
            if (found) setMatch(found);
          }
        } else {
          const list = await fetchMatches();
          const found = list.find((m) => m.id === matchId);
          if (found) setMatch(found);
        }
      } catch (e) {
        console.error("Error fetching match for mention:", e);
      }
    };
    load();
  }, [matchId]);

  if (!match) {
    return (
      <span className="inline-flex items-center gap-1 bg-slate-800/80 border border-slate-700 text-slate-500 px-1.5 py-0.5 rounded-none font-tech text-[11px] mx-0.5 align-middle select-none">
        🎮 MATCH {matchId.substring(0, 6)}
      </span>
    );
  }

  const dateStr = new Date(match.createdAt).toLocaleDateString();

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDetail(true)}
        className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 rounded-none font-tech text-[11px] uppercase tracking-wide hover:bg-rose-500 hover:text-black transition-all duration-150 cursor-pointer select-none mx-0.5 align-middle font-semibold"
      >
        <span>⚔️</span>
        <span>MATCH vs ({dateStr})</span>
      </button>

      {showDetail && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 font-tech animate-fade-in">
          <div className="bg-[#101016] border-2 border-rose-500 p-6 max-w-md w-full relative shadow-[0_0_30px_rgba(244,63,94,0.4)]">
            <button
              type="button"
              onClick={() => setShowDetail(false)}
              className="absolute top-3 right-3 text-rose-500 hover:text-white font-pixel text-xs cursor-pointer transition-colors"
            >
              ✕ CLOSE
            </button>
            <h3 className="text-[#ffd200] text-base font-pixel mb-5 text-center tracking-wider glow-yellow select-none">
              MATCH HISTORIC DATA
            </h3>

            <div className="grid grid-cols-2 gap-4 text-center mb-6">
              {/* Blue Team */}
              <div className="border border-sky-500/30 bg-sky-500/5 p-3">
                <h4 className="text-sky-400 font-bold text-xs tracking-widest border-b border-sky-500/20 pb-1 mb-2">
                  BLUE TEAM
                </h4>
                <ul className="text-xs space-y-1.5 text-slate-300">
                  {match.teamA.map((p, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between items-center text-[11px]"
                    >
                      <span className="font-semibold">{p}</span>
                      <span className="text-slate-500 font-mono text-[9px] uppercase bg-slate-900 px-1 py-0.5">
                        {match.teamALanes?.[idx] || "ALL"}
                      </span>
                    </li>
                  ))}
                </ul>
                {match.winner === "teamA" && (
                  <div className="mt-3 text-[#ffd200] text-[9px] font-pixel border border-[#ffd200]/30 bg-[#ffd200]/10 py-1 tracking-wider uppercase animate-pulse">
                    🏆 VICTORY
                  </div>
                )}
              </div>

              {/* Red Team */}
              <div className="border border-rose-500/30 bg-rose-500/5 p-3">
                <h4 className="text-rose-400 font-bold text-xs tracking-widest border-b border-rose-500/20 pb-1 mb-2">
                  RED TEAM
                </h4>
                <ul className="text-xs space-y-1.5 text-slate-300">
                  {match.teamB.map((p, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between items-center text-[11px]"
                    >
                      <span className="font-semibold">{p}</span>
                      <span className="text-slate-500 font-mono text-[9px] uppercase bg-slate-900 px-1 py-0.5">
                        {match.teamBLanes?.[idx] || "ALL"}
                      </span>
                    </li>
                  ))}
                </ul>
                {match.winner === "teamB" && (
                  <div className="mt-3 text-[#ffd200] text-[9px] font-pixel border border-[#ffd200]/30 bg-[#ffd200]/10 py-1 tracking-wider uppercase animate-pulse">
                    🏆 VICTORY
                  </div>
                )}
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-400 border-t border-slate-800 pt-4 space-y-0.5">
              <p>MATCH UNIQUE ID: {match.id}</p>
              <p>RECORDED TIME: {new Date(match.createdAt).toLocaleString()}</p>
              <p className="text-rose-400 font-semibold mt-1">
                SEASON RUN: #{match.seasonId || 1}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Function to parse the description and inject mention badges
export function parseMentions(text: string): React.ReactNode[] {
  if (!text) return [];

  const regex = /@(player|match):([\w\d_-]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const type = match[1];
    const id = match[2];

    // Push text before mention
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // Push mention badge
    if (type === "player") {
      parts.push(
        <PlayerMentionBadge key={`player-${id}-${matchIndex}`} playerId={id} />,
      );
    } else if (type === "match") {
      parts.push(
        <MatchMentionBadge key={`match-${id}-${matchIndex}`} matchId={id} />,
      );
    }

    lastIndex = regex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}
