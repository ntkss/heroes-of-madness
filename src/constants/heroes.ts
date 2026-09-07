export type GameType = "ROV" | "MLBB";

export type HeroLane = "Top" | "Jungle" | "Mid" | "ADC" | "Support";

export const HERO_LANES: HeroLane[] = [
  "Top",
  "Jungle",
  "Mid",
  "ADC",
  "Support",
];

/**
 * Normalizes any legacy or variant lane name to the standardized 5 lane names:
 * Top, Jungle, Mid, ADC, Support
 */
export function normalizeLane(rawLane: string | undefined | null): string {
  if (!rawLane) return "";
  const l = rawLane.trim().toLowerCase();
  if (l === "top" || l === "fighter" || l === "exp" || l === "top lane")
    return "Top";
  if (l === "jungle" || l === "assassin" || l === "jug" || l === "jungler")
    return "Jungle";
  if (l === "mid" || l === "mage" || l === "mid lane") return "Mid";
  if (l === "adc" || l === "marksman" || l === "gold" || l === "gold lane")
    return "ADC";
  if (
    l === "support" ||
    l === "tank / support" ||
    l === "tank/support" ||
    l === "tank" ||
    l === "roam" ||
    l === "roaming" ||
    l === "sup"
  )
    return "Support";
  return rawLane;
}

export interface HeroRandomResult {
  game: GameType;
  lane: HeroLane;
  hero: string;
}

/**
 * Hero pools mapped by Game -> Lane -> Array of Hero Names.
 * Structured so heroes can easily be added, removed, or reassigned to another lane.
 */
export const HERO_POOLS: Record<GameType, Record<HeroLane, string[]>> = {
  ROV: {
    Support: [
      "Thane",
      "Toro",
      "Mina",
      "Taara",
      "Lumburr",
      "Cresht",
      "Arum",
      "Baldum",
      "Y'bneth",
      "Maloch",
      "Teemee",
      "Annette",
      "Helen",
      "Alice",
      "Chaugnar",
      "Xeniel",
      "Zip",
      "Rouie",
      "Aya",
      "Krizzix",
      "Ormarr",
      "Grakk",
      "Wiro",
    ],
    Top: [
      "Arthur",
      "Lu Bu",
      "Ryoma",
      "Florentino",
      "Yena",
      "Riktor",
      "Omen",
      "Kil'Groth",
      "Qi",
      "Errol",
      "Astrid",
      "Allain",
      "Tachi",
      "Yan",
      "Zuka",
      "Skud",
      "Airi",
      "Amily",
      "Wonder Woman",
      "Dextra",
      "Veres",
      "Bijan",
      "Biron",
      "Charlotte",
    ],
    Jungle: [
      "Nakroth",
      "Murad",
      "Quillen",
      "Butterfly",
      "Kriknak",
      "Keera",
      "Enzo",
      "Sinestrea",
      "Aoi",
      "Kaine",
      "Zill",
      "Paine",
      "Bright",
      "Wukong",
    ],
    Mid: [
      "Krixi",
      "Veera",
      "Natalya",
      "Liliana",
      "Raz",
      "Tulen",
      "Lauriel",
      "D'Arcy",
      "Dirak",
      "Lorion",
      "Iggy",
      "Yue",
      "Bonnie",
      "Kahlii",
      "Mganga",
      "Azzen'Ka",
      "Aleister",
      "Ilumia",
      "Preyta",
      "Marja",
      "Zata",
      "Ishar",
      "Diaochan",
      "Sephera",
      "Ming",
    ],
    ADC: [
      "Valhein",
      "Yorn",
      "Tel'Annas",
      "Violet",
      "Hayate",
      "Capheny",
      "Laville",
      "Elsu",
      "Slimz",
      "Fennik",
      "Lindis",
      "Moren",
      "Wisp",
      "Celica",
      "Thorne",
      "Stuart",
      "Erin",
      "Terri",
    ],
  },
  MLBB: {
    Support: [
      "Tigreal",
      "Akai",
      "Franco",
      "Minotaur",
      "Lolita",
      "Johnson",
      "Gatotkaca",
      "Grock",
      "Hylos",
      "Uranus",
      "Belerick",
      "Khufra",
      "Baxia",
      "Atlas",
      "Barats",
      "Gloo",
      "Edith",
      "Fredrinn",
      "Chip",
      "Angela",
      "Estes",
      "Rafaela",
      "Diggie",
      "Mathilda",
      "Carmilla",
      "Floryn",
    ],
    Top: [
      "Balmond",
      "Alucard",
      "Bane",
      "Zilong",
      "Freya",
      "Chou",
      "Sun",
      "Alpha",
      "Ruby",
      "Hilda",
      "Lapu-Lapu",
      "Roger",
      "Argus",
      "Jawhead",
      "Martis",
      "Kaja",
      "Aldous",
      "Leomord",
      "Badang",
      "Guinevere",
      "Terizla",
      "X.Borg",
      "Dyrroth",
      "Masha",
      "Silvanna",
      "Yu Zhong",
      "Khaleed",
      "Paquito",
      "Phoveus",
      "Yin",
      "Julian",
      "Arlott",
      "Cici",
    ],
    Jungle: [
      "Saber",
      "Karina",
      "Fanny",
      "Hayabusa",
      "Natalia",
      "Lancelot",
      "Helcurt",
      "Gusion",
      "Hanzo",
      "Ling",
      "Benedetta",
      "Aamon",
      "Joy",
      "Nolan",
      "Suyou",
    ],
    Mid: [
      "Nana",
      "Eudora",
      "Gord",
      "Kagura",
      "Cyclops",
      "Aurora",
      "Vexana",
      "Harley",
      "Odette",
      "Zhask",
      "Pharsa",
      "Valir",
      "Chang'e",
      "Vale",
      "Lunox",
      "Harith",
      "Kadita",
      "Lylia",
      "Cecilion",
      "Luo Yi",
      "Yve",
      "Valentina",
      "Xavier",
      "Novaria",
      "Zhuxin",
    ],
    ADC: [
      "Miya",
      "Bruno",
      "Clint",
      "Layla",
      "Moskov",
      "Karrie",
      "Irithel",
      "Lesley",
      "Hanabi",
      "Claude",
      "Kimmy",
      "Granger",
      "Wanwan",
      "Popol and Kupa",
      "Brody",
      "Beatrix",
      "Natan",
      "Melissa",
      "Ixia",
    ],
  },
};

/**
 * Randomly selects a lane first, then randomly selects a hero belonging to that lane.
 *
 * @param game "ROV" | "MLBB"
 * @param overrideLane Optional lane if user wants to randomize within a specific lane
 * @returns { game, lane, hero }
 */
export function getRandomHero(
  game: GameType,
  overrideLane?: HeroLane,
): HeroRandomResult {
  const gamePool = HERO_POOLS[game];
  const selectedLane: HeroLane =
    overrideLane || HERO_LANES[Math.floor(Math.random() * HERO_LANES.length)];

  const pool = gamePool[selectedLane];
  if (!pool || pool.length === 0) {
    throw new Error(`No heroes configured for ${game} in lane ${selectedLane}`);
  }

  const selectedHero = pool[Math.floor(Math.random() * pool.length)];

  return {
    game,
    lane: selectedLane,
    hero: selectedHero,
  };
}

/**
 * Returns total count of heroes for a game
 */
export function getHeroCount(game: GameType): number {
  return Object.values(HERO_POOLS[game]).reduce(
    (acc, list) => acc + list.length,
    0,
  );
}
