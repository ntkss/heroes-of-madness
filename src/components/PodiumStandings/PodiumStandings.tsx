import React from "react";
import Image from "next/image";
import Link from "next/link";
import { SeasonPlayerStat } from "@/utils/firebase";
import styles from "./styles.module.css";

interface PodiumStandingsProps {
  firstPlace: SeasonPlayerStat | null;
  secondPlace: SeasonPlayerStat | null;
  thirdPlace: SeasonPlayerStat | null;
  lastPlace: SeasonPlayerStat | null;
}

export default function PodiumStandings({
  firstPlace,
  secondPlace,
  thirdPlace,
  lastPlace,
}: PodiumStandingsProps) {
  return (
    <div className={styles.podiumGrid}>
      {/* 2nd Place */}
      <div className={styles.podiumColumn}>
        {secondPlace && (
          <div className={styles.podiumHeader}>
            <div className={styles.secondPlaceAvatarWrapper}>
              <Image
                src={
                  secondPlace.avatar ||
                  `https://api.dicebear.com/9.x/pixel-art/svg?seed=${secondPlace.name.toLowerCase()}`
                }
                alt={secondPlace.name}
                fill
                className={styles.avatarImage}
                unoptimized
              />
            </div>
            <Link
              href={`/players/${secondPlace.id}`}
              className={`${styles.podiumName} hover:text-neon-yellow transition-colors cursor-pointer decoration-dotted hover:underline`}
            >
              {secondPlace.name}
            </Link>
            <span className={styles.podiumSub}>
              {secondPlace.wins}W - {secondPlace.losses}L
            </span>
            <span className={styles.podiumSub}>
              {secondPlace.winrate}% WR ({secondPlace.total_match_played}M)
            </span>
            {secondPlace.matchesToNextRank !== undefined && (
              <span className="text-[7px] text-neon-yellow mt-1 font-pixel uppercase tracking-wider">
                Needs {secondPlace.matchesToNextRank} win
                {secondPlace.matchesToNextRank > 1 ? "s" : ""} for Rank{" "}
                {secondPlace.nextRankTarget}
              </span>
            )}
          </div>
        )}
        <div className={styles.secondPlacePedestal}>
          <span className={styles.pedestalRankNumber}>2</span>
          <span className={styles.secondPlacePedestalLabel}>2ND PLACE</span>
        </div>
      </div>

      {/* 1st Place (Gold/Leader) */}
      <div className={`${styles.podiumColumn} order-first md:order-none`}>
        {firstPlace && (
          <div className={styles.podiumHeader}>
            <div className={styles.crownEmoji}>👑</div>
            <div className="relative">
              {/* Fire Effect */}
              <div className={styles.fireContainer}>
                <div className={styles.flame}></div>
                <div className={styles.flame}></div>
                <div className={styles.flame}></div>
                <div className={styles.flame}></div>
                <div className={styles.flame}></div>
              </div>
              <div className={styles.firstPlaceAvatarWrapper}>
                <Image
                  src={
                    firstPlace.avatar ||
                    `https://api.dicebear.com/9.x/pixel-art/svg?seed=${firstPlace.name.toLowerCase()}`
                  }
                  alt={firstPlace.name}
                  fill
                  className={styles.avatarImage}
                  unoptimized
                />
              </div>
            </div>
            <Link
              href={`/players/${firstPlace.id}`}
              className={`${styles.championName} hover:text-neon-yellow transition-colors cursor-pointer decoration-dotted hover:underline`}
            >
              {firstPlace.name}
            </Link>
            <span className={styles.championSub}>
              {firstPlace.wins}W - {firstPlace.losses}L
            </span>
            <span className={styles.championSub}>
              {firstPlace.winrate}% WR ({firstPlace.total_match_played}M)
            </span>
          </div>
        )}
        <div className={styles.firstPlacePedestal}>
          <span className={styles.championPedestalRankNumber}>1</span>
          <span className={styles.championPedestalLabel}>CHAMPION</span>
        </div>
      </div>

      {/* 3rd Place */}
      <div className={styles.podiumColumn}>
        {thirdPlace && (
          <div className={styles.podiumHeader}>
            <div className={styles.thirdPlaceAvatarWrapper}>
              <Image
                src={
                  thirdPlace.avatar ||
                  `https://api.dicebear.com/9.x/pixel-art/svg?seed=${thirdPlace.name.toLowerCase()}`
                }
                alt={thirdPlace.name}
                fill
                className={styles.avatarImage}
                unoptimized
              />
            </div>
            <Link
              href={`/players/${thirdPlace.id}`}
              className={`${styles.podiumName} hover:text-neon-yellow transition-colors cursor-pointer decoration-dotted hover:underline`}
            >
              {thirdPlace.name}
            </Link>
            <span className={styles.podiumSub}>
              {thirdPlace.wins}W - {thirdPlace.losses}L
            </span>
            <span className={styles.podiumSub}>
              {thirdPlace.winrate}% WR ({thirdPlace.total_match_played}M)
            </span>
            {thirdPlace.matchesToNextRank !== undefined && (
              <span className="text-[7px] text-neon-yellow mt-1 font-pixel uppercase tracking-wider">
                Needs {thirdPlace.matchesToNextRank} win
                {thirdPlace.matchesToNextRank > 1 ? "s" : ""} for Rank{" "}
                {thirdPlace.nextRankTarget}
              </span>
            )}
          </div>
        )}
        <div className={styles.thirdPlacePedestal}>
          <span className={styles.thirdPlacePedestalRankNumber}>3</span>
          <span className={styles.thirdPlacePedestalLabel}>3RD PLACE</span>
        </div>
      </div>

      {/* Wooden Spoon (Last Place) */}
      <div className={styles.podiumColumn}>
        {lastPlace && (
          <div className={styles.podiumHeader}>
            <div className={styles.spoonAvatarWrapper}>
              <Image
                src={
                  lastPlace.avatar ||
                  `https://api.dicebear.com/9.x/pixel-art/svg?seed=${lastPlace.name.toLowerCase()}`
                }
                alt={lastPlace.name}
                fill
                className={`${styles.avatarImage} grayscale`}
                unoptimized
              />
            </div>
            <Link
              href={`/players/${lastPlace.id}`}
              className={`${styles.spoonName} hover:text-neon-yellow transition-colors cursor-pointer decoration-dotted hover:underline`}
            >
              {lastPlace.name}
            </Link>
            <span className={styles.spoonSub}>
              {lastPlace.wins}W - {lastPlace.losses}L
            </span>
            <span className={styles.spoonSub}>
              {lastPlace.winrate}% WR ({lastPlace.total_match_played}M)
            </span>
            {lastPlace.matchesToNextRank !== undefined && (
              <span className="text-[7px] text-neon-yellow mt-1 font-pixel uppercase tracking-wider">
                Needs {lastPlace.matchesToNextRank} win
                {lastPlace.matchesToNextRank > 1 ? "s" : ""} for Rank{" "}
                {lastPlace.nextRankTarget}
              </span>
            )}
          </div>
        )}
        <div className={styles.spoonPedestal}>
          <span className={styles.spoonEmoji}>💩</span>
          <span className={styles.spoonPedestalLabel}>ที่โหล่</span>
        </div>
      </div>
    </div>
  );
}
