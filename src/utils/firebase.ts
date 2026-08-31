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
  DocumentData,
  increment,
} from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  Auth,
  User,
} from "firebase/auth";
import {
  getStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  FirebaseStorage,
} from "firebase/storage";

export interface PlayerFeedback {
  likes: number;
  dislikes: number;
  userVotes?: {
    [userId: string]: "likes" | "dislikes";
  };
}

export interface Match {
  id: string;
  createdAt: number;
  teamA: string[];
  teamB: string[];
  teamALanes?: string[];
  teamBLanes?: string[];
  winner: "teamA" | "teamB" | null;
  seasonId?: number;
  feedback?: {
    [playerKey: string]: PlayerFeedback;
  };
}

export interface MatchComment {
  id: string;
  matchId: string;
  text: string;
  createdAt: number;
  userId?: string;
  authorName?: string;
  authorAvatar?: string;
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
  wins?: number;
  losses?: number;
  matchesToNextRank?: number;
  nextRankTarget?: number;
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

export interface LineConfig {
  groupId: string;
  enabled: boolean;
}

export const DEFAULT_LINE_CONFIG: LineConfig = {
  groupId: "",
  enabled: false,
};

const LOCAL_CONFIG_KEY = "mlbb_generator_rank_config";
const LOCAL_LINE_CONFIG_KEY = "mlbb_generator_line_config";

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

export let db: Firestore | null = null;
export let auth: Auth | null = null;
export let storage: FirebaseStorage | null = null;

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
    storage = getStorage(app);
    console.log("🔥 Firebase, Auth & Storage initialized successfully!");
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
          teamALanes: data.teamALanes,
          teamBLanes: data.teamBLanes,
          winner: data.winner !== undefined ? data.winner : null,
          seasonId: data.seasonId !== undefined ? Number(data.seasonId) : 1,
          feedback: data.feedback || {},
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

// Fetch single match by ID
export async function fetchMatchById(matchId: string): Promise<Match | null> {
  if (db && !matchId.startsWith("local_")) {
    try {
      const docRef = doc(db, "matches", matchId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          createdAt: data.createdAt || Date.now(),
          teamA: data.teamA || [],
          teamB: data.teamB || [],
          teamALanes: data.teamALanes,
          teamBLanes: data.teamBLanes,
          winner: data.winner !== undefined ? data.winner : null,
          seasonId: data.seasonId !== undefined ? Number(data.seasonId) : 1,
          feedback: data.feedback || {},
        };
      }
    } catch (e) {
      console.error(
        `[Firestore Error] Error fetching match by ID ${matchId}:`,
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return null;
  try {
    const list = JSON.parse(stored) as Match[];
    return list.find((m) => m.id === matchId) || null;
  } catch {
    return null;
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
      const firestoreData: DocumentData = {
        createdAt: newMatch.createdAt,
        teamA: newMatch.teamA,
        teamB: newMatch.teamB,
        winner: newMatch.winner,
      };
      if (newMatch.seasonId !== undefined) {
        firestoreData.seasonId = newMatch.seasonId;
      }
      if (newMatch.teamALanes !== undefined) {
        firestoreData.teamALanes = newMatch.teamALanes;
      }
      if (newMatch.teamBLanes !== undefined) {
        firestoreData.teamBLanes = newMatch.teamBLanes;
      }
      if (newMatch.feedback !== undefined) {
        firestoreData.feedback = newMatch.feedback;
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
          current_rank: "Unranked",
          highest_rank: "Unranked",
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
        current_rank: "Unranked",
        highest_rank: "Unranked",
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

// Fetch LINE configuration rules
export async function fetchLineConfig(): Promise<LineConfig> {
  if (db) {
    try {
      const configRef = doc(db, "config", "lineSystem");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const config: LineConfig = {
          groupId: data.groupId || "",
          enabled: data.enabled ?? false,
        };
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_LINE_CONFIG_KEY, JSON.stringify(config));
        }
        return config;
      } else {
        await setDoc(configRef, DEFAULT_LINE_CONFIG);
        if (typeof window !== "undefined") {
          localStorage.setItem(
            LOCAL_LINE_CONFIG_KEY,
            JSON.stringify(DEFAULT_LINE_CONFIG),
          );
        }
        return DEFAULT_LINE_CONFIG;
      }
    } catch (e) {
      console.error(
        "Error fetching LINE config from Firestore, switching to LocalStorage:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_LINE_CONFIG_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as LineConfig;
      } catch {
        return DEFAULT_LINE_CONFIG;
      }
    }
  }
  return DEFAULT_LINE_CONFIG;
}

// Save LINE configuration rules
export async function saveLineConfig(config: LineConfig): Promise<boolean> {
  if (db) {
    try {
      const configRef = doc(db, "config", "lineSystem");
      await setDoc(configRef, config);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_LINE_CONFIG_KEY, JSON.stringify(config));
      }
      return true;
    } catch (e) {
      console.error(
        "Error saving LINE config to Firestore, saving to LocalStorage instead:",
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_LINE_CONFIG_KEY, JSON.stringify(config));
    return true;
  }
  return false;
}

// Upload matchup screenshot to Firebase Storage
export async function uploadMatchImage(
  matchId: string,
  blob: Blob,
): Promise<string> {
  if (!storage) {
    throw new Error("Firebase Storage is not configured/initialized.");
  }
  const imageRef = ref(storage, `matches/${matchId}.png`);
  await uploadBytes(imageRef, blob);
  return await getDownloadURL(imageRef);
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
          teamALanes: data.teamALanes,
          teamBLanes: data.teamBLanes,
          winner: data.winner !== undefined ? data.winner : null,
          seasonId: data.seasonId !== undefined ? Number(data.seasonId) : 1,
          feedback: data.feedback || {},
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
  const defaultConfig: SeasonConfig = {
    activeSeasonId: 1,
    seasonStart: Date.now(),
  };
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
    localStorage.setItem(
      "mlbb_generator_season_config",
      JSON.stringify(defaultConfig),
    );
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
        const aWins = Math.round((a.winrate / 100) * a.total_match_played);
        const bWins = Math.round((b.winrate / 100) * b.total_match_played);
        const aWeighted = getWeightedWinrate(aWins, a.total_match_played);
        const bWeighted = getWeightedWinrate(bWins, b.total_match_played);

        if (bWeighted !== aWeighted) {
          return bWeighted - aWeighted;
        }
        return b.total_match_played - a.total_match_played;
      });

    // Form Podium (Top 3)
    const podium: SeasonPlayerStat[] = qualifiedPlayers.slice(0, 3).map((p) => {
      const wins = Math.round((p.winrate / 100) * p.total_match_played);
      const losses = Math.max(0, p.total_match_played - wins);
      return {
        id: p.id,
        name: p.name,
        alias: p.alias,
        avatar: p.avatar,
        winrate: p.winrate,
        total_match_played: p.total_match_played,
        current_rank: p.current_rank,
        wins,
        losses,
      };
    });

    // Find Last Place (Worst performer with at least 1 match played)
    const activePlayers = players.filter((p) => p.total_match_played > 0);
    let lastPlace: SeasonPlayerStat | null = null;
    if (activePlayers.length > 0) {
      const sortedWorst = [...activePlayers].sort((a, b) => {
        const aWins = Math.round((a.winrate / 100) * a.total_match_played);
        const bWins = Math.round((b.winrate / 100) * b.total_match_played);
        const aWeighted = getWeightedWinrate(aWins, a.total_match_played);
        const bWeighted = getWeightedWinrate(bWins, b.total_match_played);

        if (aWeighted !== bWeighted) {
          return aWeighted - bWeighted;
        }
        return a.total_match_played - b.total_match_played;
      });
      const worstPlayer = sortedWorst[0];
      const wins = Math.round(
        (worstPlayer.winrate / 100) * worstPlayer.total_match_played,
      );
      const losses = Math.max(0, worstPlayer.total_match_played - wins);
      lastPlace = {
        id: worstPlayer.id,
        name: worstPlayer.name,
        alias: worstPlayer.alias,
        avatar: worstPlayer.avatar,
        winrate: worstPlayer.winrate,
        total_match_played: worstPlayer.total_match_played,
        current_rank: worstPlayer.current_rank,
        wins,
        losses,
      };
    }

    // Capture all fighter stats
    const fighterStats: SeasonPlayerStat[] = players.map((p) => {
      const wins = Math.round((p.winrate / 100) * p.total_match_played);
      const losses = Math.max(0, p.total_match_played - wins);
      return {
        id: p.id,
        name: p.name,
        alias: p.alias,
        avatar: p.avatar,
        winrate: p.winrate,
        total_match_played: p.total_match_played,
        current_rank: p.current_rank,
        wins,
        losses,
      };
    });

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
        const seasonsList = storedSeasons
          ? (JSON.parse(storedSeasons) as Season[])
          : [];
        seasonsList.push(archivedSeason);
        localStorage.setItem(
          "mlbb_generator_seasons",
          JSON.stringify(seasonsList),
        );

        const nextSeasonConfig: SeasonConfig = {
          activeSeasonId: activeSeasonId + 1,
          seasonStart: Date.now(),
        };
        localStorage.setItem(
          "mlbb_generator_season_config",
          JSON.stringify(nextSeasonConfig),
        );
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
          current_rank: "Unranked",
          highest_rank: "Unranked",
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
            current_rank: "Unranked",
            highest_rank: "Unranked",
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
      if (rankName === "Unranked") return 0;
      if (rankName === cfg.tiers.high) return 3;
      if (rankName === cfg.tiers.normal) return 2;
      if (rankName === cfg.tiers.low) return 1;
      if (rankName.includes("Mythic")) return 3;
      if (rankName === "Legend") return 2;
      if (rankName === "Epic") return 1;
      return 2;
    };

    // We will build stats map for BOTH current season and all-time
    const currentSeasonStats: Record<
      string,
      { wins: number; matches: number }
    > = {};
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

      const matchSeasonId =
        match.seasonId !== undefined ? Number(match.seasonId) : 1;
      const isCurrentSeason = matchSeasonId === activeSeasonId;

      winningTeam.forEach((playerNameOrId) => {
        const key = getPlayerKey(playerNameOrId);

        // All-Time
        if (!allTimeStats[key]) allTimeStats[key] = { wins: 0, matches: 0 };
        allTimeStats[key].wins += 1;
        allTimeStats[key].matches += 1;

        // Current Season
        if (isCurrentSeason) {
          if (!currentSeasonStats[key])
            currentSeasonStats[key] = { wins: 0, matches: 0 };
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
          if (!currentSeasonStats[key])
            currentSeasonStats[key] = { wins: 0, matches: 0 };
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

        let newRank = "Unranked";
        if (totalMatches >= config.minMatches) {
          if (winrate >= config.highTierWinrate) {
            newRank = config.tiers.high;
          } else if (winrate <= config.lowTierWinrate) {
            newRank = config.tiers.low;
          } else {
            newRank = config.tiers.normal;
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
          allTimeMatches > 0
            ? Math.round((atStats.wins / allTimeMatches) * 100)
            : 0;

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

export async function syncUserDoc(
  user: User,
): Promise<{ role: "admin" | "user" }> {
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

export async function bootstrapFirstAdmin(user: User): Promise<boolean> {
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

export async function updateUserRole(
  uid: string,
  newRole: "admin" | "user",
): Promise<boolean> {
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
        {
          id: "nutty",
          name: "Nutty",
          alias: "Nutty",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=nutty",
          winrate: 75,
          total_match_played: 12,
          current_rank: "คนเก่ง",
        },
        {
          id: "goku",
          name: "Goku",
          alias: "Goku",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=goku",
          winrate: 64,
          total_match_played: 11,
          current_rank: "คนเก่ง",
        },
        {
          id: "mike",
          name: "Mike",
          alias: "Mike",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=mike",
          winrate: 58,
          total_match_played: 12,
          current_rank: "คนปกติ",
        },
      ],
      lastPlace: {
        id: "feeder",
        name: "Feeder Pro",
        alias: "Feeder",
        avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=feeder",
        winrate: 18,
        total_match_played: 11,
        current_rank: "คนกาก",
      },
      fighterStats: [
        {
          id: "nutty",
          name: "Nutty",
          alias: "Nutty",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=nutty",
          winrate: 75,
          total_match_played: 12,
          current_rank: "คนเก่ง",
        },
        {
          id: "goku",
          name: "Goku",
          alias: "Goku",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=goku",
          winrate: 64,
          total_match_played: 11,
          current_rank: "คนเก่ง",
        },
        {
          id: "mike",
          name: "Mike",
          alias: "Mike",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=mike",
          winrate: 58,
          total_match_played: 12,
          current_rank: "คนปกติ",
        },
        {
          id: "feeder",
          name: "Feeder Pro",
          alias: "Feeder",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=feeder",
          winrate: 18,
          total_match_played: 11,
          current_rank: "คนกาก",
        },
      ],
    },
    {
      id: 2,
      name: "Season 2",
      startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endDate: Date.now() - 1000,
      podium: [
        {
          id: "goku",
          name: "Goku",
          alias: "Goku",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=goku",
          winrate: 80,
          total_match_played: 15,
          current_rank: "คนเก่ง",
        },
        {
          id: "nutty",
          name: "Nutty",
          alias: "Nutty",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=nutty",
          winrate: 70,
          total_match_played: 10,
          current_rank: "คนเก่ง",
        },
        {
          id: "billy",
          name: "Billy",
          alias: "Billy",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=billy",
          winrate: 60,
          total_match_played: 10,
          current_rank: "คนปกติ",
        },
      ],
      lastPlace: {
        id: "noob",
        name: "Noob King",
        alias: "Noob",
        avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=noob",
        winrate: 10,
        total_match_played: 10,
        current_rank: "คนกาก",
      },
      fighterStats: [
        {
          id: "goku",
          name: "Goku",
          alias: "Goku",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=goku",
          winrate: 80,
          total_match_played: 15,
          current_rank: "คนเก่ง",
        },
        {
          id: "nutty",
          name: "Nutty",
          alias: "Nutty",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=nutty",
          winrate: 70,
          total_match_played: 10,
          current_rank: "คนเก่ง",
        },
        {
          id: "billy",
          name: "Billy",
          alias: "Billy",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=billy",
          winrate: 60,
          total_match_played: 10,
          current_rank: "คนปกติ",
        },
        {
          id: "noob",
          name: "Noob King",
          alias: "Noob",
          avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=noob",
          winrate: 10,
          total_match_played: 10,
          current_rank: "คนกาก",
        },
      ],
    },
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
    },
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
        localStorage.setItem(
          "mlbb_generator_seasons",
          JSON.stringify(mockSeasons),
        );
        localStorage.setItem(
          "mlbb_generator_matches",
          JSON.stringify(mockMatches),
        );
        localStorage.setItem(
          "mlbb_generator_season_config",
          JSON.stringify({ activeSeasonId: 3, seasonStart: Date.now() }),
        );
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
        localStorage.setItem(
          "mlbb_generator_season_config",
          JSON.stringify({ activeSeasonId: 1, seasonStart: Date.now() }),
        );
      }
    }
    return true;
  } catch (e) {
    console.error("Error clearing mock seasons:", e);
    return false;
  }
}

/**
 * Calculates a weighted win rate using Laplace smoothing (Bayesian average)
 * to prevent small sample sizes from dominating the rankings.
 * Formula: (Wins + C * prior) / (Total Matches + C) * 100
 * where C is a smoothing constant (default: 5) and prior is the baseline win rate (default: 50% / 0.5).
 */
export function getWeightedWinrate(
  wins: number,
  totalMatches: number,
  C: number = 5,
): number {
  if (totalMatches === 0) return 0;
  const prior = 0.5;
  return ((wins + C * prior) / (totalMatches + C)) * 100;
}

// Toggle player feedback (Likes/Dislikes) in a match for an authenticated user
export async function togglePlayerFeedback(
  matchId: string,
  playerKey: string,
  targetType: "likes" | "dislikes",
  userId: string,
): Promise<PlayerFeedback | null> {
  const playerKeyLower = playerKey.toLowerCase();

  const computeNewFeedback = (currentFb?: PlayerFeedback): PlayerFeedback => {
    const likes = currentFb?.likes || 0;
    const dislikes = currentFb?.dislikes || 0;
    const userVotes: { [uid: string]: "likes" | "dislikes" } =
      currentFb?.userVotes ? { ...currentFb.userVotes } : {};
    const currentVote = userVotes[userId] || null;

    let newLikes = likes;
    let newDislikes = dislikes;
    let newVote: "likes" | "dislikes" | null = targetType;

    if (currentVote === targetType) {
      newVote = null;
    }

    if (currentVote === "likes") newLikes = Math.max(0, newLikes - 1);
    if (currentVote === "dislikes") newDislikes = Math.max(0, newDislikes - 1);

    if (newVote === "likes") newLikes += 1;
    if (newVote === "dislikes") newDislikes += 1;

    if (newVote) {
      userVotes[userId] = newVote;
    } else {
      delete userVotes[userId];
    }

    return {
      likes: newLikes,
      dislikes: newDislikes,
      userVotes,
    };
  };

  if (db && !matchId.startsWith("local_")) {
    try {
      const { runTransaction, doc } = await import("firebase/firestore");
      const docRef = doc(db, "matches", matchId);

      const result = await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) {
          throw new Error("Match doc does not exist");
        }

        const matchData = sfDoc.data() as Match;
        const currentFb = matchData.feedback?.[playerKeyLower];
        const newFb = computeNewFeedback(currentFb);

        transaction.update(docRef, {
          [`feedback.${playerKeyLower}`]: newFb,
        });

        return newFb;
      });

      // Sync local storage
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          try {
            const list = JSON.parse(stored) as Match[];
            const idx = list.findIndex((m) => m.id === matchId);
            if (idx !== -1) {
              if (!list[idx].feedback) list[idx].feedback = {};
              list[idx].feedback![playerKeyLower] = result;
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
            }
          } catch (e) {
            console.error("Error syncing local storage:", e);
          }
        }
      }

      return result;
    } catch (e) {
      console.error("Error updating player feedback on Firestore:", e);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const list = JSON.parse(stored) as Match[];
        const idx = list.findIndex((m) => m.id === matchId);
        if (idx !== -1) {
          const match = list[idx];
          if (!match.feedback) match.feedback = {};
          const currentFb = match.feedback[playerKeyLower];
          const newFb = computeNewFeedback(currentFb);
          match.feedback[playerKeyLower] = newFb;
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
          return newFb;
        }
      } catch (e) {
        console.error("Error updating player feedback in LocalStorage:", e);
      }
    }
  }

  return null;
}

// Increment player feedback (Likes/Dislikes) in a match (Legacy / Fallback)
export async function incrementPlayerFeedback(
  matchId: string,
  playerKey: string,
  type: "likes" | "dislikes",
): Promise<boolean> {
  const playerKeyLower = playerKey.toLowerCase();

  if (db && !matchId.startsWith("local_")) {
    try {
      const docRef = doc(db, "matches", matchId);
      const { increment } = await import("firebase/firestore");
      await updateDoc(docRef, {
        [`feedback.${playerKeyLower}.${type}`]: increment(1),
      });
      return true;
    } catch (e) {
      console.error("Error updating feedback on Firestore:", e);
    }
  }

  // LocalStorage Fallback/Sync
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const list = JSON.parse(stored) as Match[];
        const idx = list.findIndex((m) => m.id === matchId);
        if (idx !== -1) {
          const match = list[idx];
          if (!match.feedback) match.feedback = {};
          if (!match.feedback[playerKeyLower]) {
            match.feedback[playerKeyLower] = { likes: 0, dislikes: 0 };
          }
          match.feedback[playerKeyLower][type] += 1;
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
          return true;
        }
      } catch (e) {
        console.error("Error updating feedback in LocalStorage:", e);
      }
    }
  }
  return false;
}

// Fetch comments for a specific match
export async function fetchComments(matchId: string): Promise<MatchComment[]> {
  if (db && !matchId.startsWith("local_")) {
    try {
      const commentsCol = collection(db, "matches", matchId, "comments");
      const q = query(commentsCol, orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(q);
      const list: MatchComment[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rawCreatedAt = data.createdAt;
        const createdAt =
          typeof rawCreatedAt === "number"
            ? rawCreatedAt
            : rawCreatedAt?.toMillis
              ? rawCreatedAt.toMillis()
              : Date.now();

        list.push({
          id: docSnap.id,
          matchId,
          text: data.text || "",
          createdAt,
          userId: data.userId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
        });
      });
      return list;
    } catch (e) {
      console.error(
        `[Firestore Error] Error fetching comments for match ${matchId}:`,
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(`mlbb_generator_comments_${matchId}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as MatchComment[];
  } catch {
    return [];
  }
}

// Save an anonymous or authenticated comment for a match
export async function saveComment(
  matchId: string,
  text: string,
  authorInfo?: { userId?: string; authorName?: string; authorAvatar?: string },
): Promise<MatchComment> {
  const newComment = {
    text,
    createdAt: Date.now(),
    ...(authorInfo?.userId ? { userId: authorInfo.userId } : {}),
    ...(authorInfo?.authorName ? { authorName: authorInfo.authorName } : {}),
    ...(authorInfo?.authorAvatar
      ? { authorAvatar: authorInfo.authorAvatar }
      : {}),
  };

  if (db && !matchId.startsWith("local_")) {
    try {
      const commentsCol = collection(db, "matches", matchId, "comments");
      const docRef = await addDoc(commentsCol, newComment);
      return {
        ...newComment,
        id: docRef.id,
        matchId,
      };
    } catch (e) {
      console.error(
        `[Firestore Error] Error saving comment for match ${matchId}:`,
        e,
      );
    }
  }

  // LocalStorage Fallback
  const id = `local_comment_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  const fullComment: MatchComment = {
    ...newComment,
    id,
    matchId,
  };
  if (typeof window !== "undefined") {
    const key = `mlbb_generator_comments_${matchId}`;
    const stored = localStorage.getItem(key);
    const list = stored ? (JSON.parse(stored) as MatchComment[]) : [];
    list.push(fullComment);
    localStorage.setItem(key, JSON.stringify(list));
  }
  return fullComment;
}

// --- Forums & News Features ---

export interface ForumPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl?: string;
  type: "news" | "forum";
  authorId: string;
  authorName: string;
  authorAvatar: string;
  createdAt: number;
  tags: string[];
  views: number;
  likes: number;
  dislikes: number;
  userVotes?: {
    [userId: string]: "likes" | "dislikes";
  };
  mentionedPlayers?: string[];
  mentionedMatches?: string[];
}

export interface ForumComment {
  id: string;
  postId: string;
  text: string;
  createdAt: number;
  userId: string;
  authorName: string;
  authorAvatar: string;
}

// Automatic tagging
export function extractAutomaticTags(
  title: string,
  description: string,
  type: "news" | "forum",
): string[] {
  const tagsSet = new Set<string>();

  if (type === "news") {
    tagsSet.add("news");
  } else {
    tagsSet.add("forum");
  }

  const content = (title + " " + description).toLowerCase();

  const keywordMap: Record<string, string[]> = {
    rank: ["rank", "tier", "winrate", "win rate", "placement", "division"],
    "patch-update": [
      "patch",
      "update",
      "buff",
      "nerf",
      "revamp",
      "balance",
      "release",
      "patch-update",
      "season",
    ],
    mlbb: [
      "mlbb",
      "mobile legends",
      "legends",
      "moba",
      "fighter",
      "squad",
      "meta",
    ],
    match: [
      "match",
      "scrim",
      "verses",
      "vs",
      "history",
      "winner",
      "team a",
      "team b",
      "score",
    ],
    tournament: [
      "tournament",
      "cup",
      "esports",
      "championship",
      "bracket",
      "draft",
    ],
    guide: [
      "guide",
      "tutorial",
      "build",
      "item",
      "emblem",
      "how to",
      "tips",
      "tricks",
    ],
  };

  Object.entries(keywordMap).forEach(([tag, keywords]) => {
    if (keywords.some((keyword) => content.includes(keyword))) {
      tagsSet.add(tag);
    }
  });

  const hashtagRegex = /#([\w-]+)/g;
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    const hashtag = match[1].toLowerCase();
    if (hashtag && hashtag.length > 1) {
      tagsSet.add(hashtag);
    }
  }

  return Array.from(tagsSet);
}

// Slug generation
export function generatePostSlug(title: string): string {
  const cleanTitle = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");

  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${cleanTitle || "post"}-${randomSuffix}`;
}

// Fetch forum posts
export async function fetchPosts(
  tag?: string,
  type?: "news" | "forum",
): Promise<ForumPost[]> {
  if (db && isFirebaseConfigured) {
    try {
      const postsCol = collection(db, "posts");
      const q = query(postsCol, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const list: ForumPost[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const post = {
          id: docSnap.id,
          slug: data.slug || "",
          title: data.title || "",
          description: data.description || "",
          imageUrl: data.imageUrl,
          type: data.type || "forum",
          authorId: data.authorId || "",
          authorName: data.authorName || "",
          authorAvatar: data.authorAvatar || "",
          createdAt: data.createdAt || Date.now(),
          tags: data.tags || [],
          views: data.views || 0,
          likes: data.likes || 0,
          dislikes: data.dislikes || 0,
          userVotes: data.userVotes || {},
          mentionedPlayers: data.mentionedPlayers || [],
          mentionedMatches: data.mentionedMatches || [],
        };

        let matchFilter = true;
        if (tag && !post.tags.includes(tag.toLowerCase())) matchFilter = false;
        if (type && post.type !== type) matchFilter = false;

        if (matchFilter) {
          list.push(post);
        }
      });
      return list;
    } catch (e) {
      console.error("[Firestore Error] Error fetching posts:", e);
    }
  }

  // LocalStorage Fallback
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("mlbb_generator_posts");
  if (!stored) return [];
  try {
    const list = JSON.parse(stored) as ForumPost[];
    const sorted = list.sort((a, b) => b.createdAt - a.createdAt);
    return sorted.filter((post) => {
      let matchFilter = true;
      if (tag && !post.tags.includes(tag.toLowerCase())) matchFilter = false;
      if (type && post.type !== type) matchFilter = false;
      return matchFilter;
    });
  } catch {
    return [];
  }
}

// Fetch single forum post by slug
export async function fetchPostBySlug(slug: string): Promise<ForumPost | null> {
  if (db && isFirebaseConfigured) {
    try {
      const { where } = await import("firebase/firestore");
      const postsCol = collection(db, "posts");
      const q = query(postsCol, where("slug", "==", slug), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        return {
          id: docSnap.id,
          slug: data.slug || "",
          title: data.title || "",
          description: data.description || "",
          imageUrl: data.imageUrl,
          type: data.type || "forum",
          authorId: data.authorId || "",
          authorName: data.authorName || "",
          authorAvatar: data.authorAvatar || "",
          createdAt: data.createdAt || Date.now(),
          tags: data.tags || [],
          views: data.views || 0,
          likes: data.likes || 0,
          dislikes: data.dislikes || 0,
          userVotes: data.userVotes || {},
          mentionedPlayers: data.mentionedPlayers || [],
          mentionedMatches: data.mentionedMatches || [],
        };
      }
    } catch (e) {
      console.error(
        `[Firestore Error] Error fetching post by slug ${slug}:`,
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("mlbb_generator_posts");
  if (!stored) return null;
  try {
    const list = JSON.parse(stored) as ForumPost[];
    return list.find((post) => post.slug === slug) || null;
  } catch {
    return null;
  }
}

// Save forum post
export async function savePost(
  postData: Omit<
    ForumPost,
    "id" | "slug" | "createdAt" | "views" | "likes" | "dislikes" | "userVotes"
  >,
): Promise<ForumPost> {
  const slug = generatePostSlug(postData.title);
  const createdAt = Date.now();
  const newPost: ForumPost = {
    title: postData.title,
    description: postData.description,
    type: postData.type,
    authorId: postData.authorId,
    authorName: postData.authorName,
    authorAvatar: postData.authorAvatar,
    slug,
    createdAt,
    views: 0,
    likes: 0,
    dislikes: 0,
    userVotes: {},
    tags: postData.tags || [],
    mentionedPlayers: postData.mentionedPlayers || [],
    mentionedMatches: postData.mentionedMatches || [],
    ...(postData.imageUrl ? { imageUrl: postData.imageUrl } : {}),
    id: "", // Will be updated with docRef.id if Firestore succeeds
  };

  if (db && isFirebaseConfigured) {
    try {
      // Create a clean object without the id field and any undefined values for Firestore
      const firestoreData: Omit<ForumPost, "id"> & { id?: string } = {
        ...newPost,
      };
      delete firestoreData.id;
      const postsCol = collection(db, "posts");
      const docRef = await addDoc(postsCol, firestoreData);
      return {
        ...newPost,
        id: docRef.id,
      };
    } catch (e) {
      console.error("[Firestore Error] Error saving post:", e);
    }
  }

  // LocalStorage Fallback
  const id = `local_post_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  const fullPost: ForumPost = {
    ...newPost,
    id,
  };
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("mlbb_generator_posts");
    const list = stored ? (JSON.parse(stored) as ForumPost[]) : [];
    list.push(fullPost);
    localStorage.setItem("mlbb_generator_posts", JSON.stringify(list));
  }
  return fullPost;
}

// Increment post views
export async function incrementPostViews(postId: string): Promise<void> {
  if (db && isFirebaseConfigured && !postId.startsWith("local_")) {
    try {
      const docRef = doc(db, "posts", postId);
      await updateDoc(docRef, {
        views: increment(1),
      });
      return;
    } catch (e) {
      console.error(
        `[Firestore Error] Error incrementing views for post ${postId}:`,
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("mlbb_generator_posts");
    if (stored) {
      try {
        const list = JSON.parse(stored) as ForumPost[];
        const idx = list.findIndex((p) => p.id === postId);
        if (idx !== -1) {
          list[idx].views = (list[idx].views || 0) + 1;
          localStorage.setItem("mlbb_generator_posts", JSON.stringify(list));
        }
      } catch (e) {
        console.error("Error updating views in LocalStorage:", e);
      }
    }
  }
}

// Toggle post feedback (Likes/Dislikes)
export async function togglePostFeedback(
  postId: string,
  targetType: "likes" | "dislikes",
  userId: string,
): Promise<ForumPost | null> {
  const computeNewFeedback = (post: ForumPost): Partial<ForumPost> => {
    const likes = post.likes || 0;
    const dislikes = post.dislikes || 0;
    const userVotes: { [uid: string]: "likes" | "dislikes" } = post.userVotes
      ? { ...post.userVotes }
      : {};
    const currentVote = userVotes[userId] || null;

    let newLikes = likes;
    let newDislikes = dislikes;
    let newVote: "likes" | "dislikes" | null = targetType;

    if (currentVote === targetType) {
      newVote = null;
    }

    if (currentVote === "likes") newLikes = Math.max(0, newLikes - 1);
    if (currentVote === "dislikes") newDislikes = Math.max(0, newDislikes - 1);

    if (newVote === "likes") newLikes += 1;
    if (newVote === "dislikes") newDislikes += 1;

    if (newVote) {
      userVotes[userId] = newVote;
    } else {
      delete userVotes[userId];
    }

    return {
      likes: newLikes,
      dislikes: newDislikes,
      userVotes,
    };
  };

  if (db && isFirebaseConfigured && !postId.startsWith("local_")) {
    try {
      const { runTransaction } = await import("firebase/firestore");
      const docRef = doc(db, "posts", postId);

      const result = await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) {
          throw new Error("Post doc does not exist");
        }

        const postData = sfDoc.data() as ForumPost;
        const newFb = computeNewFeedback(postData);

        transaction.update(docRef, newFb);

        return {
          ...postData,
          ...newFb,
          id: sfDoc.id,
        };
      });

      // Sync local storage
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("mlbb_generator_posts");
        if (stored) {
          try {
            const list = JSON.parse(stored) as ForumPost[];
            const idx = list.findIndex((p) => p.id === postId);
            if (idx !== -1) {
              list[idx] = { ...list[idx], ...result };
              localStorage.setItem(
                "mlbb_generator_posts",
                JSON.stringify(list),
              );
            }
          } catch (e) {
            console.error("Error syncing local storage:", e);
          }
        }
      }

      return result;
    } catch (e) {
      console.error("Error updating post feedback on Firestore:", e);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("mlbb_generator_posts");
    if (stored) {
      try {
        const list = JSON.parse(stored) as ForumPost[];
        const idx = list.findIndex((p) => p.id === postId);
        if (idx !== -1) {
          const post = list[idx];
          const newFb = computeNewFeedback(post);
          const updatedPost = { ...post, ...newFb };
          list[idx] = updatedPost;
          localStorage.setItem("mlbb_generator_posts", JSON.stringify(list));
          return updatedPost;
        }
      } catch (e) {
        console.error("Error updating post feedback in LocalStorage:", e);
      }
    }
  }

  return null;
}

// Fetch comments for a specific post
export async function fetchPostComments(
  postId: string,
): Promise<ForumComment[]> {
  if (db && isFirebaseConfigured && !postId.startsWith("local_")) {
    try {
      const commentsCol = collection(db, "posts", postId, "comments");
      const q = query(commentsCol, orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(q);
      const list: ForumComment[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rawCreatedAt = data.createdAt;
        const createdAt =
          typeof rawCreatedAt === "number"
            ? rawCreatedAt
            : rawCreatedAt?.toMillis
              ? rawCreatedAt.toMillis()
              : Date.now();

        list.push({
          id: docSnap.id,
          postId,
          text: data.text || "",
          createdAt,
          userId: data.userId || "",
          authorName: data.authorName || "",
          authorAvatar: data.authorAvatar || "",
        });
      });
      return list;
    } catch (e) {
      console.error(
        `[Firestore Error] Error fetching comments for post ${postId}:`,
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(`mlbb_generator_post_comments_${postId}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as ForumComment[];
  } catch {
    return [];
  }
}

// Save a comment for a post
export async function savePostComment(
  postId: string,
  text: string,
  authorInfo: { userId: string; authorName: string; authorAvatar: string },
): Promise<ForumComment> {
  const newComment = {
    text,
    createdAt: Date.now(),
    userId: authorInfo.userId,
    authorName: authorInfo.authorName,
    authorAvatar: authorInfo.authorAvatar,
  };

  if (db && isFirebaseConfigured && !postId.startsWith("local_")) {
    try {
      const commentsCol = collection(db, "posts", postId, "comments");
      const docRef = await addDoc(commentsCol, newComment);
      return {
        ...newComment,
        id: docRef.id,
        postId,
      };
    } catch (e) {
      console.error(
        `[Firestore Error] Error saving comment for post ${postId}:`,
        e,
      );
    }
  }

  // LocalStorage Fallback
  const id = `local_postcomment_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  const fullComment: ForumComment = {
    ...newComment,
    id,
    postId,
  };
  if (typeof window !== "undefined") {
    const key = `mlbb_generator_post_comments_${postId}`;
    const stored = localStorage.getItem(key);
    const list = stored ? (JSON.parse(stored) as ForumComment[]) : [];
    list.push(fullComment);
    localStorage.setItem(key, JSON.stringify(list));
  }
  return fullComment;
}

// Delete post
export async function deletePost(postId: string): Promise<boolean> {
  if (db && isFirebaseConfigured && !postId.startsWith("local_")) {
    try {
      const docRef = doc(db, "posts", postId);
      await deleteDoc(docRef);
      return true;
    } catch (e) {
      console.error(`[Firestore Error] Error deleting post ${postId}:`, e);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("mlbb_generator_posts");
    if (stored) {
      try {
        const list = JSON.parse(stored) as ForumPost[];
        const filtered = list.filter((p) => p.id !== postId);
        localStorage.setItem("mlbb_generator_posts", JSON.stringify(filtered));
        localStorage.removeItem(`mlbb_generator_post_comments_${postId}`);
        return true;
      } catch (e) {
        console.error("Error deleting post in LocalStorage:", e);
      }
    }
  }
  return false;
}

// Delete post comment
export async function deletePostComment(
  postId: string,
  commentId: string,
): Promise<boolean> {
  if (db && isFirebaseConfigured && !postId.startsWith("local_")) {
    try {
      const docRef = doc(db, "posts", postId, "comments", commentId);
      await deleteDoc(docRef);
      return true;
    } catch (e) {
      console.error(
        `[Firestore Error] Error deleting comment ${commentId}:`,
        e,
      );
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const key = `mlbb_generator_post_comments_${postId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const list = JSON.parse(stored) as ForumComment[];
        const filtered = list.filter((c) => c.id !== commentId);
        localStorage.setItem(key, JSON.stringify(filtered));
        return true;
      } catch (e) {
        console.error("Error deleting comment in LocalStorage:", e);
      }
    }
  }
  return false;
}

// Update an existing post
export async function updatePost(
  postId: string,
  updatedFields: Partial<
    Omit<
      ForumPost,
      | "id"
      | "slug"
      | "createdAt"
      | "views"
      | "likes"
      | "dislikes"
      | "userVotes"
      | "authorId"
      | "authorName"
      | "authorAvatar"
    >
  > & { tags?: string[] },
): Promise<boolean> {
  if (db && isFirebaseConfigured && !postId.startsWith("local_")) {
    try {
      const docRef = doc(db, "posts", postId);
      // Clean up undefined values for Firestore
      const cleanFields: Record<string, unknown> = {};
      Object.entries(updatedFields).forEach(([key, val]) => {
        if (val !== undefined) {
          cleanFields[key] = val;
        } else {
          // If a field like imageUrl is undefined, we remove it from Firestore using deleteField()
          // or we can set it to null/empty. Let's just set it to null or delete field.
          // In Firestore, we can use deleteField() or simply delete it.
          // Since we want to support removing the image, if imageUrl is undefined or empty string, we can delete the key!
          // We can dynamically import deleteField from firebase/firestore
        }
      });

      // If imageUrl is explicitly undefined in updatedFields (meaning user removed it),
      // we need to set it to null or delete it in Firestore.
      if ("imageUrl" in updatedFields && !updatedFields.imageUrl) {
        const { deleteField } = await import("firebase/firestore");
        cleanFields.imageUrl = deleteField();
      }

      await updateDoc(docRef, cleanFields);
      return true;
    } catch (e) {
      console.error(`[Firestore Error] Error updating post ${postId}:`, e);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("mlbb_generator_posts");
    if (stored) {
      try {
        const list = JSON.parse(stored) as ForumPost[];
        const idx = list.findIndex((p) => p.id === postId);
        if (idx !== -1) {
          const updatedPost = { ...list[idx], ...updatedFields };
          // If imageUrl is undefined or empty, delete it from the object
          if ("imageUrl" in updatedFields && !updatedFields.imageUrl) {
            delete updatedPost.imageUrl;
          }
          list[idx] = updatedPost;
          localStorage.setItem("mlbb_generator_posts", JSON.stringify(list));
          return true;
        }
      } catch (e) {
        console.error("Error updating post in LocalStorage:", e);
      }
    }
  }
  return false;
}

// Upload base64 image helper for Firebase Storage
export async function uploadBase64Image(
  base64DataUrl: string,
  path: string,
): Promise<string> {
  if (!storage) {
    throw new Error("Firebase Storage is not initialized.");
  }
  const storageRef = ref(storage, path);
  const metadata = {
    contentType: "image/jpeg",
  };
  await uploadString(storageRef, base64DataUrl, "data_url", metadata);
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}
