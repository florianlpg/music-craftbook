const PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const MODES = ["major", "minor"] as const;
type Pitch = (typeof PITCHES)[number];
type Mode = (typeof MODES)[number];
export type MusicalKey = `${Pitch} ${Mode}`;

export const MUSICAL_KEYS = PITCHES.flatMap((pitch) => MODES.map((mode): MusicalKey => `${pitch} ${mode}`));

const NATURAL_PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FLAT_SPELLINGS: Partial<Record<Pitch, string>> = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };
const ACCIDENTAL = String.raw`[ \t]*(?:[#♯b♭]|sharp|flat)`;
const NOTE = String.raw`[A-G](?:${ACCIDENTAL})?`;
const MODE = String.raw`(?:major|minor|maj|min|m)`;
const COMPLETE_KEY = new RegExp(String.raw`^([A-G])(${ACCIDENTAL})?[ \t]*(${MODE})$`, "i");
const LABELED_KEY = new RegExp(String.raw`\bkey(?:[ \t]+of)?(?:[ \t]*[:=\-–—][ \t]*|[ \t]+)(${NOTE}[ \t]*${MODE})(?![\w#♯♭])`, "i");
const UNLABELED_KEY = new RegExp(String.raw`(?<![\w#♯♭])(${NOTE})[ \t]*(${MODE})(?![\w#♯♭])`, "gi");

export function normalizeMusicalKey(value: string): MusicalKey | null {
  const match = COMPLETE_KEY.exec(value.trim());
  if (!match) return null;
  const [, note, accidental, mode] = match;
  const spelling = accidental?.trim().toLowerCase();
  const shift = spelling ? (["b", "♭", "flat"].includes(spelling) ? -1 : 1) : 0;
  const pitch = PITCHES[(NATURAL_PITCH[note.toUpperCase()] + shift + PITCHES.length) % PITCHES.length];
  const quality = mode === "M" || mode.toLowerCase().startsWith("maj") ? "major" : "minor";
  return `${pitch} ${quality}`;
}

export function musicalKeySearchTerms(key: MusicalKey): string[] {
  const [pitch, mode] = key.split(" ") as [Pitch, Mode];
  const flat = FLAT_SPELLINGS[pitch];
  return flat ? [key, `${flat} ${mode}`] : [key];
}

export function extractMusicalKey(...sources: string[]): MusicalKey | null {
  // Prefer a labeled key over incidental mentions. A pitch alone has no mode.
  for (const source of sources) {
    const match = source.match(LABELED_KEY);
    if (match) return normalizeMusicalKey(match[1]);
  }

  for (const source of sources) {
    for (const match of source.matchAll(UNLABELED_KEY)) {
      const [, note, mode] = match;
      // Avoid common prose and acronyms such as "AM" and "a minor update".
      if (mode === "M" || match[0] === "am") continue;
      if (/^a$/i.test(note) && /^(minor|major)$/i.test(mode)) {
        const followingWord = source.slice(match.index + match[0].length).match(/^[ \t]+([a-z]+)/i)?.[1];
        if (followingWord && !/^(beat|instrumental|type|scale|key|bpm)$/i.test(followingWord)) continue;
      }
      return normalizeMusicalKey(match[0]);
    }
  }
  return null;
}
