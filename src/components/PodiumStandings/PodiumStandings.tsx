import React from "react";
import Image from "next/image";
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
            <span className={styles.podiumName}>{secondPlace.name}</span>
            <span className={styles.podiumSub}>
              {secondPlace.winrate}% WR ({secondPlace.total_match_played}M)
            </span>
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
            <span className={styles.championName}>{firstPlace.name}</span>
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
            <span className={styles.podiumName}>{thirdPlace.name}</span>
            <span className={styles.podiumSub}>
              {thirdPlace.winrate}% WR ({thirdPlace.total_match_played}M)
            </span>
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
            <span className={styles.spoonName}>{lastPlace.name}</span>
            <span className={styles.spoonSub}>
              {lastPlace.winrate}% WR ({lastPlace.total_match_played}M)
            </span>
          </div>
        )}
        <div className={styles.spoonPedestal}>
          <span className={styles.spoonEmoji}>🥄</span>
          <span className={styles.spoonPedestalLabel}>WOODEN SPOON</span>
        </div>
      </div>
    </div>
  );
}
