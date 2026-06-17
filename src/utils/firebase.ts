import { initializeApp, getApps } from "firebase/app";
import { SQUAD } from "@/constants/players";
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  limit,
  Firestore,
} from "firebase/firestore";

export interface Match {
  id: string;
  createdAt: number;
  teamA: string[];
  teamB: string[];
  winner: "teamA" | "teamB" | null;
}

export interface DbPlayer {
  id: string;
  name: string;
  alias: string;
  avatar: string;
  imageURL?: string;
  winrate: number;
  current_rank: string;
  highest_rank: string;
  total_match_played: number;
  role?: string;
  createdAt?: number;
}

export interface RankConfig {
  minMatches: number;
  highTierWinrate: number;
  lowTierWinrate: number;
  tiers: {
    high: string;
    normal: string;
    low: string;
  };
}

export const DEFAULT_RANK_CONFIG: RankConfig = {
  minMatches: 3,
  highTierWinrate: 55,
  lowTierWinrate: 45,
  tiers: {
    high: "คนเก่ง",
    normal: "คนปกติ",
    low: "คนกาก",
  },
};

const LOCAL_CONFIG_KEY = "mlbb_generator_rank_config";

const isDev = process.env.NODE_ENV === "development";

// Check if all essential Firebase variables are defined in the environment
// In development, always use LocalStorage to avoid polluting production data
export const isFirebaseConfigured =
  !isDev &&
  !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );

if (isDev) {
  console.log(
    "🛠️ Development mode — using LocalStorage only (Firebase disabled).",
  );
} else {
  console.log("🔍 [Firebase Diagnostic] Keys resolved:", {
    apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    isFirebaseConfigured,
  });
}

let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    // Prevent double-initialization in Next.js Hot Module Replacement (HMR)
    const app =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    console.log("🔥 Firebase initialized successfully!");
  } catch (error) {
    console.error(
      "❌ Firebase initialization error, falling back to LocalStorage:",
      error,
    );
  }
} else if (!isDev) {
  console.log(
    "💾 Firebase environment variables missing. Operating in offline LocalStorage mode.",
  );
}

const LOCAL_STORAGE_KEY = "mlbb_generator_matches";

// --- Database Interface Functions ---

// Fetch matches (ordered by createdAt descending, capped at 50 for performance)
export async function fetchMatches(): Promise<Match[]> {
  if (db) {
    try {
      const matchesCol = collection(db, "matches");
      const q = query(matchesCol, orderBy("createdAt", "desc"), limit(50));
      const querySnapshot = await getDocs(q);

      const list: Match[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          createdAt: data.createdAt || Date.now(),
          teamA: data.teamA || [],
          teamB: data.teamB || [],
          winner: data.winner !== undefined ? data.winner : null,
        });
      });
      return list;
    } catch (e) {
      console.error(
        "Error fetching from Firestore, switching to LocalStorage:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return [];
  try {
    const list = JSON.parse(stored) as Match[];
    // Sort descending by date
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// Save a new match
export async function saveMatch(matchData: Omit<Match, "id">): Promise<Match> {
  const newMatch: Match = {
    ...matchData,
    id: db
      ? ""
      : `local_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
  };

  if (db) {
    try {
      const matchesCol = collection(db, "matches");
      const docRef = await addDoc(matchesCol, newMatch);
      newMatch.id = docRef.id;
      return newMatch;
    } catch (e) {
      console.error(
        "Error writing to Firestore, saving to LocalStorage instead:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list = stored ? (JSON.parse(stored) as Match[]) : [];
    list.push(newMatch);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  }
  return newMatch;
}

// Mark match winner
export async function updateMatchWinner(
  matchId: string,
  winner: "teamA" | "teamB" | null,
): Promise<boolean> {
  let success = false;
  if (db && !matchId.startsWith("local_")) {
    try {
      const docRef = doc(db, "matches", matchId);
      await updateDoc(docRef, { winner });
      success = true;
    } catch (e) {
      console.error(
        "Error updating Firestore match, updating LocalStorage instead:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (!success && typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const list = JSON.parse(stored) as Match[];
      const idx = list.findIndex((m) => m.id === matchId);
      if (idx !== -1) {
        list[idx].winner = winner;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        success = true;
      }
    }
  }

  if (success) {
    await recalculateRanks();
  }
  return success;
}

// Delete match from history
export async function deleteMatch(matchId: string): Promise<boolean> {
  let success = false;
  if (db && !matchId.startsWith("local_")) {
    try {
      const docRef = doc(db, "matches", matchId);
      await deleteDoc(docRef);
      success = true;
    } catch (e) {
      console.error(
        "Error deleting from Firestore, deleting from LocalStorage instead:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (!success && typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      let list = JSON.parse(stored) as Match[];
      const originalLen = list.length;
      list = list.filter((m) => m.id !== matchId);
      if (list.length < originalLen) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        success = true;
      }
    }
  }

  if (success) {
    await recalculateRanks();
  }
  return success;
}

const LOCAL_PLAYERS_KEY = "mlbb_generator_players";

// Fetch players (loaded from Firestore, falls back to LocalStorage, seeds with SQUAD if empty)
export async function fetchPlayers(): Promise<DbPlayer[]> {
  const list: DbPlayer[] = [];

  if (db) {
    try {
      const playersCol = collection(db, "players");
      const q = query(playersCol, orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();

        const avatarVal = data.avatar || data.imageURL || "";
        list.push({
          id: docSnap.id,
          name: data.name || "",
          alias: data.alias || "",
          avatar: avatarVal,
          imageURL: avatarVal,
          winrate: Number(data.winrate) || 0,
          current_rank: data.current_rank || "Epic",
          highest_rank: data.highest_rank || "Epic",
          total_match_played: Number(data.total_match_played) || 0,
          role: data.role || "ALL-ROUNDER",
          createdAt: data.createdAt || Date.now(),
        });
      });

      if (list.length > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(list));
        }
        return list;
      }

      console.log(
        "Firestore players collection is empty. Seeding initial squad to Firestore...",
      );

      const seedList: DbPlayer[] = SQUAD.map((p) => {
        const avatarVal =
          p.imageURL ||
          `https://api.dicebear.com/9.x/pixel-art/svg?seed=${p.id}&backgroundColor=1a1a2e`;
        return {
          id: p.id,
          name: p.name,
          alias: p.id,
          avatar: avatarVal,
          imageURL: avatarVal,
          winrate: 0,
          current_rank: "Legend",
          highest_rank: "Legend",
          total_match_played: 0,
          role: "ALL-ROUNDER",
          createdAt: Date.now(),
        };
      });

      for (const player of seedList) {
        const docRef = doc(db, "players", player.id);
        await setDoc(docRef, {
          name: player.name,
          alias: player.alias,
          avatar: player.avatar,
          winrate: player.winrate,
          current_rank: player.current_rank,
          highest_rank: player.highest_rank,
          total_match_played: player.total_match_played,
          role: player.role,
          createdAt: player.createdAt,
        });
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(seedList));
      }
      return seedList;
    } catch (e) {
      console.error(
        "Error fetching/seeding players on Firestore, switching to LocalStorage:",
        e,
      );
    }
  }

  // LocalStorage Fallback (or if Firestore is empty)
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_PLAYERS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as DbPlayer[];
        if (parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Ignore parsing errors and re-initialize
      }
    }

    // Seed initial squad players
    const seedList: DbPlayer[] = SQUAD.map((p) => {
      const avatarVal =
        p.imageURL ||
        `https://api.dicebear.com/9.x/pixel-art/svg?seed=${p.id}&backgroundColor=1a1a2e`;
      return {
        id: p.id,
        name: p.name,
        alias: p.id,
        avatar: avatarVal,
        imageURL: avatarVal,
        winrate: 0,
        current_rank: "Legend",
        highest_rank: "Legend",
        total_match_played: 0,
        role: "ALL-ROUNDER",
        createdAt: Date.now(),
      };
    });

    localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(seedList));
    return seedList;
  }

  return [];
}

// Save a new player to database
export async function savePlayer(
  playerData: Omit<DbPlayer, "id">,
): Promise<DbPlayer> {
  const nameTrimmed = (playerData.name || "").trim();
  if (!nameTrimmed) {
    throw new Error("FIGHTER NAME CANNOT BE EMPTY!");
  }
  const docId = nameTrimmed.toLowerCase();
  const cleanAvatar = playerData.avatar || playerData.imageURL || "";

  const firestoreData = {
    name: nameTrimmed,
    alias: playerData.alias || docId,
    avatar: cleanAvatar,
    winrate: Number(playerData.winrate) || 0,
    current_rank: playerData.current_rank,
    highest_rank: playerData.highest_rank,
    total_match_played: Number(playerData.total_match_played) || 0,
    role: playerData.role || "ALL-ROUNDER",
    createdAt: Date.now(),
  };

  const id = docId;
  const newPlayer: DbPlayer = {
    ...firestoreData,
    id,
    avatar: cleanAvatar,
    imageURL: cleanAvatar,
  };

  if (db) {
    try {
      const docRef = doc(db, "players", docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        throw new Error("FIGHTER NAME ALREADY EXISTS!");
      }

      await setDoc(docRef, firestoreData);

      // Update local storage too to keep in sync
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(LOCAL_PLAYERS_KEY);
        const list = stored ? (JSON.parse(stored) as DbPlayer[]) : [];
        const filteredList = list.filter(
          (p) => p.id !== docId && p.name.toLowerCase() !== docId,
        );
        filteredList.push(newPlayer);
        localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(filteredList));
      }

      return newPlayer;
    } catch (e) {
      if (e instanceof Error && e.message === "FIGHTER NAME ALREADY EXISTS!") {
        throw e;
      }
      console.error(
        "Error writing player to Firestore, saving to LocalStorage instead:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_PLAYERS_KEY);
    const list = stored ? (JSON.parse(stored) as DbPlayer[]) : [];
    const nameExists = list.some(
      (p) => p.name.toLowerCase() === docId || p.id === docId,
    );
    if (nameExists) {
      throw new Error("FIGHTER NAME ALREADY EXISTS!");
    }
    list.push(newPlayer);
    localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(list));
  }
  return newPlayer;
}

// Fetch rank configuration rules
export async function fetchRankConfig(): Promise<RankConfig> {
  if (db) {
    try {
      const configRef = doc(db, "config", "rankSystem");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const config: RankConfig = {
          minMatches: Number(data.minMatches) ?? DEFAULT_RANK_CONFIG.minMatches,
          highTierWinrate:
            Number(data.highTierWinrate) ?? DEFAULT_RANK_CONFIG.highTierWinrate,
          lowTierWinrate:
            Number(data.lowTierWinrate) ?? DEFAULT_RANK_CONFIG.lowTierWinrate,
          tiers: {
            high: data.tiers?.high || DEFAULT_RANK_CONFIG.tiers.high,
            normal: data.tiers?.normal || DEFAULT_RANK_CONFIG.tiers.normal,
            low: data.tiers?.low || DEFAULT_RANK_CONFIG.tiers.low,
          },
        };
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
        }
        return config;
      } else {
        console.log(
          "Rank config missing on Firestore. Seeding default config...",
        );
        await setDoc(configRef, DEFAULT_RANK_CONFIG);
        if (typeof window !== "undefined") {
          localStorage.setItem(
            LOCAL_CONFIG_KEY,
            JSON.stringify(DEFAULT_RANK_CONFIG),
          );
        }
        return DEFAULT_RANK_CONFIG;
      }
    } catch (e) {
      console.error(
        "Error fetching rank config from Firestore, switching to LocalStorage:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_CONFIG_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as RankConfig;
      } catch {
        // Ignore parsing errors
      }
    }
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(DEFAULT_RANK_CONFIG));
  }
  return DEFAULT_RANK_CONFIG;
}

// Save custom rank configuration rules
export async function saveRankConfig(config: RankConfig): Promise<boolean> {
  if (db) {
    try {
      const configRef = doc(db, "config", "rankSystem");
      await setDoc(configRef, config);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
      }
      await recalculateRanks(config);
      return true;
    } catch (e) {
      console.error(
        "Error saving rank config to Firestore, saving to LocalStorage instead:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
    await recalculateRanks(config);
    return true;
  }
  return false;
}

// Recalculate ranks and update all players in the database
export async function recalculateRanks(
  passedConfig?: RankConfig,
): Promise<void> {
  try {
    const config = passedConfig || (await fetchRankConfig());
    const players = await fetchPlayers();
    const matches = await fetchMatches();

    const getTierPriority = (rankName: string, cfg: RankConfig): number => {
      if (rankName === cfg.tiers.high) return 3;
      if (rankName === cfg.tiers.normal) return 2;
      if (rankName === cfg.tiers.low) return 1;
      if (rankName.includes("Mythic")) return 3;
      if (rankName === "Legend") return 2;
      if (rankName === "Epic") return 1;
      return 2;
    };

    const statsMap: Record<string, { wins: number; matches: number }> = {};
    matches.forEach((match) => {
      if (!match.winner) return;

      const teamAPlayers = match.teamA || [];
      const teamBPlayers = match.teamB || [];

      const winningTeam =
        match.winner === "teamA" ? teamAPlayers : teamBPlayers;
      const losingTeam = match.winner === "teamA" ? teamBPlayers : teamAPlayers;

      winningTeam.forEach((playerName) => {
        const key = playerName.toLowerCase();
        if (!statsMap[key]) statsMap[key] = { wins: 0, matches: 0 };
        statsMap[key].wins += 1;
        statsMap[key].matches += 1;
      });

      losingTeam.forEach((playerName) => {
        const key = playerName.toLowerCase();
        if (!statsMap[key]) statsMap[key] = { wins: 0, matches: 0 };
        statsMap[key].matches += 1;
      });
    });

    const updatedPlayers = await Promise.all(
      players.map(async (player) => {
        const key = player.name.toLowerCase();
        const pStats = statsMap[key] || { wins: 0, matches: 0 };

        const totalMatches = pStats.matches;
        const winrate =
          totalMatches > 0 ? Math.round((pStats.wins / totalMatches) * 100) : 0;

        let newRank = config.tiers.normal;
        if (totalMatches >= config.minMatches) {
          if (winrate >= config.highTierWinrate) {
            newRank = config.tiers.high;
          } else if (winrate <= config.lowTierWinrate) {
            newRank = config.tiers.low;
          }
        }

        const newRankPriority = getTierPriority(newRank, config);
        const oldHighestRank = player.highest_rank || "Legend";
        const oldHighestPriority = getTierPriority(oldHighestRank, config);

        let newHighestRank = oldHighestRank;
        if (newRankPriority > oldHighestPriority) {
          newHighestRank = newRank;
        }

        const hasChanged =
          player.total_match_played !== totalMatches ||
          player.winrate !== winrate ||
          player.current_rank !== newRank ||
          player.highest_rank !== newHighestRank;

        if (hasChanged) {
          const updatedFields = {
            total_match_played: totalMatches,
            winrate: winrate,
            current_rank: newRank,
            highest_rank: newHighestRank,
          };

          const updatedPlayer: DbPlayer = {
            ...player,
            ...updatedFields,
          };

          if (db && !player.id.startsWith("local_")) {
            try {
              const playerDocRef = doc(db, "players", player.id);
              await updateDoc(playerDocRef, updatedFields);
            } catch (e) {
              console.error(
                `Error updating Firestore stats for player ${player.name}:`,
                e,
              );
            }
          }

          return updatedPlayer;
        }

        return player;
      }),
    );

    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(updatedPlayers));
    }
  } catch (err) {
    console.error("Error in recalculateRanks:", err);
  }
}
