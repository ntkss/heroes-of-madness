export interface Player {
  id: string;
  name: string;
  imageURL?: string;
}

/** The squad — used for Quick Fill and slot-rolling animation */
const AVATAR = (seed: string) =>
  `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=1a1a2e`;

export const SQUAD: Player[] = [
  { id: "nutty",      name: "Nutty",      imageURL: AVATAR("nutty") },
  { id: "bas",        name: "Bas",        imageURL: AVATAR("bas") },
  { id: "jajou",      name: "Jajou",      imageURL: AVATAR("jajou") },
  { id: "moonshadow", name: "Moonshadow", imageURL: AVATAR("moonshadow") },
  { id: "jimmy",      name: "jimmy",      imageURL: AVATAR("jimmy") },
  { id: "tongpeng",   name: "ตงเผง",      imageURL: AVATAR("tongpeng") },
  { id: "aisee",      name: "อ้ายสี",     imageURL: AVATAR("aisee") },
  { id: "mingjai",    name: "หมิงใจเด็ด", imageURL: AVATAR("mingjai") },
  { id: "iitumii",    name: "iiTumii",    imageURL: AVATAR("iitumii") },
  { id: "beer",       name: "Beer",       imageURL: AVATAR("beer") },
  { id: "pakong",     name: "ป๋าคนแก่",   imageURL: AVATAR("pakong") },
  { id: "mangue",     name: "มังกือ",     imageURL: AVATAR("mangue") },
  { id: "title",      name: "ไตเติ้ล",    imageURL: AVATAR("title") },
];

/** Just the display names, derived from SQUAD — use wherever a string[] is needed */
export const SQUAD_NAMES: string[] = SQUAD.map((p) => p.name);

/** Fallback pool for auto-filling slots when fewer than 10 players are entered */
export const FILL_POOL: Player[] = [
  { id: "fill_shadow",    name: "Shadow" },
  { id: "fill_phoenix",   name: "Phoenix" },
  { id: "fill_viper",     name: "Viper" },
  { id: "fill_gladiator", name: "Gladiator" },
  { id: "fill_rogue",     name: "Rogue" },
  { id: "fill_specter",   name: "Specter" },
  { id: "fill_apex",      name: "Apex" },
  { id: "fill_titan",     name: "Titan" },
  { id: "fill_phantom",   name: "Phantom" },
  { id: "fill_ghost",     name: "Ghost" },
  { id: "fill_alpha",     name: "Alpha" },
  { id: "fill_nexus",     name: "Nexus" },
  { id: "fill_slayer",    name: "Slayer" },
  { id: "fill_striker",   name: "Striker" },
  { id: "fill_storm",     name: "Storm" },
  { id: "fill_raven",     name: "Raven" },
  { id: "fill_blaze",     name: "Blaze" },
  { id: "fill_hunter",    name: "Hunter" },
  { id: "fill_maverick",  name: "Maverick" },
  { id: "fill_wolf",      name: "Wolf" },
  { id: "fill_echo",      name: "Echo" },
  { id: "fill_falcon",    name: "Falcon" },
  { id: "fill_kaiser",    name: "Kaiser" },
  { id: "fill_zero",      name: "Zero" },
  { id: "fill_nova",      name: "Nova" },
  { id: "fill_cipher",    name: "Cipher" },
  { id: "fill_ryder",     name: "Ryder" },
  { id: "fill_lynx",      name: "Lynx" },
  { id: "fill_ace",       name: "Ace" },
  { id: "fill_krypton",   name: "Krypton" },
  { id: "fill_zephyr",    name: "Zephyr" },
];

export const FILL_POOL_NAMES: string[] = FILL_POOL.map((p) => p.name);
