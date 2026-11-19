import type { DeepWordAnalysis } from '../types';

export type PinyinTone = 1 | 2 | 3 | 4 | 5;

const TONE_MAP: Record<string, PinyinTone> = {
  ā: 1, ē: 1, ī: 1, ō: 1, ū: 1, ǖ: 1,
  Ā: 1, Ē: 1, Ī: 1, Ō: 1, Ū: 1, Ǖ: 1,
  á: 2, é: 2, í: 2, ó: 2, ú: 2, ǘ: 2,
  Á: 2, É: 2, Í: 2, Ó: 2, Ú: 2, Ǘ: 2,
  ǎ: 3, ě: 3, ǐ: 3, ǒ: 3, ǔ: 3, ǚ: 3,
  Ǎ: 3, Ě: 3, Ǐ: 3, Ǒ: 3, Ǔ: 3, Ǚ: 3,
  à: 4, è: 4, ì: 4, ò: 4, ù: 4, ǜ: 4,
  À: 4, È: 4, Ì: 4, Ò: 4, Ù: 4, Ǜ: 4,
};

export const TONE_STYLE: Record<
  PinyinTone,
  { text: string; label: string; dot: string }
> = {
  1: { text: 'text-[#d9534f]', label: 'Thanh 1 (ngang)', dot: 'bg-[#d9534f]' },
  2: { text: 'text-[#1f7a63]', label: 'Thanh 2 (hỏi/sắc)', dot: 'bg-[#1f7a63]' },
  3: { text: 'text-[#b45309]', label: 'Thanh 3 (huyền-lên)', dot: 'bg-[#b45309]' },
  4: { text: 'text-[#2563eb]', label: 'Thanh 4 (nặng/hạ)', dot: 'bg-[#2563eb]' },
  5: { text: 'text-[#616b66]', label: 'Thanh nhẹ', dot: 'bg-[#616b66]' },
};

export function detectSyllableTone(syllable: string): PinyinTone {
  const nfc = (syllable || '').normalize('NFC');
  for (const ch of nfc) {
    if (TONE_MAP[ch]) return TONE_MAP[ch];
  }
  return 5;
}

/**
 * Splits a Pinyin string into syllables/tokens while preserving punctuation/spaces.
 * Supports multi-syllable joined pinyin (e.g. "zhīdào", "túshūguǎn") by splitting at
 * syllable boundaries or whitespace.
 */
export function splitPinyinTokens(pinyin: string): { text: string; tone: PinyinTone; isWord: boolean }[] {
  const raw = (pinyin || '').trim();
  if (!raw) return [];

  // Split by whitespace first; if a chunk contains multiple tone vowels without space, split greedily
  const chunks = raw.split(/(\s+)/);
  const out: { text: string; tone: PinyinTone; isWord: boolean }[] = [];

  for (const chunk of chunks) {
    if (!chunk) continue;
    if (/^\s+$/.test(chunk)) {
      out.push({ text: chunk, tone: 5, isWord: false });
      continue;
    }

    // Attempt to split joined pinyin syllables using standard initials + finals regex
    const syllableRegex =
      /(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ueng|iao|uai|uan|ang|eng|ing|ong|ian|iao|iou|ie|ve|üe|er|ai|ei|ao|ou|an|en|in|un|ün|ia|ua|uo|a|o|e|i|u|ü|v)[\u0300-\u030c]?|[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+/gi;

    // Better: normalize to NFD to count tone marks; if >=2 tone marks in a single chunk, match syllables
    const toneMatches = [...chunk.normalize('NFC')].filter((c) => Boolean(TONE_MAP[c]));
    if (toneMatches.length <= 1) {
      out.push({
        text: chunk,
        tone: detectSyllableTone(chunk),
        isWord: /[a-zA-Z\u00C0-\u024F]/.test(chunk),
      });
    } else {
      // Split on vowel+tone/nasal ending followed by initial consonant
      const parts = chunk.match(syllableRegex);
      if (parts && parts.join('').length === chunk.length) {
        parts.forEach((part) => {
          out.push({
            text: part,
            tone: detectSyllableTone(part),
            isWord: /[a-zA-Z\u00C0-\u024F]/.test(part),
          });
        });
      } else {
        out.push({
          text: chunk,
          tone: detectSyllableTone(chunk),
          isWord: true,
        });
      }
    }
  }

  return out;
}

export function getToneSummaryFromPinyin(pinyin: string): string {
  const tokens = splitPinyinTokens(pinyin).filter((t) => t.isWord);
  if (!tokens.length) return '—';
  return tokens.map((t) => (t.tone === 5 ? 'Thanh nhẹ' : `Thanh ${t.tone}`)).join(' + ');
}

const DEEP_DICT_CACHE_KEY = 'hv_deep_dict_v1';
const PERSONAL_NOTES_KEY = 'hv_personal_notes_v1';

export function getCachedWordAnalysis(hanzi: string): DeepWordAnalysis | null {
  const key = (hanzi || '').trim();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(DEEP_DICT_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, DeepWordAnalysis>;
    return map[key] || null;
  } catch {
    return null;
  }
}

export function setCachedWordAnalysis(hanzi: string, analysis: DeepWordAnalysis): void {
  const key = (hanzi || '').trim();
  if (!key) return;
  try {
    const raw = localStorage.getItem(DEEP_DICT_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, DeepWordAnalysis>) : {};
    map[key] = { ...analysis, updatedAt: Date.now() };
    localStorage.setItem(DEEP_DICT_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function getPersonalNote(hanzi: string): string {
  const key = (hanzi || '').trim();
  if (!key) return '';
  try {
    const raw = localStorage.getItem(PERSONAL_NOTES_KEY);
    if (!raw) return '';
    const map = JSON.parse(raw) as Record<string, string>;
    return map[key] || '';
  } catch {
    return '';
  }
}

export function savePersonalNote(hanzi: string, note: string): void {
  const key = (hanzi || '').trim();
  if (!key) return;
  try {
    const raw = localStorage.getItem(PERSONAL_NOTES_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (note.trim()) {
      map[key] = note;
    } else {
      delete map[key];
    }
    localStorage.setItem(PERSONAL_NOTES_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}
