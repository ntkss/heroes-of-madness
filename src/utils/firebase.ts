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
  Firestore
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
  avartar?: string;
  imageURL?: string;
  winrate: number;
  current_rank: string;
  highest_rank: string;
  total_match_played: number;
  role?: string;
  createdAt?: number;
}

const isDev = process.env.NODE_ENV === "development";

// Check if all essential Firebase variables are defined in the environment
// In development, always use LocalStorage to avoid polluting production data
export const isFirebaseConfigured = !isDev && !!(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID
);

if (isDev) {
  console.log("🛠️ Development mode — using LocalStorage only (Firebase disabled).");
} else {
  console.log("🔍 [Firebase Diagnostic] Keys resolved:", {
    apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    isFirebaseConfigured
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
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    console.log("🔥 Firebase initialized successfully!");
  } catch (error) {
    console.error("❌ Firebase initialization error, falling back to LocalStorage:", error);
  }
} else if (!isDev) {
  console.log("💾 Firebase environment variables missing. Operating in offline LocalStorage mode.");
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
          winner: data.winner !== undefined ? data.winner : null
        });
      });
      return list;
    } catch (e) {
      console.error("Error fetching from Firestore, switching to LocalStorage:", e);
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
    id: db ? "" : `local_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`
  };

  if (db) {
    try {
      const matchesCol = collection(db, "matches");
      const docRef = await addDoc(matchesCol, newMatch);
      newMatch.id = docRef.id;
      return newMatch;
    } catch (e) {
      console.error("Error writing to Firestore, saving to LocalStorage instead:", e);
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
export async function updateMatchWinner(matchId: string, winner: "teamA" | "teamB" | null): Promise<boolean> {
  if (db && !matchId.startsWith("local_")) {
    try {
      const docRef = doc(db, "matches", matchId);
      await updateDoc(docRef, { winner });
      return true;
    } catch (e) {
      console.error("Error updating Firestore match, updating LocalStorage instead:", e);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const list = JSON.parse(stored) as Match[];
      const idx = list.findIndex(m => m.id === matchId);
      if (idx !== -1) {
        list[idx].winner = winner;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        return true;
      }
    }
  }
  return false;
}

// Delete match from history
export async function deleteMatch(matchId: string): Promise<boolean> {
  if (db && !matchId.startsWith("local_")) {
    try {
      const docRef = doc(db, "matches", matchId);
      await deleteDoc(docRef);
      return true;
    } catch (e) {
      console.error("Error deleting from Firestore, deleting from LocalStorage instead:", e);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      let list = JSON.parse(stored) as Match[];
      list = list.filter(m => m.id !== matchId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      return true;
    }
  }
  return false;
}

const LOCAL_PLAYERS_KEY = "mlbb_generator_players";

// Fetch players (loaded from Firestore, falls back to LocalStorage, seeds with SQUAD if empty)
export async function fetchPlayers(): Promise<DbPlayer[]> {
  let list: DbPlayer[] = [];
  
  if (db) {
    try {
      const playersCol = collection(db, "players");
      const q = query(playersCol, orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();

        const avatarVal = data.avatar || data.avartar || data.imageURL || "";
        list.push({
          id: docSnap.id,
          name: data.name || "",
          alias: data.alias || "",
          avatar: avatarVal,
          avartar: avatarVal,
          imageURL: avatarVal,
          winrate: Number(data.winrate) || 0,
          current_rank: data.current_rank || "Epic",
          highest_rank: data.highest_rank || "Epic",
          total_match_played: Number(data.total_match_played) || 0,
          role: data.role || "ALL-ROUNDER",
          createdAt: data.createdAt || Date.now()
        });
      });
      
      if (list.length > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(list));
        }
        return list;
      }
      
      console.log("Firestore players collection is empty. Seeding initial squad to Firestore...");
      
      const seedList: DbPlayer[] = SQUAD.map((p) => {
        const avatarVal = p.imageURL || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${p.id}&backgroundColor=1a1a2e`;
        return {
          id: p.id,
          name: p.name,
          alias: p.id,
          avatar: avatarVal,
          avartar: avatarVal,
          imageURL: avatarVal,
          winrate: 0,
          current_rank: "Legend",
          highest_rank: "Legend",
          total_match_played: 0,
          role: "ALL-ROUNDER",
          createdAt: Date.now()
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
          createdAt: player.createdAt
        });
      }
      
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(seedList));
      }
      return seedList;
    } catch (e) {
      console.error("Error fetching/seeding players on Firestore, switching to LocalStorage:", e);
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
      const avatarVal = p.imageURL || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${p.id}&backgroundColor=1a1a2e`;
      return {
        id: p.id,
        name: p.name,
        alias: p.id,
        avatar: avatarVal,
        avartar: avatarVal,
        imageURL: avatarVal,
        winrate: 0,
        current_rank: "Legend",
        highest_rank: "Legend",
        total_match_played: 0,
        role: "ALL-ROUNDER",
        createdAt: Date.now()
      };
    });

    localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(seedList));
    return seedList;
  }
  
  return [];
}

// Save a new player to database
export async function savePlayer(playerData: Omit<DbPlayer, "id">): Promise<DbPlayer> {
  const nameTrimmed = (playerData.name || "").trim();
  if (!nameTrimmed) {
    throw new Error("FIGHTER NAME CANNOT BE EMPTY!");
  }
  const docId = nameTrimmed.toLowerCase();
  const cleanAvatar = playerData.avatar || playerData.avartar || playerData.imageURL || "";
  
  const firestoreData = {
    name: nameTrimmed,
    alias: playerData.alias || docId,
    avatar: cleanAvatar,
    winrate: Number(playerData.winrate) || 0,
    current_rank: playerData.current_rank,
    highest_rank: playerData.highest_rank,
    total_match_played: Number(playerData.total_match_played) || 0,
    role: playerData.role || "ALL-ROUNDER",
    createdAt: Date.now()
  };

  const id = docId;
  const newPlayer: DbPlayer = {
    ...firestoreData,
    id,
    avatar: cleanAvatar,
    avartar: cleanAvatar,
    imageURL: cleanAvatar
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
        const filteredList = list.filter(p => p.id !== docId && p.name.toLowerCase() !== docId);
        filteredList.push(newPlayer);
        localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(filteredList));
      }
      
      return newPlayer;
    } catch (e: any) {
      if (e?.message === "FIGHTER NAME ALREADY EXISTS!") {
        throw e;
      }
      console.error("Error writing player to Firestore, saving to LocalStorage instead:", e);
    }
  }

  // LocalStorage Fallback
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_PLAYERS_KEY);
    const list = stored ? (JSON.parse(stored) as DbPlayer[]) : [];
    const nameExists = list.some(p => p.name.toLowerCase() === docId || p.id === docId);
    if (nameExists) {
      throw new Error("FIGHTER NAME ALREADY EXISTS!");
    }
    list.push(newPlayer);
    localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(list));
  }
  return newPlayer;
}
