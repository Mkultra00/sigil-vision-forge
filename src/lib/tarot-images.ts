// Rider-Waite-Smith card image URLs (public domain), hosted from
// github.com/krates98/tarotcardapi via jsDelivr for CDN caching.
const BASE = "https://cdn.jsdelivr.net/gh/krates98/tarotcardapi@main/images";

const MAJORS: Record<string, string> = {
  major_00: "thefool.jpeg",
  major_01: "themagician.jpeg",
  major_02: "thehighpriestess.jpeg",
  major_03: "theempress.jpeg",
  major_04: "theemperor.jpeg",
  major_05: "thehierophant.jpeg",
  major_06: "TheLovers.jpg",
  major_07: "thechariot.jpeg",
  major_08: "thestrength.jpeg",
  major_09: "thehermit.jpeg",
  major_10: "wheeloffortune.jpeg",
  major_11: "justice.jpeg",
  major_12: "thehangedman.jpeg",
  major_13: "death.jpeg",
  major_14: "temperance.jpeg",
  major_15: "thedevil.jpeg",
  major_16: "thetower.jpeg",
  major_17: "thestar.jpeg",
  major_18: "themoon.jpeg",
  major_19: "thesun.jpeg",
  major_20: "judgement.jpeg",
  major_21: "theworld.jpeg",
};

const RANKS: Record<string, string> = {
  "01": "ace",
  "02": "two",
  "03": "three",
  "04": "four",
  "05": "five",
  "06": "six",
  "07": "seven",
  "08": "eight",
  "09": "nine",
  "10": "ten",
  "11": "page",
  "12": "knight",
  "13": "queen",
  "14": "king",
};

export function tarotImageUrl(code: string): string | null {
  if (MAJORS[code]) return `${BASE}/${MAJORS[code]}`;
  const m = /^minor_(cups|wands|swords|pentacles)_(\d{2})$/.exec(code);
  if (!m) return null;
  const rank = RANKS[m[2]];
  if (!rank) return null;
  return `${BASE}/${rank}of${m[1]}.jpeg`;
}