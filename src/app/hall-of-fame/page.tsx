"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import CRTOverlay from "@/components/CRTOverlay";
import DebugBar from "@/components/DebugBar";
import styles from "./styles.module.css";
import {
  Season,
  DbPlayer,
  SeasonPlayerStat,
  fetchSeasons,
  fetchPlayers,
  fetchSeasonConfig,
} from "@/utils/firebase";
import { playBeep } from "@/utils/audio";

interface FameCardData {
  year: number;
  seasonId: number;
  seasonName: string;
  championId?: string;
  championName: string;
  championAvatar?: string;
  winrate: number;
  wins: number;
  losses: number;
  totalMatches: number;
  rankName?: string;
  isCurrentSeason?: boolean;
}

export default function HallOfFamePage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<number>(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [archiveSeasons, playerList, seasonCfg] = await Promise.all([
          fetchSeasons(),
          fetchPlayers(),
          fetchSeasonConfig(),
        ]);

        setSeasons(archiveSeasons);
        setPlayers(playerList);
        setActiveSeasonId(seasonCfg.activeSeasonId);
      } catch (err) {
        console.error("Failed to load Hall of Fame data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Compute Hall of Fame cards grouped by Year
  const yearGroupedCards = React.useMemo(() => {
    const fameCards: FameCardData[] = [];

    // Helper to get player info by name or ID
    const getPlayerInfo = (playerName: string, statId?: string) => {
      const found = players.find(
        (p) =>
          p.name.toLowerCase() === playerName.toLowerCase() ||
          p.id.toLowerCase() === playerName.toLowerCase(),
      );
      return {
        id: found?.id || statId || playerName.toLowerCase(),
        avatar:
          found?.avatar ||
          `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(
            playerName,
          )}&backgroundColor=101016`,
      };
    };

    // 1. Process archived seasons
    seasons.forEach((season) => {
      const year = season.startDate
        ? new Date(season.startDate).getFullYear()
        : new Date().getFullYear();

      // Find champion from podium[0] or fighterStats[0]
      let championStat: SeasonPlayerStat | null = null;
      if (season.podium && season.podium.length > 0) {
        championStat = season.podium[0];
      } else if (season.fighterStats && season.fighterStats.length > 0) {
        // Sort fighter stats by winrate descending
        const sorted = [...season.fighterStats].sort(
          (a, b) => (b.winrate || 0) - (a.winrate || 0),
        );
        championStat = sorted[0];
      }

      if (championStat && championStat.name) {
        const totalMatches =
          championStat.total_match_played ||
          (championStat.wins || 0) + (championStat.losses || 0) ||
          0;
        const winrate = championStat.winrate || 0;

        let wins = championStat.wins;
        let losses = championStat.losses;
        if (wins === undefined || losses === undefined) {
          wins = Math.round((winrate / 100) * totalMatches);
          losses = Math.max(0, totalMatches - wins);
        }

        const pInfo = getPlayerInfo(championStat.name, championStat.id);

        fameCards.push({
          year,
          seasonId: season.id,
          seasonName: season.name || `Season ${season.id}`,
          championId: pInfo.id,
          championName: championStat.name,
          championAvatar: pInfo.avatar,
          winrate,
          wins,
          losses,
          totalMatches,
          rankName: championStat.current_rank || "GRAND CHAMPION",
          isCurrentSeason: false,
        });
      }
    });

    // Sort cards by seasonId descending
    fameCards.sort((a, b) => b.seasonId - a.seasonId);

    // Group cards by Year
    const grouped: Record<number, FameCardData[]> = {};
    fameCards.forEach((card) => {
      if (!grouped[card.year]) {
        grouped[card.year] = [];
      }
      grouped[card.year].push(card);
    });

    return grouped;
  }, [seasons, players]);

  const years = Object.keys(yearGroupedCards)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <>
      {/* Top-Left Floating Season Ribbon Badge */}
      <div className="fixed top-0 left-0 z-[100] flex items-center gap-1.5 bg-[#ffd200] border-r-2 border-b-2 border-white text-black font-pixel text-[10px] font-bold px-3.5 py-1 uppercase tracking-wider shadow-[0_4px_20px_rgba(255,210,0,0.6)] rounded-br-sm select-none">
        <span className="text-xs">🏆</span>
        <span>SEASON {activeSeasonId}</span>
      </div>

      <CRTOverlay>
        <div className={styles.container}>
          {/* Navigation Breadcrumbs */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className={styles.backLink}
              onClick={() => playBeep(200, 0.1, "sine")}
            >
              ◀ BACK TO ARENA
            </Link>

            <Link
              href="/seasons"
              className={styles.backLink}
              onClick={() => playBeep(300, 0.1, "sawtooth")}
            >
              🏆 SEASONS ARCHIVE ▶
            </Link>
          </div>

          {/* Header Banner */}
          <header className={styles.header}>
            <div className={styles.headerGlowLine} />
            <div className="flex flex-col items-center md:items-start text-center md:text-left select-none">
              <h1 className={styles.title}>
                <span>👑</span> HALL OF FAME
              </h1>
              <p className={styles.subtitle}>
                VICTORY SANCTUARY • LEGENDARY CHAMPIONS BY YEAR
              </p>
            </div>
          </header>

          {/* Content Section */}
          {loading ? (
            <div className="text-center font-pixel text-xs text-amber-400 py-24 animate-pulse select-none">
              LOADING HALL OF FAME RECORDS...
            </div>
          ) : years.length === 0 ? (
            <div className="text-center text-slate-500 font-pixel text-[11px] border border-dashed border-amber-500/30 py-20 uppercase bg-slate-950/60">
              NO CHAMPIONS RECORDED YET. BATTLE IN ARENA TO CLAIM THE CROWN!
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {years.map((year) => (
                <div key={year} className={styles.yearSection}>
                  {/* Year Header */}
                  <div className={styles.yearHeader}>
                    <h2 className={styles.yearTitle}>
                      <span>✨</span> YEAR {year}
                    </h2>
                    <span className="text-[10px] font-mono text-amber-400/70 uppercase">
                      {yearGroupedCards[year].length} CHAMPION
                      {yearGroupedCards[year].length > 1 ? "S" : ""}
                    </span>
                  </div>

                  {/* Horizontal Scrollable Fame Cards Track */}
                  <div className={styles.cardsTrack}>
                    {yearGroupedCards[year].map((card) => (
                      <Link
                        key={card.seasonId}
                        href={`/players/${encodeURIComponent(card.championId || card.championName)}`}
                        className={styles.fameCard}
                        onClick={() => playBeep(400, 0.1, "sine")}
                      >
                        {/* Full Card Background Avatar Image */}
                        <img
                          src={card.championAvatar}
                          alt={card.championName}
                          className={styles.cardAvatarImage}
                        />

                        {/* Gradient Overlay for Readability */}
                        <div className={styles.overlayGradient} />

                        {/* Crown Badge */}
                        <div className={styles.crownBadge}>👑</div>

                        {/* Card Header Badges */}
                        <div className={styles.fameCardHeader}>
                          <span className={styles.yearBadge}>{card.year}</span>
                          <span className={styles.seasonBadge}>
                            {card.seasonName}
                          </span>
                        </div>

                        {/* Bottom Footer Overlay */}
                        <div className={styles.cardFooter}>
                          <h3 className={styles.playerName}>
                            {card.championName}
                          </h3>
                          <p className={styles.championTitle}>
                            🏆 SEASON CHAMPION
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CRTOverlay>

      <DebugBar />
    </>
  );
}
