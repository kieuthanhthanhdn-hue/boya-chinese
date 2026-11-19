import type {
  GrammarLessonSummary,
  PersistedData,
  SyncConfig,
  Word,
  WordProgress,
} from '../types';

export const IV = [0, 1, 2, 4, 8, 16, 32];
export const GRAMMAR_STORAGE_KEY = 'hvgrammar';
export const STORAGE_KEY = 'hv1';
export const SHEET_KEY = 'hvsheet';
export const SYNC_KEY = 'hvsync';

export const TM: Record<string, string> = {
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  ü: 'ǖǘǚǜ',
};

export const CF: string[][] = [
  ['哪儿', '那儿', '这儿'],
  ['左边', '右边', '北边'],
  ['不用', '不用谢', '没关系'],
  ['图书馆', '学校', '办公楼', '宿舍', '教学'],
];

export const D = `4	请问	qǐngwèn	v.	thỉnh vấn	Excuse me..., May I ask...	xin hỏi	请 = 讠(lời nói) + 青；问 = 门(cửa) + 口(miệng)	Dùng lời nói (讠) lịch sự để thỉnh cầu; đứng ở cửa (门) mở miệng (口) để hỏi
4	图书馆	túshūguǎn	n.	đồ thư quán	library	thư viện	图 = 囗(khung) + 冬 biến thể；书；馆 = 饣(ăn) + 官	馆 là quán: có chỗ ăn (饣) và có quan (官) tiếp đón
4	在	zài	v.	tại	to be located at or in	ở	在 = 土(đất) + 才	Có đất (土) để đứng nên 在 là đang ở
4	哪儿	nǎr	pron.	ná nhi	where	ở đâu	哪 = 口(miệng) + 那；儿 = người nhỏ	Chữ có 口 là chữ để hỏi: 哪 = hỏi 那 (kia) là chỗ nào
4	对不起	duìbuqǐ	v.	đối bất khởi	sorry	xin lỗi	对 = 又(tay) + 寸(tấc)；起 = 走(chạy) + 己	Không đối mặt (对) nổi, không đứng dậy (起) nổi vì có lỗi
4	个	gè	mw.	cá	measure word	cái, chiếc (lượng từ)	个 = 人(người) + 丨(một nét)	Một người (人) đứng thẳng một mình, đếm từng cái
4	学校	xuéxiào	n.	học hiệu	school	trường học	学 = ⺍ + 冖 + 子(đứa trẻ)；校 = 木(cây/gỗ) + 交(giao)	学: trẻ con (子) dưới mái nhà học bài；校: trường làm bằng gỗ (木), nơi giao lưu (交)
4	知道	zhīdào	v.	tri đạo	to know	biết	知 = 矢(mũi tên) + 口；道 = 辶(đi) + 首(đầu)	Miệng (口) nói nhanh như mũi tên (矢) là người biết；đi (辶) theo đầu (首) là con đường
4	没关系	méi guānxi	phr.	một quan hệ	It doesn't matter.	không sao, không có gì	没 = 氵(nước) + 殳；关 = 丷 + 天 biến thể；系 = 丿 + 糸(tơ)	Nước (氵) trôi đi hết: không còn gì, không sao
4	这儿	zhèr	pron.	giá nhi	here	ở đây	这 = 辶(đi) + 文	Bộ 辶 chỉ di chuyển: bước đến chỗ này
4	办公楼	bàngōnglóu	n.	biện công lâu	administration building	tòa nhà văn phòng	办；公 = 八(chia) + 厶(riêng)；楼 = 木 + 娄	公 = chia (八) cái riêng (厶) ra cho mọi người: công cộng；楼 làm bằng gỗ (木)
4	楼	lóu	n.	lâu	building	tòa nhà	楼 = 木(gỗ) + 娄	Ngày xưa lầu xây bằng gỗ (木)
4	教学	jiàoxué	n.	giáo học	teaching	dạy học	教 = 孝 + 攵(tay cầm gậy)	Thầy cầm gậy (攵) dạy trò hiếu thảo (孝)
4	那儿	nàr	pron.	ná nhi	there	chỗ kia, ở kia	那 = 冄 + 阝(ấp, nơi chốn)	Bộ 阝 chỉ nơi chốn: chỗ đằng kia
4	宿舍	sùshè	n.	túc xá	dormitory	ký túc xá	宿 = 宀(mái nhà) + 亻(người) + 百；舍 = 人 + 舌	Dưới mái nhà (宀) có người (亻) trú qua đêm = ký túc xá
4	北边	běibian	n.	bắc biên	the north side	phía bắc	北 = hai người quay lưng nhau；边 = 辶 + 力	Hai người quay lưng vào nhau, bắc là hướng lưng ngoảnh về
4	左边	zuǒbian	n.	tả biên	the left side	bên trái	左 = ナ(tay trái) + 工(công cụ)	Tay trái (ナ) cầm công cụ (工)
4	右边	yòubian	n.	hữu biên	the right side	bên phải	右 = ナ(tay) + 口(miệng)	Tay phải (ナ) đưa thức ăn vào miệng (口)
4	不用谢	búyòng xiè	phr.	bất dụng tạ	You are welcome.	không cần cảm ơn, không có gì	谢 = 讠(lời nói) + 身(thân) + 寸	Nói lời (讠) cảm ơn: không cần (不用)
4	不用	búyòng	adv.	bất dụng	need not	không cần	不；用 = 用(dùng)	不 (không) + 用 (dùng) = không cần dùng đến`;

export const EX: Record<string, [string, string]> = {
  请问: ['请问 ， 图书馆 在 哪儿 ？', 'Xin hỏi, thư viện ở đâu?'],
  图书馆: ['图书馆 在 学校 北边 。', 'Thư viện ở phía bắc của trường.'],
  在: ['我 在 宿舍 。', 'Tôi ở ký túc xá.'],
  哪儿: ['你 在 哪儿 ？', 'Bạn ở đâu?'],
  对不起: ['对不起 ， 我 不 知道 。', 'Xin lỗi, tôi không biết.'],
  个: ['这 是 一 个 图书馆 。', 'Đây là một thư viện.'],
  学校: ['我 的 学校 很 大 。', 'Trường của tôi rất lớn.'],
  知道: ['你 知道 办公楼 在 哪儿 吗 ？', 'Bạn có biết tòa nhà văn phòng ở đâu không?'],
  没关系: ['没关系 ， 我 知道 。', 'Không sao, tôi biết.'],
  这儿: ['图书馆 在 这儿 。', 'Thư viện ở đây.'],
  办公楼: ['办公楼 在 图书馆 北边 。', 'Tòa nhà văn phòng ở phía bắc thư viện.'],
  楼: ['那 个 楼 是 宿舍 。', 'Tòa nhà kia là ký túc xá.'],
  教学: ['教学 楼 在 左边 。', 'Tòa nhà giảng dạy ở bên trái.'],
  那儿: ['宿舍 在 那儿 。', 'Ký túc xá ở đằng kia.'],
  宿舍: ['我 的 宿舍 在 学校 左边 。', 'Ký túc xá của tôi ở bên trái trường.'],
  北边: ['图书馆 在 北边 吗 ？', 'Thư viện ở phía bắc phải không?'],
  左边: ['他 在 我 左边 。', 'Anh ấy ở bên trái tôi.'],
  右边: ['宿舍 在 办公楼 右边 。', 'Ký túc xá ở bên phải tòa nhà văn phòng.'],
  不用谢: ['谢谢 ！ 不用谢 ！', 'Cảm ơn! Không có gì!'],
  不用: ['你 不用 去 图书馆 。', 'Bạn không cần đến thư viện.'],
};

export const EX2: Record<string, [string, string][]> = {
  请问: [
    ['请问 ， 办公楼 在 哪儿 ？', 'Xin hỏi, tòa nhà văn phòng ở đâu?'],
    ['请问 ， 宿舍 在 左边 吗 ？', 'Xin hỏi, ký túc xá ở bên trái phải không?'],
    ['请问 ， 你 知道 学校 在 哪儿 吗 ？', 'Xin hỏi, bạn có biết trường học ở đâu không?'],
  ],
  图书馆: [
    ['我 去 图书馆 。', 'Tôi đến thư viện.'],
    ['图书馆 在 办公楼 左边 。', 'Thư viện ở bên trái tòa nhà văn phòng.'],
    ['他 在 图书馆 吗 ？', 'Anh ấy có ở thư viện không?'],
  ],
  在: [
    ['他 不 在 学校 。', 'Anh ấy không ở trường.'],
    ['我 的 宿舍 在 这儿 。', 'Ký túc xá của tôi ở đây.'],
    ['你 在 办公楼 吗 ？', 'Bạn có ở tòa nhà văn phòng không?'],
  ],
  哪儿: [
    ['办公楼 在 哪儿 ？', 'Tòa nhà văn phòng ở đâu?'],
    ['他 的 宿舍 在 哪儿 ？', 'Ký túc xá của anh ấy ở đâu?'],
    ['你 去 哪儿 ？', 'Bạn đi đâu?'],
  ],
  对不起: [
    ['对不起 ， 我 不 在 学校 。', 'Xin lỗi, tôi không ở trường.'],
    ['对不起 ， 你 的 宿舍 在 哪儿 ？', 'Xin lỗi, ký túc xá của bạn ở đâu?'],
    ['对不起 ！ 没关系 。', 'Xin lỗi! Không sao.'],
  ],
  个: [
    ['这 个 宿舍 很 大 。', 'Ký túc xá này rất lớn.'],
    ['那 个 是 办公楼 。', 'Cái kia là tòa nhà văn phòng.'],
    ['学校 有 一 个 图书馆 。', 'Trường có một thư viện.'],
  ],
  学校: [
    ['学校 在 哪儿 ？', 'Trường học ở đâu?'],
    ['我 的 学校 有 图书馆 。', 'Trường của tôi có thư viện.'],
    ['学校 的 宿舍 很 大 。', 'Ký túc xá của trường rất lớn.'],
  ],
  知道: [
    ['我 知道 ， 图书馆 在 北边 。', 'Tôi biết, thư viện ở phía bắc.'],
    ['他 不 知道 宿舍 在 哪儿 。', 'Anh ấy không biết ký túc xá ở đâu.'],
    ['你 知道 吗 ？', 'Bạn có biết không?'],
  ],
  没关系: [
    ['没关系 ， 我 在 这儿 。', 'Không sao, tôi ở đây.'],
    ['你 不 知道 ， 没关系 。', 'Bạn không biết cũng không sao.'],
    ['没关系 ， 办公楼 在 那儿 。', 'Không sao, tòa nhà văn phòng ở đằng kia.'],
  ],
  这儿: [
    ['我 在 这儿 。', 'Tôi ở đây.'],
    ['这儿 是 学校 。', 'Đây là trường học.'],
    ['他 的 宿舍 在 这儿 吗 ？', 'Ký túc xá của anh ấy ở đây phải không?'],
  ],
  办公楼: [
    ['办公楼 很 大 。', 'Tòa nhà văn phòng rất lớn.'],
    ['你 去 办公楼 吗 ？', 'Bạn đến tòa nhà văn phòng không?'],
    ['办公楼 在 宿舍 左边 。', 'Tòa nhà văn phòng ở bên trái ký túc xá.'],
  ],
  楼: [
    ['这 个 楼 很 大 。', 'Tòa nhà này rất lớn.'],
    ['宿舍 楼 在 图书馆 右边 。', 'Tòa ký túc xá ở bên phải thư viện.'],
    ['那 个 楼 是 学校 的 图书馆 。', 'Tòa nhà kia là thư viện của trường.'],
  ],
  教学: [
    ['教学 楼 很 大 。', 'Tòa nhà giảng dạy rất lớn.'],
    ['教学 楼 在 办公楼 北边 。', 'Tòa nhà giảng dạy ở phía bắc tòa nhà văn phòng.'],
    ['你 知道 教学 楼 在 哪儿 吗 ？', 'Bạn có biết tòa nhà giảng dạy ở đâu không?'],
  ],
  那儿: [
    ['图书馆 在 那儿 。', 'Thư viện ở đằng kia.'],
    ['他 在 那儿 吗 ？', 'Anh ấy có ở đằng kia không?'],
    ['那儿 是 办公楼 ， 这儿 是 宿舍 。', 'Đằng kia là tòa văn phòng, đây là ký túc xá.'],
  ],
  宿舍: [
    ['宿舍 很 大 吗 ？', 'Ký túc xá có lớn không?'],
    ['我 去 宿舍 。', 'Tôi đến ký túc xá.'],
    ['他 的 宿舍 在 学校 北边 。', 'Ký túc xá của anh ấy ở phía bắc trường.'],
  ],
  北边: [
    ['学校 的 北边 有 图书馆 。', 'Phía bắc trường có thư viện.'],
    ['宿舍 在 办公楼 北边 。', 'Ký túc xá ở phía bắc tòa nhà văn phòng.'],
    ['你 的 宿舍 在 北边 吗 ？', 'Ký túc xá của bạn ở phía bắc phải không?'],
  ],
  左边: [
    ['我 的 宿舍 在 左边 。', 'Ký túc xá của tôi ở bên trái.'],
    ['学校 的 左边 有 图书馆 。', 'Bên trái trường có thư viện.'],
    ['你 在 他 左边 吗 ？', 'Bạn ở bên trái anh ấy phải không?'],
  ],
  右边: [
    ['我 的 宿舍 在 右边 。', 'Ký túc xá của tôi ở bên phải.'],
    ['办公楼 在 图书馆 右边 。', 'Tòa nhà văn phòng ở bên phải thư viện.'],
    ['学校 的 右边 是 宿舍 。', 'Bên phải trường là ký túc xá.'],
  ],
  不用谢: [
    ['谢谢 你 ！ 不用谢 。', 'Cảm ơn bạn! Không có gì.'],
    ['不用谢 ， 没关系 。', 'Không có gì, không sao đâu.'],
  ],
  不用: [
    ['你 不用 在 这儿 。', 'Bạn không cần ở đây.'],
    ['不用 去 图书馆 ， 他 在 宿舍 。', 'Không cần đến thư viện, anh ấy ở ký túc xá.'],
    ['你 不用 知道 。', 'Bạn không cần biết.'],
  ],
};

export function makeWordId(lesson: string, hanzi: string): string {
  const l = (lesson || '?').trim() || '?';
  const h = (hanzi || '').trim();
  return `${l}_${h}`;
}

function cleanImportCell(val: unknown): string {
  return String(val ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\s*[\r\n]+\s*/g, ' ')
    .trim();
}

function isImportHeaderRow(cells: string[]): boolean {
  const c0 = (cells[0] || '').toLowerCase();
  const c1 = (cells[1] || '').toLowerCase();
  const c2 = (cells[2] || '').toLowerCase();
  if (
    c0 === 'bài' ||
    c0 === 'bài học' ||
    c0 === 'lesson' ||
    c0 === 'bai' ||
    c0 === 'stt'
  ) {
    return true;
  }
  if (
    (c1 === 'chữ hán' ||
      c1 === 'chu han' ||
      c1 === 'hanzi' ||
      c1 === 'từ mới' ||
      c1 === 'từ vựng') &&
    (!c2 || c2 === 'pinyin' || c2 === 'phiên âm')
  ) {
    return true;
  }
  return false;
}

export function parseWordRows(rows: unknown[][]): Word[] {
  return rows
    .map((row) => (Array.isArray(row) ? row.map(cleanImportCell) : []))
    .filter((cells) => {
      if (cells.length < 2 || !cells[1]) return false;
      if (isImportHeaderRow(cells)) return false;
      return true;
    })
    .map((a) => {
      const l = a[0] || '?';
      const h = a[1];
      const ex = a[9] || '';
      const exvi = a[10] || '';
      // 11 standard columns (A-K: 0..10) + extended example pairs L-Q (11..16) and optional R-S (17..18)
      const exs: [string, string][] = [9, 11, 13, 15, 17]
        .filter((i) => Boolean(a[i]))
        .map((i) => [a[i], a[i + 1] || ''] as [string, string]);
      return {
        id: makeWordId(l, h),
        l,
        h,
        py: a[2] || '',
        pos: a[3] || '',
        hv: a[4] || '',
        en: a[5] || '',
        vi: a[6] || '',
        rad: a[7] || '',
        mn: a[8] || '',
        ex,
        exvi,
        exs,
      };
    });
}

export function parseWords(text: string): Word[] {
  const rows = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return [];
      return line.split(line.includes('\t') ? '\t' : '|').map((x) => x.trim());
    });
  return parseWordRows(rows);
}

export function enrichWordExamples(word: Word): Word {
  const w = { ...word };
  if (!w.ex && EX[w.h]) {
    w.ex = EX[w.h][0];
    w.exvi = EX[w.h][1];
  }
  const exs: [string, string][] = Array.isArray(w.exs) ? [...w.exs] : [];
  if (w.ex && !exs.some((e) => e[0] === w.ex)) {
    exs.unshift([w.ex, w.exvi || '']);
  }
  (EX2[w.h] || []).forEach((e) => {
    if (!exs.some((y) => y[0] === e[0])) {
      exs.push(e);
    }
  });
  w.exs = exs;
  return w;
}

export function normalizePersistedData(raw: Partial<PersistedData> | null): PersistedData {
  const p: Record<string, WordProgress> = { ...(raw?.p || {}) };
  let w: Word[] = Array.isArray(raw?.w) && raw!.w.length > 0 ? raw!.w : parseWords(D);

  // Migrate legacy IDs (hanzi-only) to `${lesson}_${hanzi}` safely while preserving S.p progress
  w = w.map((item) => {
    const l = (item.l || '?').trim() || '?';
    const h = (item.h || '').trim();
    const nextId = makeWordId(l, h);
    const oldId = item.id;

    if (!p[nextId]) {
      if (oldId && p[oldId]) {
        p[nextId] = { ...p[oldId] };
      } else if (h && p[h]) {
        p[nextId] = { ...p[h] };
      }
    }

    return enrichWordExamples({
      ...item,
      id: nextId,
      l,
      h,
    });
  });

  return {
    w,
    p,
    log: raw?.log || {},
    tests: Array.isArray(raw?.tests) ? raw!.tests : [],
  };
}

export function loadPersistedData(): PersistedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedData>;
      return normalizePersistedData(parsed);
    }
  } catch {
    // ignore corrupted storage and fall back to seed
  }
  return normalizePersistedData(null);
}

export function savePersistedData(data: PersistedData): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        w: data.w,
        p: data.p,
        log: data.log,
        tests: data.tests,
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function getWordProgress(
  pMap: Record<string, WordProgress>,
  word: Word
): WordProgress {
  return (
    pMap[word.id] ||
    pMap[word.h] || {
      box: 0,
      due: 0,
      wrong: 0,
    }
  );
}

export function upsertWordsWithStats(
  existing: Word[],
  incoming: Word[]
): { words: Word[]; added: number; updated: number } {
  const next = [...existing];
  let added = 0;
  let updated = 0;
  const seenIncoming = new Set<string>();

  for (const item of incoming) {
    const enriched = enrichWordExamples(item);
    const idx = next.findIndex(
      (w) => w.id === enriched.id || (w.id === enriched.h && w.l === enriched.l)
    );
    if (idx < 0) {
      next.push(enriched);
      added += 1;
    } else {
      next[idx] = enriched;
      if (!seenIncoming.has(enriched.id)) {
        updated += 1;
      }
    }
    seenIncoming.add(enriched.id);
  }

  return { words: next, added, updated };
}

export function upsertWords(existing: Word[], incoming: Word[]): Word[] {
  return upsertWordsWithStats(existing, incoming).words;
}

export function mergeRemoteData(
  current: PersistedData,
  remote: Partial<PersistedData>
): PersistedData {
  if (!remote || !Array.isArray(remote.w)) return current;

  const normalizedRemote = normalizePersistedData(remote);
  const nextW = [...current.w];
  for (const rw of normalizedRemote.w) {
    if (!nextW.some((w) => w.id === rw.id)) {
      nextW.push(rw);
    }
  }

  const nextP: Record<string, WordProgress> = { ...current.p };
  for (const id of Object.keys(normalizedRemote.p)) {
    const a = nextP[id];
    const b = normalizedRemote.p[id];
    if (
      !a ||
      (b.n || 0) > (a.n || 0) ||
      ((b.n || 0) === (a.n || 0) && (b.last || '') > (a.last || ''))
    ) {
      nextP[id] = b;
    }
  }

  const nextLog = { ...current.log };
  for (const k of Object.keys(normalizedRemote.log)) {
    const a = nextLog[k];
    const b = normalizedRemote.log[k];
    if (typeof b === 'number') {
      if (a === undefined) nextLog[k] = b;
    } else if (b && typeof b === 'object') {
      if (!a || typeof a === 'number' || b.n > a.n) {
        nextLog[k] = b;
      }
    }
  }

  const seen = new Set(current.tests.map((t) => `${t.d}_${t.pct}_${t.n}`));
  const nextTests = [...current.tests];
  for (const t of normalizedRemote.tests) {
    const sig = `${t.d}_${t.pct}_${t.n}`;
    if (!seen.has(sig)) {
      nextTests.push(t);
    }
  }

  return {
    w: nextW,
    p: nextP,
    log: nextLog,
    tests: nextTests,
  };
}

export function getSheetUrl(): string {
  try {
    return localStorage.getItem(SHEET_KEY) || '';
  } catch {
    return '';
  }
}

export function setSheetUrl(url: string): void {
  try {
    localStorage.setItem(SHEET_KEY, url.trim());
  } catch {
    // ignore
  }
}

export function getSyncConfig(): SyncConfig {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') as SyncConfig;
  } catch {
    return {};
  }
}

export function setSyncConfig(cfg: SyncConfig): void {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export const DEFAULT_GRAMMAR_SUMMARY: Record<string, GrammarLessonSummary> = {
  '4': {
    grammarPoints: [
      {
        title: 'Biểu thị vị trí với động từ 在',
        formula: '主语 + 在 + 处所',
        explanation:
          'Dùng động từ 在 (tại/ở) để nói người hoặc vật đang ở địa điểm nào đó. Dạng phủ định dùng 不在.',
        examples: [
          { zh: '图书馆在学校北边。', py: 'Túshūguǎn zài xuéxiào běibian.', vi: 'Thư viện ở phía bắc của trường học.' },
          { zh: '我的宿舍在这儿。', py: 'Wǒ de sùshè zài zhèr.', vi: 'Ký túc xá của tôi ở đây.' },
          { zh: '他不在办公楼。', py: 'Tā bú zài bàngōnglóu.', vi: 'Anh ấy không ở tòa nhà văn phòng.' },
        ],
      },
      {
        title: 'Hỏi vị trí với đại từ nghi vấn 哪儿',
        formula: '主语 + 在 + 哪儿？',
        explanation:
          'Đặt từ nghi vấn 哪儿 (ở đâu) ngay tại vị trí cần hỏi (sau 在), cuối câu không cần thêm 吗.',
        examples: [
          { zh: '请问，图书馆在哪儿？', py: 'Qǐngwèn, túshūguǎn zài nǎr?', vi: 'Xin hỏi, thư viện ở đâu?' },
          { zh: '你的宿舍在哪儿？', py: 'Nǐ de sùshè zài nǎr?', vi: 'Ký túc xá của bạn ở đâu?' },
          { zh: '教学楼在哪儿？', py: 'Jiàoxuélóu zài nǎr?', vi: 'Tòa nhà giảng dạy ở đâu?' },
        ],
      },
      {
        title: 'Phương vị từ chỉ hướng (北边, 左边, 右边)',
        formula: 'A + 在 + B + 方位词',
        explanation:
          'Danh từ chỉ phương hướng (北边 phía bắc, 左边 bên trái, 右边 bên phải) đặt SAU danh từ làm mốc.',
        examples: [
          { zh: '宿舍在办公楼左边。', py: 'Sùshè zài bàngōnglóu zuǒbian.', vi: 'Ký túc xá ở bên trái tòa nhà văn phòng.' },
          { zh: '办公楼在图书馆右边。', py: 'Bàngōnglóu zài túshūguǎn yòubian.', vi: 'Tòa văn phòng ở bên phải thư viện.' },
          { zh: '学校北边有图书馆。', py: 'Xuéxiào běibian yǒu túshūguǎn.', vi: 'Phía bắc trường học có thư viện.' },
        ],
      },
      {
        title: 'Lời mời hỏi lịch sự & đáp lại',
        formula: '请问，...？ / 不用 + 动词',
        explanation:
          'Dùng 请问 mở đầu câu hỏi một cách lịch sự. Dùng 不用 (không cần) trước động từ hoặc 不用谢 để đáp lại lời cảm ơn.',
        examples: [
          { zh: '请问，你知道办公楼在哪儿吗？', py: 'Qǐngwèn, nǐ zhīdào bàngōnglóu zài nǎr ma?', vi: 'Xin hỏi, bạn có biết tòa văn phòng ở đâu không?' },
          { zh: '对不起，我不知道。— 没关系。', py: 'Duìbuqǐ, wǒ bù zhīdào. — Méi guānxi.', vi: 'Xin lỗi, tôi không biết. — Không sao đâu.' },
          { zh: '谢谢你！— 不用谢！', py: 'Xièxie nǐ! — Búyòng xiè!', vi: 'Cảm ơn bạn! — Không có gì!' },
        ],
      },
    ],
    exercises: [
      {
        question: 'Chọn câu đúng ngữ pháp để hỏi vị trí thư viện:',
        promptZh: '请问，图书馆＿＿＿＿？',
        options: ['在哪儿', '在那儿吗', '在哪儿吗', '在吗哪儿'],
        correctIndex: 0,
        explanation: 'Câu đã có đại từ nghi vấn 哪儿 thì không dùng thêm trợ từ nghi vấn 吗 ở cuối câu.',
      },
      {
        question: 'Điền từ thích hợp để diễn đạt "Thư viện ở bên trái tòa văn phòng":',
        promptZh: '图书馆在办公楼＿＿＿＿。',
        options: ['左边', '这儿', '哪儿', '不用'],
        correctIndex: 0,
        explanation: 'Phương vị từ 左边 (bên trái) đứng sau danh từ làm mốc 办公楼.',
      },
      {
        question: 'Khi ai đó nói "对不起，我不知道", bạn đáp lại lịch sự như thế nào?',
        promptZh: 'A: 对不起，我不知道。 B: ＿＿＿＿。',
        options: ['没关系', '不用谢', '请问', '教学楼'],
        correctIndex: 0,
        explanation: '没关系 (không sao đâu) dùng để đáp lại lời xin lỗi 对不起; còn 不用谢 đáp lại lời cảm ơn 谢谢.',
      },
      {
        question: 'Chọn câu đúng vị trí từ để nói "Bạn không cần đi thư viện":',
        promptZh: '你＿＿＿＿去图书馆。',
        options: ['不用', '没关系', '哪儿', '知道'],
        correctIndex: 0,
        explanation: 'Phó từ 不用 + động từ (去) mang nghĩa "không cần làm gì".',
      },
      {
        question: 'Hoàn thành câu "Ký túc xá của tôi ở đằng kia":',
        promptZh: '我的宿舍＿＿＿＿。',
        options: ['在那儿', '在哪儿', '在教学', '在个'],
        correctIndex: 0,
        explanation: '那儿 (nàr - thanh 4) nghĩa là "ở kia/đằng kia", còn 哪儿 (nǎr - thanh 3) là "ở đâu".',
      },
    ],
  },
};

