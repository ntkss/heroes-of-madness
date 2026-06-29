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
  writeBatch,
  Firestore,
} from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  Auth,
} from "firebase/auth";

export interface Match {
  id: string;
  createdAt: number;
  teamA: string[];
  teamB: string[];
  winner: "teamA" | "teamB" | null;
  seasonId?: number;
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
  allTimeWins?: number;
  allTimeMatches?: number;
  allTimeWinrate?: number;
}

export interface SeasonPlayerStat {
  id: string;
  name: string;
  alias: string;
  avatar: string;
  winrate: number;
  total_match_played: number;
  current_rank: string;
}

export interface Season {
  id: number;
  name: string;
  startDate: number;
  endDate: number;
  podium: SeasonPlayerStat[];
  lastPlace: SeasonPlayerStat | null;
  fighterStats: SeasonPlayerStat[];
}

export interface SeasonConfig {
  activeSeasonId: number;
  seasonStart: number;
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
export const isFirebaseConfigured = !!(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID
);

console.log("🔍 [Firebase Diagnostic] Keys resolved:", {
  apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  isFirebaseConfigured,
});

let db: Firestore | null = null;
export let auth: Auth | null = null;

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
    auth = getAuth(app);
    console.log("🔥 Firebase & Auth initialized successfully!");
  } catch (error) {
    console.error(
      "❌ Firebase initialization error, falling back to LocalStorage:",
      error,
    );
  }
} else {
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
          seasonId: data.seasonId !== undefined ? Number(data.seasonId) : 1,
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
      const firestoreData: any = {
        createdAt: newMatch.createdAt,
        teamA: newMatch.teamA,
        teamB: newMatch.teamB,
        winner: newMatch.winner,
      };
      if (newMatch.seasonId !== undefined) {
        firestoreData.seasonId = newMatch.seasonId;
      }
      const docRef = await addDoc(matchesCol, firestoreData);
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

// Delete all matches from history
export async function deleteAllMatches(): Promise<boolean> {
  let success = false;
  if (db) {
    try {
      const matchesCol = collection(db, "matches");
      const querySnapshot = await getDocs(matchesCol);
      const deletePromises: Promise<void>[] = [];
      querySnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db!, "matches", docSnap.id)));
      });
      await Promise.all(deletePromises);
      success = true;
    } catch (e) {
      console.error(
        "Error deleting all matches from Firestore, falling back to LocalStorage:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
    success = true;
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
          allTimeWins: Number(data.allTimeWins) || 0,
          allTimeMatches: Number(data.allTimeMatches) || 0,
          allTimeWinrate: Number(data.allTimeWinrate) || 0,
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
          allTimeWins: 0,
          allTimeMatches: 0,
          allTimeWinrate: 0,
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
          allTimeWins: player.allTimeWins,
          allTimeMatches: player.allTimeMatches,
          allTimeWinrate: player.allTimeWinrate,
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
        allTimeWins: 0,
        allTimeMatches: 0,
        allTimeWinrate: 0,
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
  const cleanAvatar = playerData.avatar || playerData.imageURL || "";

  // Load all players first to check if name exists (case-insensitive)
  const players = await fetchPlayers();
  const nameExists = players.some(
    (p) => p.name.toLowerCase() === nameTrimmed.toLowerCase(),
  );
  if (nameExists) {
    throw new Error("FIGHTER NAME ALREADY EXISTS!");
  }

  // Generate unique document ID
  let docId: string;
  if (db) {
    docId = doc(collection(db, "players")).id;
  } else {
    docId = `local_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  const firestoreData = {
    name: nameTrimmed,
    alias: playerData.alias || nameTrimmed,
    avatar: cleanAvatar,
    winrate: Number(playerData.winrate) || 0,
    current_rank: playerData.current_rank,
    highest_rank: playerData.highest_rank,
    total_match_played: Number(playerData.total_match_played) || 0,
    role: playerData.role || "ALL-ROUNDER",
    createdAt: Date.now(),
    allTimeWins: 0,
    allTimeMatches: 0,
    allTimeWinrate: 0,
  };

  const newPlayer: DbPlayer = {
    ...firestoreData,
    id: docId,
    avatar: cleanAvatar,
    imageURL: cleanAvatar,
  };

  if (db && !docId.startsWith("local_")) {
    try {
      const docRef = doc(db, "players", docId);
      await setDoc(docRef, firestoreData);

      // Update local storage too to keep in sync
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(LOCAL_PLAYERS_KEY);
        const list = stored ? (JSON.parse(stored) as DbPlayer[]) : [];
        const filteredList = list.filter((p) => p.id !== docId);
        filteredList.push(newPlayer);
        localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(filteredList));
      }

      return newPlayer;
    } catch (e) {
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

// Fetch all matches from database without a limit
export async function fetchAllMatches(): Promise<Match[]> {
  if (db) {
    try {
      const matchesCol = collection(db, "matches");
      const q = query(matchesCol, orderBy("createdAt", "desc"));
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
          seasonId: data.seasonId !== undefined ? Number(data.seasonId) : 1,
        });
      });
      return list;
    } catch (e) {
      console.error("Error fetching all matches from Firestore:", e);
    }
  }

  // LocalStorage Fallback
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return [];
  try {
    const list = JSON.parse(stored) as Match[];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// Fetch active season config settings
export async function fetchSeasonConfig(): Promise<SeasonConfig> {
  const defaultConfig: SeasonConfig = { activeSeasonId: 1, seasonStart: Date.now() };
  if (db) {
    try {
      const docRef = doc(db, "config", "seasonConfig");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          activeSeasonId: Number(data.activeSeasonId) || 1,
          seasonStart: Number(data.seasonStart) || Date.now(),
        };
      } else {
        await setDoc(docRef, defaultConfig);
        return defaultConfig;
      }
    } catch (e) {
      console.error("Error fetching season config:", e);
    }
  }

  // LocalStorage fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("mlbb_generator_season_config");
    if (stored) {
      try {
        return JSON.parse(stored) as SeasonConfig;
      } catch {}
    }
    localStorage.setItem("mlbb_generator_season_config", JSON.stringify(defaultConfig));
  }
  return defaultConfig;
}

// Fetch all archived seasons
export async function fetchSeasons(): Promise<Season[]> {
  if (db) {
    try {
      const seasonsCol = collection(db, "seasons");
      const q = query(seasonsCol, orderBy("id", "asc"));
      const querySnapshot = await getDocs(q);
      const list: Season[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: Number(data.id),
          name: data.name || `Season ${data.id}`,
          startDate: Number(data.startDate) || 0,
          endDate: Number(data.endDate) || 0,
          podium: data.podium || [],
          lastPlace: data.lastPlace || null,
          fighterStats: data.fighterStats || [],
        });
      });
      return list;
    } catch (e) {
      console.error("Error fetching seasons from Firestore:", e);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("mlbb_generator_seasons");
    if (stored) {
      try {
        return JSON.parse(stored) as Season[];
      } catch {}
    }
  }
  return [];
}

// End current season, archive stats, and start a new one
export async function endCurrentSeason(): Promise<boolean> {
  try {
    const seasonConfig = await fetchSeasonConfig();
    const activeSeasonId = seasonConfig.activeSeasonId;
    const startDate = seasonConfig.seasonStart;
    const endDate = Date.now();

    const config = await fetchRankConfig();
    const players = await fetchPlayers();

    // Sort players who qualified (played at least minMatches) by season winrate descending
    const qualifiedPlayers = players
      .filter((p) => p.total_match_played >= config.minMatches)
      .sort((a, b) => {
        if (b.winrate !== a.winrate) {
          return b.winrate - a.winrate;
        }
        return b.total_match_played - a.total_match_played;
      });

    // Form Podium (Top 3)
    const podium: SeasonPlayerStat[] = qualifiedPlayers.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      alias: p.alias,
      avatar: p.avatar,
      winrate: p.winrate,
      total_match_played: p.total_match_played,
      current_rank: p.current_rank,
    }));

    // Find Last Place (Worst performer with at least 1 match played)
    const activePlayers = players.filter((p) => p.total_match_played > 0);
    let lastPlace: SeasonPlayerStat | null = null;
    if (activePlayers.length > 0) {
      const sortedWorst = [...activePlayers].sort((a, b) => {
        if (a.winrate !== b.winrate) {
          return a.winrate - b.winrate;
        }
        return a.total_match_played - b.total_match_played;
      });
      const worstPlayer = sortedWorst[0];
      lastPlace = {
        id: worstPlayer.id,
        name: worstPlayer.name,
        alias: worstPlayer.alias,
        avatar: worstPlayer.avatar,
        winrate: worstPlayer.winrate,
        total_match_played: worstPlayer.total_match_played,
        current_rank: worstPlayer.current_rank,
      };
    }

    // Capture all fighter stats
    const fighterStats: SeasonPlayerStat[] = players.map((p) => ({
      id: p.id,
      name: p.name,
      alias: p.alias,
      avatar: p.avatar,
      winrate: p.winrate,
      total_match_played: p.total_match_played,
      current_rank: p.current_rank,
    }));

    const archivedSeason: Season = {
      id: activeSeasonId,
      name: `Season ${activeSeasonId}`,
      startDate,
      endDate,
      podium,
      lastPlace,
      fighterStats,
    };

    // 2. Save Season document
    if (db) {
      const seasonRef = doc(db, "seasons", `season_${activeSeasonId}`);
      await setDoc(seasonRef, archivedSeason);

      // 3. Update Season Config
      const nextSeasonConfig: SeasonConfig = {
        activeSeasonId: activeSeasonId + 1,
        seasonStart: Date.now(),
      };
      const configRef = doc(db, "config", "seasonConfig");
      await setDoc(configRef, nextSeasonConfig);
    } else {
      // LocalStorage Season archive
      if (typeof window !== "undefined") {
        const storedSeasons = localStorage.getItem("mlbb_generator_seasons");
        const seasonsList = storedSeasons ? (JSON.parse(storedSeasons) as Season[]) : [];
        seasonsList.push(archivedSeason);
        localStorage.setItem("mlbb_generator_seasons", JSON.stringify(seasonsList));

        const nextSeasonConfig: SeasonConfig = {
          activeSeasonId: activeSeasonId + 1,
          seasonStart: Date.now(),
        };
        localStorage.setItem("mlbb_generator_season_config", JSON.stringify(nextSeasonConfig));
      }
    }

    // 4. Reset player season stats to 0, current rank to Normal
    if (db) {
      const playersCol = collection(db, "players");
      const querySnapshot = await getDocs(playersCol);
      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          total_match_played: 0,
          winrate: 0,
          current_rank: config.tiers.normal,
          highest_rank: config.tiers.normal,
        });
      });
      await batch.commit();
    } else {
      if (typeof window !== "undefined") {
        const storedPlayers = localStorage.getItem(LOCAL_PLAYERS_KEY);
        if (storedPlayers) {
          const list = JSON.parse(storedPlayers) as DbPlayer[];
          const resetList = list.map((p) => ({
            ...p,
            total_match_played: 0,
            winrate: 0,
            current_rank: config.tiers.normal,
            highest_rank: config.tiers.normal,
          }));
          localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(resetList));
        }
      }
    }

    // Trigger a fresh recalculation of all stats
    await recalculateRanks(config);
    return true;
  } catch (err) {
    console.error("Error in endCurrentSeason:", err);
    return false;
  }
}

// Recalculate ranks and update all players in the database
export async function recalculateRanks(
  passedConfig?: RankConfig,
): Promise<void> {
  try {
    const config = passedConfig || (await fetchRankConfig());
    const seasonConfig = await fetchSeasonConfig();
    const activeSeasonId = seasonConfig.activeSeasonId;

    const players = await fetchPlayers();
    const matches = await fetchAllMatches(); // Fetch ALL matches to compute correct stats

    const getTierPriority = (rankName: string, cfg: RankConfig): number => {
      if (rankName === cfg.tiers.high) return 3;
      if (rankName === cfg.tiers.normal) return 2;
      if (rankName === cfg.tiers.low) return 1;
      if (rankName.includes("Mythic")) return 3;
      if (rankName === "Legend") return 2;
      if (rankName === "Epic") return 1;
      return 2;
    };

    // We will build stats map for BOTH current season and all-time
    const currentSeasonStats: Record<string, { wins: number; matches: number }> = {};
    const allTimeStats: Record<string, { wins: number; matches: number }> = {};

    matches.forEach((match) => {
      if (!match.winner) return;

      const teamAPlayers = match.teamA || [];
      const teamBPlayers = match.teamB || [];

      const winningTeam =
        match.winner === "teamA" ? teamAPlayers : teamBPlayers;
      const losingTeam = match.winner === "teamA" ? teamBPlayers : teamAPlayers;

      const getPlayerKey = (nameOrId: string) => {
        const found = players.find(
          (p) =>
            p.id === nameOrId.toLowerCase() ||
            p.name.toLowerCase() === nameOrId.toLowerCase(),
        );
        return found ? found.id : nameOrId.toLowerCase();
      };

      const matchSeasonId = match.seasonId !== undefined ? Number(match.seasonId) : 1;
      const isCurrentSeason = matchSeasonId === activeSeasonId;

      winningTeam.forEach((playerNameOrId) => {
        const key = getPlayerKey(playerNameOrId);
        
        // All-Time
        if (!allTimeStats[key]) allTimeStats[key] = { wins: 0, matches: 0 };
        allTimeStats[key].wins += 1;
        allTimeStats[key].matches += 1;

        // Current Season
        if (isCurrentSeason) {
          if (!currentSeasonStats[key]) currentSeasonStats[key] = { wins: 0, matches: 0 };
          currentSeasonStats[key].wins += 1;
          currentSeasonStats[key].matches += 1;
        }
      });

      losingTeam.forEach((playerNameOrId) => {
        const key = getPlayerKey(playerNameOrId);
        
        // All-Time
        if (!allTimeStats[key]) allTimeStats[key] = { wins: 0, matches: 0 };
        allTimeStats[key].matches += 1;

        // Current Season
        if (isCurrentSeason) {
          if (!currentSeasonStats[key]) currentSeasonStats[key] = { wins: 0, matches: 0 };
          currentSeasonStats[key].matches += 1;
        }
      });
    });

    const updatedPlayers = await Promise.all(
      players.map(async (player) => {
        const key = player.id;
        const sStats = currentSeasonStats[key] || { wins: 0, matches: 0 };
        const atStats = allTimeStats[key] || { wins: 0, matches: 0 };

        // Current Season Stats
        const totalMatches = sStats.matches;
        const winrate =
          totalMatches > 0 ? Math.round((sStats.wins / totalMatches) * 100) : 0;

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

        // All-Time Stats
        const allTimeMatches = atStats.matches;
        const allTimeWinrate =
          allTimeMatches > 0 ? Math.round((atStats.wins / allTimeMatches) * 100) : 0;

        const hasChanged =
          player.total_match_played !== totalMatches ||
          player.winrate !== winrate ||
          player.current_rank !== newRank ||
          player.highest_rank !== newHighestRank ||
          player.allTimeWins !== atStats.wins ||
          player.allTimeMatches !== allTimeMatches ||
          player.allTimeWinrate !== allTimeWinrate;

        if (hasChanged) {
          const updatedFields = {
            total_match_played: totalMatches,
            winrate: winrate,
            current_rank: newRank,
            highest_rank: newHighestRank,
            allTimeWins: atStats.wins,
            allTimeMatches: allTimeMatches,
            allTimeWinrate: allTimeWinrate,
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

// Delete player from database
export async function deletePlayer(playerId: string): Promise<boolean> {
  let success = false;
  const playerIdLower = playerId.toLowerCase();

  if (db && !playerIdLower.startsWith("local_")) {
    try {
      const docRef = doc(db, "players", playerIdLower);
      await deleteDoc(docRef);
      success = true;
    } catch (e) {
      console.error("Error deleting player from Firestore:", e);
    }
  }

  // LocalStorage Fallback/Sync
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_PLAYERS_KEY);
    if (stored) {
      try {
        const list = JSON.parse(stored) as DbPlayer[];
        const filtered = list.filter((p) => p.id !== playerIdLower);
        localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(filtered));
        if (!db) success = true;
      } catch (e) {
        console.error("Error updating LocalStorage in deletePlayer:", e);
      }
    }
  }

  return success;
}

// Update player display name, alias, and avatar
export async function updatePlayer(
  oldPlayerId: string,
  updatedFields: { name: string; alias: string; avatar: string },
): Promise<DbPlayer> {
  const newName = (updatedFields.name || "").trim();
  if (!newName) {
    throw new Error("FIGHTER NAME CANNOT BE EMPTY!");
  }
  if (newName.length > 16) {
    throw new Error("NAME TOO LONG (MAX 16 CHARS)!");
  }

  const newAlias = (updatedFields.alias || "").trim() || newName;
  const oldPlayerIdLower = oldPlayerId.toLowerCase();

  // Load current player list to check for duplicates and get old player data
  const players = await fetchPlayers();
  const oldPlayer = players.find((p) => p.id === oldPlayerIdLower);
  if (!oldPlayer) {
    throw new Error("FIGHTER NOT FOUND!");
  }

  // Check if name already exists for ANOTHER player (case-insensitive)
  const nameExists = players.some(
    (p) =>
      p.id !== oldPlayerIdLower &&
      p.name.toLowerCase() === newName.toLowerCase(),
  );
  if (nameExists) {
    throw new Error("FIGHTER NAME ALREADY EXISTS!");
  }

  const cleanAvatar = updatedFields.avatar || "";

  const newPlayer: DbPlayer = {
    ...oldPlayer,
    name: newName,
    alias: newAlias,
    avatar: cleanAvatar,
    imageURL: cleanAvatar,
  };

  if (db && !oldPlayerIdLower.startsWith("local_")) {
    try {
      // Always update document in-place
      const docRef = doc(db, "players", oldPlayerIdLower);
      await updateDoc(docRef, {
        name: newName,
        alias: newAlias,
        avatar: cleanAvatar,
      });
    } catch (e) {
      console.error("Error updating player in Firestore:", e);
      throw new Error("FAILED TO UPDATE FIRESTORE DOCUMENT!");
    }
  }

  // LocalStorage Update
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_PLAYERS_KEY);
    if (stored) {
      try {
        const list = JSON.parse(stored) as DbPlayer[];
        const filtered = list.filter((p) => p.id !== oldPlayerIdLower);
        filtered.push(newPlayer);
        localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(filtered));
      } catch (e) {
        console.error("Error updating LocalStorage in updatePlayer:", e);
      }
    }
  }

  return newPlayer;
}

// --- Auth & User Management Functions ---

export interface DbUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: "admin" | "user";
  updatedAt: number;
}

export async function signInWithGoogle() {
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signOutUser() {
  if (!auth) return;
  return signOut(auth);
}

export async function checkBootstrapExists(): Promise<boolean> {
  if (!db) return true; // Default to true if db is not configured
  try {
    const docSnap = await getDoc(doc(db, "config", "bootstrap"));
    return docSnap.exists();
  } catch {
    return true; // Safe fallback
  }
}

export async function syncUserDoc(user: any): Promise<{ role: "admin" | "user" }> {
  if (!db) return { role: "user" };
  const userRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return { role: (data.role as "admin" | "user") || "user" };
  }

  const isDefaultAdmin = user.email === "nattakit.suksaeng@gmail.com";
  const defaultRole = isDefaultAdmin ? "admin" : "user";

  try {
    if (isDefaultAdmin) {
      // For default admin, save user and bootstrap in a batch to fulfill firestore.rules requirements
      const batch = writeBatch(db);
      batch.set(userRef, {
        name: user.displayName || user.email || "Unknown Admin",
        email: user.email || "",
        photoURL: user.photoURL || "",
        role: "admin",
        updatedAt: Date.now(),
      });
      const bootstrapRef = doc(db, "config", "bootstrap");
      batch.set(bootstrapRef, {
        createdBy: user.uid,
        createdAt: Date.now(),
      });
      await batch.commit();
      return { role: "admin" };
    }

    // Standard user
    await setDoc(userRef, {
      name: user.displayName || user.email || "Unknown User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      role: defaultRole,
      updatedAt: Date.now(),
    });
    return { role: defaultRole as "admin" | "user" };
  } catch (e) {
    console.error("Error syncing user document:", e);
    return { role: "user" };
  }
}

export async function bootstrapFirstAdmin(user: any): Promise<boolean> {
  if (!db) return false;
  try {
    const userRef = doc(db, "users", user.uid);
    const bootstrapRef = doc(db, "config", "bootstrap");
    const batch = writeBatch(db);
    batch.set(userRef, {
      name: user.displayName || user.email || "Unknown Admin",
      email: user.email || "",
      photoURL: user.photoURL || "",
      role: "admin",
      updatedAt: Date.now(),
    });
    batch.set(bootstrapRef, {
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    await batch.commit();
    return true;
  } catch (e) {
    console.error("Bootstrap first admin failed:", e);
    return false;
  }
}

export async function fetchUsers(): Promise<DbUser[]> {
  if (!db) return [];
  try {
    const usersCol = collection(db, "users");
    const querySnapshot = await getDocs(usersCol);
    const list: DbUser[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        uid: docSnap.id,
        name: data.name || "",
        email: data.email || "",
        photoURL: data.photoURL || "",
        role: (data.role as "admin" | "user") || "user",
        updatedAt: data.updatedAt || Date.now(),
      });
    });
    return list;
  } catch (e) {
    console.error("Error fetching users:", e);
    return [];
  }
}

export async function updateUserRole(uid: string, newRole: "admin" | "user"): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, { role: newRole, updatedAt: Date.now() });
    return true;
  } catch (e) {
    console.error("Error updating user role:", e);
    return false;
  }
}

// Seed mock seasons and matches data for testing
export async function seedMockSeasons(): Promise<boolean> {
  const mockSeasons: Season[] = [
    {
      id: 1,
      name: "Season 1",
      startDate: Date.now() - 60 * 24 * 60 * 60 * 1000,
      endDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      podium: [
        { id: "nutty", name: "Nutty", alias: "Nutty", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=nutty", winrate: 75, total_match_played: 12, current_rank: "คนเก่ง" },
        { id: "goku", name: "Goku", alias: "Goku", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=goku", winrate: 64, total_match_played: 11, current_rank: "คนเก่ง" },
        { id: "mike", name: "Mike", alias: "Mike", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=mike", winrate: 58, total_match_played: 12, current_rank: "คนปกติ" },
      ],
      lastPlace: { id: "feeder", name: "Feeder Pro", alias: "Feeder", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=feeder", winrate: 18, total_match_played: 11, current_rank: "คนกาก" },
      fighterStats: [
        { id: "nutty", name: "Nutty", alias: "Nutty", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=nutty", winrate: 75, total_match_played: 12, current_rank: "คนเก่ง" },
        { id: "goku", name: "Goku", alias: "Goku", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=goku", winrate: 64, total_match_played: 11, current_rank: "คนเก่ง" },
        { id: "mike", name: "Mike", alias: "Mike", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=mike", winrate: 58, total_match_played: 12, current_rank: "คนปกติ" },
        { id: "feeder", name: "Feeder Pro", alias: "Feeder", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=feeder", winrate: 18, total_match_played: 11, current_rank: "คนกาก" },
      ]
    },
    {
      id: 2,
      name: "Season 2",
      startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endDate: Date.now() - 1000,
      podium: [
        { id: "goku", name: "Goku", alias: "Goku", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=goku", winrate: 80, total_match_played: 15, current_rank: "คนเก่ง" },
        { id: "nutty", name: "Nutty", alias: "Nutty", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=nutty", winrate: 70, total_match_played: 10, current_rank: "คนเก่ง" },
        { id: "billy", name: "Billy", alias: "Billy", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=billy", winrate: 60, total_match_played: 10, current_rank: "คนปกติ" },
      ],
      lastPlace: { id: "noob", name: "Noob King", alias: "Noob", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=noob", winrate: 10, total_match_played: 10, current_rank: "คนกาก" },
      fighterStats: [
        { id: "goku", name: "Goku", alias: "Goku", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=goku", winrate: 80, total_match_played: 15, current_rank: "คนเก่ง" },
        { id: "nutty", name: "Nutty", alias: "Nutty", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=nutty", winrate: 70, total_match_played: 10, current_rank: "คนเก่ง" },
        { id: "billy", name: "Billy", alias: "Billy", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=billy", winrate: 60, total_match_played: 10, current_rank: "คนปกติ" },
        { id: "noob", name: "Noob King", alias: "Noob", avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=noob", winrate: 10, total_match_played: 10, current_rank: "คนกาก" },
      ]
    }
  ];

  const mockMatches: Match[] = [
    {
      id: "mock_m1",
      createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
      teamA: ["Nutty", "Goku", "Mike", "Player 4", "Player 5"],
      teamB: ["Feeder Pro", "Player 7", "Player 8", "Player 9", "Player 10"],
      winner: "teamA",
      seasonId: 1,
    },
    {
      id: "mock_m2",
      createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
      teamA: ["Nutty", "Goku", "Mike", "Player 4", "Player 5"],
      teamB: ["Feeder Pro", "Player 7", "Player 8", "Player 9", "Player 10"],
      winner: "teamA",
      seasonId: 1,
    },
    {
      id: "mock_m3",
      createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
      teamA: ["Goku", "Nutty", "Billy", "Player 4", "Player 5"],
      teamB: ["Noob King", "Player 7", "Player 8", "Player 9", "Player 10"],
      winner: "teamA",
      seasonId: 2,
    }
  ];

  try {
    if (db) {
      for (const season of mockSeasons) {
        const seasonRef = doc(db, "seasons", `season_${season.id}`);
        await setDoc(seasonRef, season);
      }
      for (const match of mockMatches) {
        const matchRef = doc(db, "matches", match.id);
        const cleanMatch = {
          createdAt: match.createdAt,
          teamA: match.teamA,
          teamB: match.teamB,
          winner: match.winner,
          seasonId: match.seasonId,
        };
        await setDoc(matchRef, cleanMatch);
      }
      const configRef = doc(db, "config", "seasonConfig");
      await setDoc(configRef, { activeSeasonId: 3, seasonStart: Date.now() });
    } else {
      if (typeof window !== "undefined") {
        localStorage.setItem("mlbb_generator_seasons", JSON.stringify(mockSeasons));
        localStorage.setItem("mlbb_generator_matches", JSON.stringify(mockMatches));
        localStorage.setItem("mlbb_generator_season_config", JSON.stringify({ activeSeasonId: 3, seasonStart: Date.now() }));
      }
    }
    return true;
  } catch (e) {
    console.error("Error seeding mock seasons:", e);
    return false;
  }
}

// Clear seeded mock seasons and matches data
export async function clearMockSeasons(): Promise<boolean> {
  try {
    if (db) {
      const s1 = doc(db, "seasons", "season_1");
      const s2 = doc(db, "seasons", "season_2");
      await deleteDoc(s1);
      await deleteDoc(s2);

      const m1 = doc(db, "matches", "mock_m1");
      const m2 = doc(db, "matches", "mock_m2");
      const m3 = doc(db, "matches", "mock_m3");
      await deleteDoc(m1);
      await deleteDoc(m2);
      await deleteDoc(m3);

      const configRef = doc(db, "config", "seasonConfig");
      await setDoc(configRef, { activeSeasonId: 1, seasonStart: Date.now() });
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem("mlbb_generator_seasons");
        localStorage.removeItem("mlbb_generator_matches");
        localStorage.setItem("mlbb_generator_season_config", JSON.stringify({ activeSeasonId: 1, seasonStart: Date.now() }));
      }
    }
    return true;
  } catch (e) {
    console.error("Error clearing mock seasons:", e);
    return false;
  }
}
