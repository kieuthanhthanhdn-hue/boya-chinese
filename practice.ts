import { TM } from '../data/boyaSeed';
import type {
  HskQuestion,
  Word,
  WordMasteryStatus,
  WordProgress,
} from '../types';
export { BOYA_COLLOCATIONS as COLLOCATION_BANK } from './collocations';

export const PU_REGEX = /^[，。？！、]$/;

export function dk(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function td(): string {
  return dk(0);
}

export function fdt(ms: number): string {
  const d = new Date(ms);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

export function shuf<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickExample(w: Word): { ex: string; exvi: string } {
  if (w.exs && w.exs.length > 0) {
    const idx = Math.floor(Math.random() * w.exs.length);
    return {
      ex: w.exs[idx][0] || '',
      exvi: w.exs[idx][1] || '',
    };
  }
  return {
    ex: w.ex || '',
    exvi: w.exvi || '',
  };
}

export function cleanSentence(ex?: string): string {
  return (ex || '').replace(/ /g, '');
}

export function tokenizeSentence(ex?: string): string[] {
  if (!ex) return [];
  return ex
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !PU_REGEX.test(t));
}

export function wordStatus(p?: WordProgress): WordMasteryStatus {
  if (!p || !p.n) return 'Mới';
  if (p.box >= 3) return 'Thuộc';
  if (p.box >= 1) return 'Đang học';
  return 'Chưa nhớ';
}

export function nz(s: string): string {
  return [...(s || '')].filter((c) => !/[\s，。？！、,.?!]/.test(c)).join('');
}

export function spn(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[0-9\u0300-\u0304\u030c]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s]/g, '');
}

export function lcs(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] =
        a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
    }
  }
  return d[m][n];
}

export function sim(a: string, b: string): 0 | 1 | 2 {
  if (a === b) return 2;
  const ratio = lcs(a, b) / Math.max(a.length, b.length, 1);
  return ratio >= 0.8 ? 1 : 0;
}

export function varyPinyin(py: string): string {
  const ch = [...(py || '')];
  const ix: [number, string][] = [];
  ch.forEach((c, i) => {
    for (const k of Object.keys(TM)) {
      if (TM[k].includes(c)) ix.push([i, k]);
    }
  });
  if (!ix.length) return py;
  const [i, k] = ix[Math.floor(Math.random() * ix.length)];
  const cur = TM[k].indexOf(ch[i]);
  let t = cur;
  for (let guard = 0; guard < 10 && t === cur; guard++) {
    t = Math.floor(Math.random() * 4);
  }
  ch[i] = TM[k][t];
  return ch.join('');
}

export function parseCsv(text: string): string[][] {
  const cleanText = (text || '').replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < cleanText.length; i++) {
    const c = cleanText[i];
    if (inQuotes) {
      if (c === '"') {
        if (cleanText[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && cleanText[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function mkq(w: Word, rawType: string, allWords: Word[]): HskQuestion {
  const picked = pickExample(w);
  const hx = picked.ex || '';
  const hxVi = picked.exvi || '';
  const s = cleanSentence(hx);
  const tk = tokenizeSentence(hx);
  const ds = shuf(allWords.filter((x) => x.id !== w.id && (!hx || Boolean(x.ex)))).slice(0, 3);

  const LS = '听力 · Nghe';
  const RS = '阅读 · Đọc';
  const WS = '书写 · Viết';

  let ty = rawType;
  if (ty === 'L2' && !hx) ty = 'L1';
  if (ty === 'R2' && !hx) ty = 'R1';
  if ((ty === 'R3' || ty === 'W1') && tk.length < 3) ty = 'W2';

  const makeOptQuestion = (
    optMapper: (x: Word) => string,
    extra: Partial<HskQuestion>
  ): HskQuestion => {
    const items = shuf([w, ...ds]);
    return {
      w,
      sec: RS,
      promptTitle: '',
      opts: items.map(optMapper),
      a: items.indexOf(w),
      exp: hx ? `${s} = ${hxVi}` : `${w.h} (${w.py}) = ${w.vi}`,
      ...extra,
    };
  };

  if (ty === 'L1') {
    return makeOptQuestion(
      (x) => {
        if (!hx) return x.vi;
        return x.id === w.id ? hxVi : x.exvi || x.vi;
      },
      {
        sec: LS,
        say: hx ? s : w.h,
        promptTitle: 'Nghe đoạn phát âm và chọn ý đúng',
      }
    );
  }

  if (ty === 'L2') {
    const alt = ds[0]?.exvi || ds[0]?.vi || '';
    const matchTarget = Math.random() < 0.5 || !alt ? hxVi : alt;
    return {
      w,
      sec: LS,
      say: s,
      promptTitle: 'Câu vừa nghe có đúng với ý bên dưới không?',
      promptSub: matchTarget,
      opts: ['Đúng', 'Sai'],
      a: matchTarget === hxVi ? 0 : 1,
      exp: `${s} = ${hxVi}`,
    };
  }

  if (ty === 'R1') {
    return makeOptQuestion((x) => x.h, {
      sec: RS,
      zhOpts: true,
      promptTitle: 'Chọn chữ Hán đúng với Pinyin',
      promptSub: w.py,
    });
  }

  if (ty === 'R2') {
    return makeOptQuestion((x) => x.h, {
      sec: RS,
      zhOpts: true,
      promptTitle: 'Điền từ thích hợp vào chỗ trống',
      promptZh: s.includes(w.h) ? s.replace(w.h, '＿＿') : `${s} (＿＿)`,
      promptSub: hxVi,
    });
  }

  if (ty === 'R3' || ty === 'W1') {
    const cr = tk.join('');
    const wr = new Set<string>();
    for (let i = 0; i < 30 && wr.size < 3; i++) {
      const candidate = shuf(tk).join('');
      if (candidate !== cr) wr.add(candidate);
    }
    if (wr.size < 2) return mkq(w, 'W2', allWords);
    const opts = shuf([cr, ...wr]);
    return {
      w,
      sec: WS,
      zhOpts: true,
      promptTitle: 'Sắp xếp các từ thành câu chuẩn ngữ pháp',
      promptZh: shuf(tk).join(' / '),
      promptSub: hxVi,
      opts,
      a: opts.indexOf(cr),
      exp: `${s} = ${hxVi}`,
    };
  }

  if (ty === 'W2') {
    return makeOptQuestion((x) => x.h, {
      sec: WS,
      zhOpts: true,
      promptTitle: 'Chọn tổ hợp chữ Hán đúng với nghĩa & Pinyin',
      promptSub: `${w.vi} (${w.py})`,
    });
  }

  if (ty === 'R5') {
    const poolWithEx = shuf(allWords.filter((x) => Boolean(x.ex)));
    const ps = poolWithEx.slice(0, 3);
    if (ps.length < 3) return mkq(w, 'R4', allWords);
    const k = ps[0];
    const distractors = shuf(allWords.filter((x) => x.ex && !ps.includes(x))).slice(0, 3);
    const opts = shuf([k.exvi, ...distractors.map((x) => x.exvi)].filter(Boolean));
    if (opts.length < 3) return mkq(w, 'R4', allWords);
    return {
      w: k,
      sec: RS,
      promptTitle: 'Đọc đoạn văn ngắn và chọn ý có trong đoạn',
      promptZh: ps.map((x) => cleanSentence(x.ex)).join(' '),
      opts,
      a: opts.indexOf(k.exvi),
      exp: ps.map((x) => `${cleanSentence(x.ex)} = ${x.exvi}`).join(' | '),
    };
  }

  return makeOptQuestion((x) => x.vi, {
    sec: RS,
    promptTitle: 'Chọn nghĩa tiếng Việt đúng',
    promptZh: w.h,
  });
}

export function pickWeightedWord(
  words: Word[],
  progress: Record<string, { box?: number; due?: number; wrong?: number; n?: number }>
): Word | null {
  if (!words.length) return null;
  const now = Date.now();
  const weights = words.map((w) => {
    const p = progress[w.id] || progress[w.h];
    if (!p || !p.n) return 4; // new word
    let wt = 3;
    if ((p.wrong || 0) > 0) wt += Math.min(6, (p.wrong || 0) * 2);
    if ((p.due || 0) <= now) wt += 4;
    if ((p.box || 0) >= 4 && (p.due || 0) > now) wt = 0.6; // reduce mastered frequency
    else if ((p.box || 0) >= 3 && (p.due || 0) > now) wt = 1.2;
    return wt;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < words.length; i++) {
    r -= weights[i];
    if (r <= 0) return words[i];
  }
  return words[0];
}

export function toTonelessPinyin(py: string): string {
  return (py || '')
    .normalize('NFD')
    .replace(/[\u0300-\u0304\u030c]/g, '')
    .replace(/ü/g, 'v')
    .replace(/Ü/g, 'V')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '');
}

const COMMON_SYLLABLE_BANK: { py: string; hanzi: string[] }[] = [
  { py: 'wo', hanzi: ['我', '握', '卧'] },
  { py: 'ni', hanzi: ['你', '您', '泥'] },
  { py: 'ta', hanzi: ['他', '她', '它'] },
  { py: 'de', hanzi: ['的', '得', '地'] },
  { py: 'shi', hanzi: ['是', '十', '事', '时'] },
  { py: 'bu', hanzi: ['不', '步', '部'] },
  { py: 'hen', hanzi: ['很', '恨'] },
  { py: 'da', hanzi: ['大', '打', '答'] },
  { py: 'qu', hanzi: ['去', '区', '取'] },
  { py: 'lai', hanzi: ['来', '赖'] },
  { py: 'ma', hanzi: ['吗', '妈', '马'] },
  { py: 'ne', hanzi: ['呢'] },
  { py: 'zai', hanzi: ['在', '再', '载'] },
  { py: 'nar', hanzi: ['哪儿', '那儿'] },
  { py: 'zher', hanzi: ['这儿'] },
  { py: 'you', hanzi: ['有', '右', '友'] },
  { py: 'yi', hanzi: ['一', '医', '衣'] },
  { py: 'ge', hanzi: ['个', '哥', '歌'] },
  { py: 'zhe', hanzi: ['这', '着'] },
  { py: 'na', hanzi: ['那', '哪', '拿'] },
  { py: 'xiexie', hanzi: ['谢谢'] },
  { py: 'qingwen', hanzi: ['请问'] },
  { py: 'tushuguan', hanzi: ['图书馆', '图书管'] },
  { py: 'duibuqi', hanzi: ['对不起', '对不齐'] },
  { py: 'meiguanxi', hanzi: ['没关系'] },
  { py: 'xuexiao', hanzi: ['学校', '学笑'] },
  { py: 'zhidao', hanzi: ['知道', '指导'] },
  { py: 'bangonglou', hanzi: ['办公楼'] },
  { py: 'lou', hanzi: ['楼', '漏'] },
  { py: 'jiaoxue', hanzi: ['教学'] },
  { py: 'sushe', hanzi: ['宿舍'] },
  { py: 'beibian', hanzi: ['北边'] },
  { py: 'zuobian', hanzi: ['左边', '做边'] },
  { py: 'youbian', hanzi: ['右边', '有边'] },
  { py: 'buyongxie', hanzi: ['不用谢'] },
  { py: 'buyong', hanzi: ['不用'] },
  { py: 'men', hanzi: ['们', '门'] },
];

export function getImeCandidates(
  rawInput: string,
  allWords: Word[],
  priorityWords: string[] = []
): string[] {
  const clean = toTonelessPinyin(rawInput);
  if (!clean) return [];

  const candidates: string[] = [];
  const pushUnique = (h: string) => {
    if (h && !candidates.includes(h)) candidates.push(h);
  };

  // Exact or prefix match from vocabulary words
  const exactMatches: string[] = [];
  const prefixMatches: string[] = [];

  allWords.forEach((w) => {
    const py = toTonelessPinyin(w.py);
    if (py === clean) exactMatches.push(w.h);
    else if (py.startsWith(clean)) prefixMatches.push(w.h);
  });

  // Also check common syllable bank
  COMMON_SYLLABLE_BANK.forEach((entry) => {
    if (entry.py === clean) {
      entry.hanzi.forEach((h) => exactMatches.push(h));
    } else if (entry.py.startsWith(clean)) {
      entry.hanzi.forEach((h) => prefixMatches.push(h));
    }
  });

  // Ensure any expected target token matching this pinyin appears among candidates
  exactMatches.forEach(pushUnique);
  priorityWords.forEach((pw) => {
    if (candidates.includes(pw)) return;
    const matched = allWords.find((w) => w.h === pw);
    if (matched && toTonelessPinyin(matched.py).startsWith(clean)) {
      pushUnique(pw);
    }
  });
  prefixMatches.forEach(pushUnique);

  return candidates.slice(0, 7);
}


