import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  HelpCircle,
  Shuffle,
  Headphones,
  PenTool,
  ListChecks,
  Languages,
  AudioLines,
  AlertTriangle,
  FileEdit,
  Keyboard,
  Delete,
  Link2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { CF } from '../data/boyaSeed';
import type {
  CollocationItem,
  PracticeMode,
  TranslateSubMode,
  Word,
  WordProgress,
} from '../types';
import {
  COLLOCATION_BANK,
  cleanSentence,
  getImeCandidates,
  nz,
  pickExample,
  pickWeightedWord,
  shuf,
  sim,
  spn,
  tokenizeSentence,
  varyPinyin,
} from '../utils/practice';
import { aiGenerateCollocations } from '../utils/geminiClient';
import { speakZh, type SpeechSpeed } from '../utils/speech';
import { HanziCanvas } from './HanziCanvas';
import { SpeechControl } from './SpeechControl';

interface PracticeViewProps {
  words: Word[];
  allWords: Word[];
  progress: Record<string, WordProgress>;
  lessonFilter?: string;
  speed: SpeechSpeed;
  onChangeSpeed: (s: SpeechSpeed) => void;
  onRecord: (word: Word, ok: boolean) => void;
}

const MODES: { id: PracticeMode; label: string; icon: typeof ListChecks }[] = [
  { id: 'quiz', label: 'Trắc nghiệm', icon: ListChecks },
  { id: 'listen', label: 'Nghe chép', icon: Headphones },
  { id: 'ime', label: 'Gõ Pinyin (IME)', icon: Keyboard },
  { id: 'colloc', label: 'Lượng từ & Collocations', icon: Link2 },
  { id: 'ro', label: 'Sắp xếp câu', icon: Shuffle },
  { id: 'cz', label: 'Điền từ', icon: FileEdit },
  { id: 'tn', label: 'Thanh điệu', icon: AudioLines },
  { id: 'cf', label: 'Từ dễ nhầm', icon: AlertTriangle },
  { id: 'dc', label: 'Dịch câu', icon: Languages },
  { id: 'wr', label: 'Tập viết nét', icon: PenTool },
];

const DC_SUBMODES: { id: TranslateSubMode; label: string }[] = [
  { id: 'vt', label: 'Việt → Trung' },
  { id: 'tv', label: 'Trung → Việt' },
  { id: 'ty', label: 'Nghĩa → Chữ' },
  { id: 'pn', label: 'Gõ Pinyin' },
  { id: 'sc', label: 'Sửa câu' },
  { id: 'dg', label: 'Điền gõ' },
  { id: 'dt', label: 'Đặt câu' },
];

interface McqRound {
  w: Word;
  exText: string;
  exVi: string;
  options: { id: string; label: string; sub?: string }[];
  zhOpts?: boolean;
  promptTitle: string;
  promptZh?: string;
  promptSub?: string;
  sayText?: string;
}

export function PracticeView({
  words,
  allWords,
  progress,
  lessonFilter = 'all',
  speed,
  onChangeSpeed,
  onRecord,
}: PracticeViewProps) {
  const [mode, setMode] = useState<PracticeMode>('quiz');
  const [dcSub, setDcSub] = useState<TranslateSubMode>('vt');
  const [roundSeed, setRoundSeed] = useState(0);

  // Listen mode toggle (dictation vs multiple choice)
  const [listenPickMode, setListenPickMode] = useState(false);

  // Quiz / Cloze / Tone / Confusable state
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);

  // Typing / Dictation / Translate state
  const [inputVal, setInputVal] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [overrideCorrect, setOverrideCorrect] = useState(false);

  // Sentence Reorder state
  const [pickedTokenIndices, setPickedTokenIndices] = useState<number[]>([]);

  // Pinyin IME state
  const [imeComposed, setImeComposed] = useState('');
  const [imePyBuffer, setImePyBuffer] = useState('');

  // AI Collocations state
  const [aiCollocItems, setAiCollocItems] = useState<CollocationItem[]>([]);
  const [aiCollocQueue, setAiCollocQueue] = useState<CollocationItem[]>([]);
  const [aiCollocLoading, setAiCollocLoading] = useState(false);
  const [aiCollocError, setAiCollocError] = useState<string | null>(null);
  const [seenCollocZh, setSeenCollocZh] = useState<string[]>([]);
  const [collocStats, setCollocStats] = useState({ total: 0, ok: 0 });

  const nextRound = () => {
    setSelectedOpt(null);
    setInputVal('');
    setHintLevel(0);
    setSubmitted(false);
    setOverrideCorrect(false);
    setPickedTokenIndices([]);
    setImeComposed('');
    setImePyBuffer('');
    setRoundSeed((s) => s + 1);
  };

  useEffect(() => {
    nextRound();
  }, [mode, dcSub, listenPickMode, words.length]);

  useEffect(() => {
    // Reset scoped AI collocations when switching lesson scope
    setAiCollocItems([]);
    setAiCollocQueue([]);
    setAiCollocError(null);
    setSeenCollocZh([]);
  }, [lessonFilter]);

  const wordsWithEx = useMemo(
    () =>
      words.filter((w) => {
        const picked = pickExample(w);
        return Boolean(picked.ex && picked.ex.trim());
      }),
    [words]
  );

  // Build round data safely using SRS weighted sampling
  const quizRound = useMemo<McqRound | null>(() => {
    if (mode !== 'quiz' && !(mode === 'listen' && listenPickMode)) return null;
    const w = pickWeightedWord(words, progress);
    if (!w) return null;
    const isListen = mode === 'listen';
    const ty = isListen ? 2 : Math.random() < 0.5 ? 0 : 1;
    const ds = shuf(
      allWords.filter((x) => x.id !== w.id && (ty === 0 ? x.vi !== w.vi : true))
    ).slice(0, 3);
    const opts = shuf([w, ...ds]).map((x) => ({
      id: x.id,
      label: ty === 0 ? x.vi : x.h,
    }));
    const picked = pickExample(w);
    return {
      w,
      exText: cleanSentence(picked.ex),
      exVi: picked.exvi,
      options: opts,
      zhOpts: ty !== 0,
      promptTitle:
        ty === 0
          ? 'Chọn nghĩa tiếng Việt đúng'
          : ty === 1
            ? 'Chọn chữ Hán đúng với nghĩa'
            : 'Nghe phát âm và chọn chữ Hán đúng',
      promptZh: ty === 0 ? w.h : undefined,
      promptSub: ty === 1 ? w.vi : undefined,
      sayText: ty === 2 ? w.h : undefined,
    };
  }, [mode, listenPickMode, words, allWords, roundSeed]);

  const listenWord = useMemo<Word | null>(() => {
    if (mode !== 'listen' || listenPickMode || !words.length) return null;
    return pickWeightedWord(words, progress);
  }, [mode, listenPickMode, words, roundSeed]);

  const imeRound = useMemo<{
    w: Word;
    promptVi: string;
    targetZh: string;
    targetTokens: string[];
    pinyinHint: string;
  } | null>(() => {
    if (mode !== 'ime') return null;
    const w = pickWeightedWord(words, progress);
    if (!w) return null;
    const picked = pickExample(w);
    if (picked.ex && picked.exvi && Math.random() < 0.7) {
      return {
        w,
        promptVi: picked.exvi,
        targetZh: cleanSentence(picked.ex),
        targetTokens: tokenizeSentence(picked.ex),
        pinyinHint: w.py,
      };
    }
    return {
      w,
      promptVi: w.vi,
      targetZh: w.h,
      targetTokens: [w.h],
      pinyinHint: w.py,
    };
  }, [mode, words, roundSeed]);

  const imeCandidates = useMemo(() => {
    if (!imeRound || !imePyBuffer.trim()) return [];
    return getImeCandidates(imePyBuffer, allWords, imeRound.targetTokens);
  }, [imePyBuffer, allWords, imeRound]);

  const collocRound = useMemo<{
    item: CollocationItem;
    options: string[];
    matchedWord: Word | null;
  } | null>(() => {
    if (mode !== 'colloc') return null;

    let item: CollocationItem | undefined;
    if (aiCollocQueue.length > 0) {
      item = aiCollocQueue[0];
    } else {
      const scopedHanzi = new Set(words.map((w) => w.h));
      const matchedBuiltIn = COLLOCATION_BANK.filter((c) =>
        c.relatedHanzi.some((h) => scopedHanzi.has(h))
      );
      const basePool =
        aiCollocItems.length > 0
          ? [...aiCollocItems, ...(matchedBuiltIn.length ? matchedBuiltIn : COLLOCATION_BANK)]
          : matchedBuiltIn.length >= 2
            ? matchedBuiltIn
            : COLLOCATION_BANK;

      const seenSet = new Set(seenCollocZh);
      const unseen = basePool.filter((c) => !seenSet.has(c.zhFull));
      const pool = unseen.length > 0 ? unseen : basePool;
      item = pool[Math.floor(Math.random() * pool.length)];
    }

    if (!item) return null;
    const options = shuf([item.answer, ...item.distractors]).slice(0, 4);
    const matchedWord =
      words.find(
        (w) =>
          item!.relatedHanzi.includes(w.h) ||
          item!.zhFull.includes(w.h)
      ) ||
      allWords.find(
        (w) =>
          item!.relatedHanzi.includes(w.h) ||
          item!.zhFull.includes(w.h)
      ) ||
      words[0] ||
      null;

    return { item, options, matchedWord };
  }, [mode, words, allWords, aiCollocItems, aiCollocQueue, roundSeed]);

  const handleGenerateAiCollocations = async () => {
    if (aiCollocLoading || words.length === 0) return;
    setAiCollocLoading(true);
    setAiCollocError(null);
    try {
      const lessonLabel =
        lessonFilter === 'all'
          ? 'Tổng hợp kho Boya'
          : lessonFilter === 'wrong'
            ? 'Nhóm từ hay sai'
            : lessonFilter === 'Từ sưu tầm'
              ? 'Từ sưu tầm'
              : `Bài ${lessonFilter}`;

      const existingPrompts = [
        ...COLLOCATION_BANK.map((c) => c.zhFull),
        ...aiCollocItems.map((c) => c.zhFull),
        ...seenCollocZh,
      ];

      const generated = await aiGenerateCollocations({
        lessonLabel,
        vocab: words.map((w) => ({
          h: w.h,
          py: w.py,
          vi: w.vi,
          pos: w.pos,
        })),
        existingPrompts,
      });
      if (!generated.length) {
        throw new Error('AI chưa tạo được câu mới không trùng lặp. Hãy thử lại.');
      }
      setAiCollocItems((prev) => [...generated, ...prev]);
      setAiCollocQueue(generated);
      setSelectedOpt(null);
      setRoundSeed((s) => s + 1);
    } catch (err: unknown) {
      setAiCollocError(
        err instanceof Error ? err.message : 'Không thể gọi AI tạo câu ghép từ.'
      );
    } finally {
      setAiCollocLoading(false);
    }
  };

  const advanceCollocRound = () => {
    if (collocRound) {
      setSeenCollocZh((prev) =>
        prev.includes(collocRound.item.zhFull)
          ? prev
          : [...prev, collocRound.item.zhFull]
      );
    }
    if (aiCollocQueue.length > 0) {
      setAiCollocQueue((prev) => prev.slice(1));
    }
    nextRound();
  };

  const reorderRound = useMemo<{
    w: Word;
    exClean: string;
    exVi: string;
    tokens: string[];
    bank: { t: string; i: number }[];
  } | null>(() => {
    if (mode !== 'ro') return null;
    const valid = wordsWithEx.filter((w) => tokenizeSentence(pickExample(w).ex).length >= 2);
    const w = pickWeightedWord(valid, progress);
    if (!w) return null;
    const picked = pickExample(w);
    const tokens = tokenizeSentence(picked.ex);
    return {
      w,
      exClean: cleanSentence(picked.ex),
      exVi: picked.exvi,
      tokens,
      bank: shuf(tokens.map((t, i) => ({ t, i }))),
    };
  }, [mode, wordsWithEx, roundSeed]);

  const clozeRound = useMemo<McqRound | null>(() => {
    if (mode !== 'cz') return null;
    const w = pickWeightedWord(wordsWithEx, progress);
    if (!w) return null;
    const picked = pickExample(w);
    const s = cleanSentence(picked.ex);
    const ds = shuf(allWords.filter((x) => x.id !== w.id)).slice(0, 3);
    const opts = shuf([w, ...ds]).map((x) => ({ id: x.id, label: x.h }));
    return {
      w,
      exText: s,
      exVi: picked.exvi,
      options: opts,
      zhOpts: true,
      promptTitle: 'Điền từ còn thiếu vào chỗ trống',
      promptZh: s.includes(w.h) ? s.replace(w.h, '＿＿') : `${s} (＿＿)`,
      promptSub: picked.exvi,
    };
  }, [mode, wordsWithEx, allWords, roundSeed]);

  const toneRound = useMemo<McqRound | null>(() => {
    if (mode !== 'tn') return null;
    const w = pickWeightedWord(words, progress);
    if (!w) return null;
    const set = new Set<string>([w.py]);
    for (let g = 0; g < 40 && set.size < 4; g++) {
      set.add(varyPinyin(w.py));
    }
    const baseNoTone = w.py
      .normalize('NFD')
      .replace(/[\u0300-\u0304\u030c]/g, '')
      .normalize('NFC');
    const opts = shuf(Array.from(set)).map((p) => ({
      id: p === w.py ? w.id : `fake_${p}`,
      label: p,
    }));
    const picked = pickExample(w);
    return {
      w,
      exText: cleanSentence(picked.ex),
      exVi: picked.exvi,
      options: opts,
      promptTitle: `Nghe và chọn thanh điệu đúng · ${w.vi}`,
      promptSub: baseNoTone,
      sayText: w.h,
    };
  }, [mode, words, roundSeed]);

  const confusableRound = useMemo<McqRound | null>(() => {
    if (mode !== 'cf') return null;
    const validGroups = CF.map((group) =>
      group
        .map((h) => allWords.find((x) => x.h === h && Boolean(pickExample(x).ex)))
        .filter((x): x is Word => Boolean(x))
    ).filter((g) => g.length > 1 && g.some((x) => words.some((pw) => pw.id === x.id)));

    if (!validGroups.length) return null;
    const group = shuf(validGroups)[0];
    const candidates = group.filter((x) => words.some((pw) => pw.id === x.id));
    const w = shuf(candidates.length ? candidates : group)[0];
    const picked = pickExample(w);
    const s = cleanSentence(picked.ex);
    return {
      w,
      exText: s,
      exVi: picked.exvi,
      options: shuf(group).map((x) => ({ id: x.id, label: `${x.h}  ${x.py}` })),
      zhOpts: true,
      promptTitle: `Nhóm dễ nhầm: ${group.map((x) => `${x.h} (${x.vi})`).join(' · ')}`,
      promptZh: s.includes(w.h) ? s.replace(w.h, '＿＿') : `${s} (＿＿)`,
      promptSub: picked.exvi,
    };
  }, [mode, words, allWords, roundSeed]);

  const translateRound = useMemo(() => {
    if (mode !== 'dc') return null;
    const needsEx = !['ty', 'pn'].includes(dcSub);
    const src = needsEx ? wordsWithEx : words;
    const w = pickWeightedWord(src, progress);
    if (!w) return null;
    const picked = pickExample(w);
    const s = cleanSentence(picked.ex);
    const tk = tokenizeSentence(picked.ex);
    const effectiveSub: TranslateSubMode = dcSub === 'sc' && tk.length < 3 ? 'vt' : dcSub;

    if (effectiveSub === 'vt') {
      return {
        w,
        s,
        exVi: picked.exvi,
        zhInput: true,
        diff: true,
        selfCheck: false,
        placeholder: 'Gõ câu tiếng Trung...',
        title: 'Dịch sang tiếng Trung',
        promptMain: picked.exvi,
        ans: s,
        lab1: 'Gần đúng (sai ít chữ)',
        check: (val: string) => sim(nz(val), nz(s)),
        hints: [
          `Từ khóa: ${w.h} (${w.py}) = ${w.vi}`,
          `Các từ trong câu: ${shuf(tk).join(' / ')}`,
          `Bắt đầu bằng: ${nz(s).slice(0, 2)}`,
        ],
      };
    }

    if (effectiveSub === 'tv') {
      return {
        w,
        s,
        exVi: picked.exvi,
        zhInput: false,
        diff: false,
        selfCheck: true,
        sayText: s,
        placeholder: 'Gõ nghĩa tiếng Việt...',
        title: 'Dịch sang tiếng Việt',
        promptZh: s,
        ans: picked.exvi,
        selfLabel: 'Đối chiếu với đáp án',
        hints: [`Từ khóa: ${w.h} (${w.py}) = ${w.vi}`],
      };
    }

    if (effectiveSub === 'ty') {
      return {
        w,
        s,
        exVi: picked.exvi,
        zhInput: true,
        diff: true,
        selfCheck: false,
        placeholder: 'Gõ chữ Hán...',
        title: 'Gõ chữ Hán của từ này',
        promptMain: w.vi,
        promptSub: `${w.pos} · Hán Việt: ${w.hv}`,
        ans: w.h,
        extra: w.py,
        check: (val: string): 0 | 1 | 2 => (nz(val) === w.h ? 2 : 0),
        hints: [`Pinyin: ${w.py}`, `Chiết tự: ${w.rad || '—'}`],
      };
    }

    if (effectiveSub === 'pn') {
      return {
        w,
        s: w.h,
        exVi: picked.exvi,
        zhInput: false,
        diff: false,
        selfCheck: false,
        sayText: w.h,
        placeholder: 'Gõ pinyin (có dấu hoặc không dấu)...',
        title: 'Gõ Pinyin cho chữ Hán sau',
        promptZh: w.h,
        promptSub: w.vi,
        ans: w.py,
        lab1: 'Đúng âm tiết, sai hoặc thiếu thanh điệu',
        check: (val: string): 0 | 1 | 2 => {
          const clean = val.toLowerCase().replace(/\s/g, '');
          const target = w.py.toLowerCase().replace(/\s/g, '');
          if (clean === target) return 2;
          return spn(val) === spn(w.py) ? 1 : 0;
        },
        hints: [`Nghĩa: ${w.vi} (${w.pos})`, `Số chữ Hán: ${[...w.h].length}`],
      };
    }

    if (effectiveSub === 'sc') {
      let scrambled = [...tk];
      for (let t = 0; t < 10 && scrambled.join('') === tk.join(''); t++) {
        scrambled = [...tk];
        const i = Math.floor(Math.random() * Math.max(1, scrambled.length - 1));
        if (scrambled.length > 1) {
          [scrambled[i], scrambled[i + 1]] = [scrambled[i + 1], scrambled[i]];
        }
      }
      return {
        w,
        s,
        exVi: picked.exvi,
        zhInput: true,
        diff: true,
        selfCheck: false,
        placeholder: 'Gõ lại câu theo đúng thứ tự...',
        title: 'Sửa lại câu bị đảo trật tự từ',
        promptZh: scrambled.join(' '),
        promptSub: picked.exvi,
        ans: s,
        lab1: 'Gần đúng (sai ít chữ)',
        check: (val: string) => sim(nz(val), nz(s)),
        hints: [`Từ khóa: ${w.h} = ${w.vi}`, `Từ đầu câu: ${tk[0] || ''}`],
      };
    }

    if (effectiveSub === 'dg') {
      return {
        w,
        s,
        exVi: picked.exvi,
        zhInput: true,
        diff: true,
        selfCheck: false,
        placeholder: 'Gõ từ còn thiếu...',
        title: 'Gõ từ còn thiếu vào chỗ trống',
        promptZh: s.includes(w.h) ? s.replace(w.h, '＿＿') : `${s} (＿＿)`,
        promptSub: picked.exvi,
        ans: w.h,
        extra: `${w.py} = ${w.vi}`,
        check: (val: string): 0 | 1 | 2 => (nz(val) === w.h ? 2 : 0),
        hints: [`Pinyin: ${w.py}`, `Nghĩa: ${w.vi}`],
      };
    }

    // 'dt' Đặt câu
    return {
      w,
      s,
      exVi: picked.exvi,
      zhInput: true,
      diff: false,
      selfCheck: true,
      placeholder: 'Gõ câu tiếng Trung bạn tự đặt...',
      title: 'Đặt một câu tiếng Trung với từ sau',
      promptZh: w.h,
      promptSub: `${w.py} · ${w.vi}`,
      ans: s || `${w.h} (${w.py})`,
      selfLabel: 'Câu mẫu tham khảo',
      note: (val: string) =>
        nz(val).includes(w.h)
          ? `Câu của bạn đã sử dụng từ ${w.h}.`
          : `Lưu ý: Câu của bạn chưa chứa từ ${w.h}.`,
      hints: [`Nghĩa: ${w.vi} (${w.pos})`, `Ví dụ gợi ý: ${picked.exvi}`],
    };
  }, [mode, dcSub, words, wordsWithEx, roundSeed]);

  const writerWord = useMemo<Word | null>(() => {
    if (mode !== 'wr' || !words.length) return null;
    return words[Math.floor(Math.random() * words.length)];
  }, [mode, words, roundSeed]);

  // Auto-play audio when round starts for listening modes
  useEffect(() => {
    const sayText =
      quizRound?.sayText ||
      toneRound?.sayText ||
      (mode === 'listen' && !listenPickMode ? listenWord?.h : undefined);
    if (sayText) {
      speakZh(sayText, speed);
    }
  }, [quizRound, toneRound, listenWord, mode, listenPickMode, roundSeed]);

  const activeMcq =
    mode === 'quiz' || (mode === 'listen' && listenPickMode)
      ? quizRound
      : mode === 'cz'
        ? clozeRound
        : mode === 'tn'
          ? toneRound
          : mode === 'cf'
            ? confusableRound
            : null;

  const renderMcqBlock = (round: McqRound | null, emptyMsg: string) => {
    if (!round) {
      return (
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-8 text-center text-sm text-[#616b66]">
          {emptyMsg}
        </div>
      );
    }

    const isAnswered = selectedOpt !== null;
    const pickedCorrect =
      isAnswered && round.options[selectedOpt]?.id === round.w.id;

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 md:p-8 text-center space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#616b66]">
              {round.promptTitle}
            </span>
            <div className="flex items-center gap-2">
              {mode === 'listen' && (
                <button
                  type="button"
                  onClick={() => setListenPickMode(false)}
                  className="rounded-lg border border-[#e6e2da] bg-[#faf9f7] px-2.5 py-1 text-xs font-medium text-[#1c2421] hover:bg-[#f3f0eb]"
                >
                  Chuyển sang gõ chữ
                </button>
              )}
              {(round.sayText || round.promptZh) && (
                <SpeechControl
                  text={round.sayText || round.w.h}
                  speed={speed}
                  onChangeSpeed={onChangeSpeed}
                  compact
                />
              )}
            </div>
          </div>

          {round.sayText && (
            <div className="py-2 flex justify-center">
              <SpeechControl
                text={round.sayText}
                speed={speed}
                onChangeSpeed={onChangeSpeed}
                label="Nghe lại"
              />
            </div>
          )}

          {round.promptZh && (
            <p className="font-zh text-3xl md:text-5xl font-semibold text-[#1c2421] py-2">
              {round.promptZh}
            </p>
          )}

          {round.promptSub && (
            <p className="text-base md:text-lg font-medium text-[#1f7a63]">
              {round.promptSub}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {round.options.map((opt, i) => {
            const isCorrectOpt = opt.id === round.w.id;
            const isSelected = selectedOpt === i;
            let cls =
              'border-[#e6e2da] bg-white text-[#1c2421] hover:border-[#1f7a63]/50 hover:bg-[#faf9f7]';
            if (isAnswered) {
              if (isCorrectOpt) {
                cls = 'border-[#1f7a63] bg-[#e3f1ec] text-[#145443] font-semibold';
              } else if (isSelected) {
                cls = 'border-[#b8352b] bg-[#fdf2f1] text-[#b8352b]';
              } else {
                cls = 'border-[#e6e2da] bg-white/60 text-[#616b66]';
              }
            }

            return (
              <button
                key={`${opt.id}_${i}`}
                type="button"
                disabled={isAnswered}
                onClick={() => {
                  setSelectedOpt(i);
                  const ok = opt.id === round.w.id;
                  onRecord(round.w, ok);
                  speakZh(round.exText || round.w.h, speed);
                }}
                className={`rounded-2xl border p-4 text-left transition-colors min-h-[56px] ${
                  round.zhOpts ? 'font-zh text-xl' : 'text-base font-medium'
                } ${cls}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                  pickedCorrect ? 'text-[#1f7a63]' : 'text-[#b8352b]'
                }`}
              >
                {pickedCorrect ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {pickedCorrect ? 'Chính xác' : 'Chưa đúng'}
              </span>
              <SpeechControl
                text={round.exText || round.w.h}
                speed={speed}
                onChangeSpeed={onChangeSpeed}
                compact
              />
            </div>

            <div className="text-sm text-[#1c2421]">
              <span className="font-zh text-lg font-semibold mr-2">{round.w.h}</span>
              <span className="text-[#1f7a63] font-medium mr-2">{round.w.py}</span>
              <span>· {round.w.vi}</span>
              {round.exText && (
                <p className="mt-1.5 text-[#616b66]">
                  <span className="font-zh text-[#1c2421]">{round.exText}</span> — {round.exVi}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={nextRound}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1f7a63] py-3 text-sm font-semibold text-white hover:bg-[#186250] min-h-[44px]"
            >
              Câu tiếp theo
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Practice Mode Selector Bar */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                  active
                    ? 'bg-[#1f7a63] text-white'
                    : 'text-[#616b66] hover:bg-[#f3f0eb] hover:text-[#1c2421]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode 1, 4, 5, 6 (MCQ variants) */}
      {(mode === 'quiz' ||
        (mode === 'listen' && listenPickMode) ||
        mode === 'cz' ||
        mode === 'tn' ||
        mode === 'cf') &&
        renderMcqBlock(
          activeMcq,
          mode === 'cf'
            ? 'Chưa có nhóm từ dễ nhầm kèm ví dụ trong bài đang chọn.'
            : 'Chưa có từ phù hợp kèm câu ví dụ cho dạng bài này.'
        )}

      {/* Mode 2: Listen & Dictate */}
      {mode === 'listen' && !listenPickMode && (
        <div className="mx-auto max-w-2xl space-y-4">
          {!listenWord ? (
            <div className="rounded-2xl border border-[#e6e2da] bg-white p-8 text-center text-sm text-[#616b66]">
              Chưa có từ nào trong mục này.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 md:p-8 text-center space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#616b66]">
                    Nghe chép chính tả chữ Hán
                  </span>
                  <button
                    type="button"
                    onClick={() => setListenPickMode(true)}
                    className="rounded-lg border border-[#e6e2da] bg-[#faf9f7] px-2.5 py-1 text-xs font-medium text-[#1c2421] hover:bg-[#f3f0eb]"
                  >
                    Chuyển sang chọn đáp án
                  </button>
                </div>

                <div className="py-2 flex flex-wrap items-center justify-center gap-3">
                  <SpeechControl
                    text={listenWord.h}
                    speed={speed}
                    onChangeSpeed={onChangeSpeed}
                    label="Nghe lại"
                  />
                  <button
                    type="button"
                    onClick={() => setHintLevel(1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2 text-xs font-medium text-[#1c2421] hover:bg-[#f3f0eb] min-h-[40px]"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-[#d96b43]" />
                    Gợi ý
                  </button>
                </div>

                {hintLevel > 0 && (
                  <p className="text-sm text-[#616b66]">
                    {listenWord.vi} · {[...listenWord.h].length} chữ Hán
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  lang="zh-CN"
                  autoComplete="off"
                  disabled={submitted}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputVal.trim() && !submitted) {
                      setSubmitted(true);
                      onRecord(listenWord, nz(inputVal) === listenWord.h);
                    }
                  }}
                  placeholder="Gõ chữ Hán bạn nghe được..."
                  className="w-full rounded-2xl border border-[#e6e2da] bg-white px-4 py-3.5 font-zh text-2xl text-[#1c2421] focus:border-[#1f7a63] focus:outline-none"
                />

                {!submitted ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!inputVal.trim()) return;
                      setSubmitted(true);
                      onRecord(listenWord, nz(inputVal) === listenWord.h);
                    }}
                    className="w-full rounded-xl bg-[#1f7a63] py-3.5 text-sm font-semibold text-white hover:bg-[#186250] min-h-[46px]"
                  >
                    Kiểm tra
                  </button>
                ) : (
                  <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-3">
                    {(() => {
                      const ok = nz(inputVal) === listenWord.h;
                      return (
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                              ok ? 'text-[#1f7a63]' : 'text-[#b8352b]'
                            }`}
                          >
                            {ok ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {ok ? 'Chính xác' : `Chưa đúng (bạn gõ: ${inputVal})`}
                          </span>
                          <p className="text-sm text-[#1c2421]">
                            <span className="font-zh text-2xl font-semibold mr-2">
                              {listenWord.h}
                            </span>
                            <span className="text-[#1f7a63] font-medium mr-2">
                              {listenWord.py}
                            </span>
                            · {listenWord.vi}
                          </p>
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={nextRound}
                      className="w-full rounded-xl bg-[#1f7a63] py-3 text-sm font-semibold text-white hover:bg-[#186250]"
                    >
                      Từ tiếp theo
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Mode 3: Sentence Reorder (Sắp xếp câu) */}
      {mode === 'ro' && (
        <div className="mx-auto max-w-2xl space-y-4">
          {!reorderRound ? (
            <div className="rounded-2xl border border-[#e6e2da] bg-white p-8 text-center text-sm text-[#616b66]">
              Chưa có câu ví dụ đủ dài để sắp xếp trong mục đang chọn.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 text-center space-y-2">
                <p className="text-xs font-medium text-[#616b66]">
                  Chạm các từ theo đúng trật tự câu
                </p>
                <p className="font-display text-xl font-semibold text-[#1c2421]">
                  {reorderRound.exVi}
                </p>
              </div>

              {/* Answer Drop Zone */}
              <div className="min-h-[76px] rounded-2xl border-2 border-dashed border-[#dcd7cd] bg-white p-3.5 flex flex-wrap gap-2 items-center">
                {pickedTokenIndices.length === 0 && (
                  <span className="text-sm text-[#8c948f]">
                    Các từ bạn chọn sẽ xuất hiện ở đây...
                  </span>
                )}
                {pickedTokenIndices.map((idx) => {
                  const item = reorderRound.bank.find((b) => b.i === idx);
                  if (!item) return null;
                  return (
                    <button
                      key={`ans_${idx}`}
                      type="button"
                      disabled={submitted}
                      onClick={() =>
                        setPickedTokenIndices((prev) => prev.filter((x) => x !== idx))
                      }
                      className="rounded-xl border border-[#1f7a63]/40 bg-[#e3f1ec] px-3.5 py-2 font-zh text-xl text-[#145443] transition-transform active:scale-95"
                    >
                      {item.t}
                    </button>
                  );
                })}
              </div>

              {/* Word Bank */}
              <div className="flex flex-wrap gap-2">
                {reorderRound.bank
                  .filter((b) => !pickedTokenIndices.includes(b.i))
                  .map((item) => (
                    <button
                      key={`bank_${item.i}`}
                      type="button"
                      disabled={submitted}
                      onClick={() => {
                        const next = [...pickedTokenIndices, item.i];
                        setPickedTokenIndices(next);
                        if (next.length === reorderRound.tokens.length) {
                          setSubmitted(true);
                          const ok = next.every((bankIdx, pos) => {
                            const tok = reorderRound.bank.find((b) => b.i === bankIdx)?.t;
                            return tok === reorderRound.tokens[pos];
                          });
                          onRecord(reorderRound.w, ok);
                          speakZh(reorderRound.exClean, speed);
                        }
                      }}
                      className="rounded-xl border border-[#e6e2da] bg-white px-4 py-2 font-zh text-xl text-[#1c2421] hover:border-[#1f7a63]/50 hover:bg-[#faf9f7] transition-transform active:scale-95"
                    >
                      {item.t}
                    </button>
                  ))}
              </div>

              {submitted && (
                <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-3">
                  {(() => {
                    const ok = pickedTokenIndices.every((bankIdx, pos) => {
                      const tok = reorderRound.bank.find((b) => b.i === bankIdx)?.t;
                      return tok === reorderRound.tokens[pos];
                    });
                    return (
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                            ok ? 'text-[#1f7a63]' : 'text-[#b8352b]'
                          }`}
                        >
                          {ok ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {ok ? 'Chính xác' : 'Chưa đúng'}
                        </span>
                        <SpeechControl
                          text={reorderRound.exClean}
                          speed={speed}
                          onChangeSpeed={onChangeSpeed}
                          compact
                        />
                      </div>
                    );
                  })()}
                  <p className="font-zh text-xl text-[#1c2421]">{reorderRound.exClean}</p>
                  <p className="text-xs text-[#616b66]">
                    Từ khóa: {reorderRound.w.h} ({reorderRound.w.py}) · {reorderRound.w.vi}
                  </p>
                  <button
                    type="button"
                    onClick={nextRound}
                    className="w-full rounded-xl bg-[#1f7a63] py-3 text-sm font-semibold text-white hover:bg-[#186250]"
                  >
                    Câu tiếp theo
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Mode 7: Dịch câu & Phản xạ viết */}
      {mode === 'dc' && (
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {DC_SUBMODES.map((sm) => (
              <button
                key={sm.id}
                type="button"
                onClick={() => setDcSub(sm.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  dcSub === sm.id
                    ? 'bg-[#d96b43] text-white'
                    : 'border border-[#e6e2da] bg-white text-[#616b66] hover:text-[#1c2421]'
                }`}
              >
                {sm.label}
              </button>
            ))}
          </div>

          {!translateRound ? (
            <div className="rounded-2xl border border-[#e6e2da] bg-white p-8 text-center text-sm text-[#616b66]">
              Chưa có từ kèm câu ví dụ phù hợp cho dạng bài này.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 text-center space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#616b66]">
                    {translateRound.title}
                  </span>
                  {translateRound.sayText && (
                    <SpeechControl
                      text={translateRound.sayText}
                      speed={speed}
                      onChangeSpeed={onChangeSpeed}
                      compact
                    />
                  )}
                </div>

                {translateRound.promptZh && (
                  <p className="font-zh text-3xl md:text-4xl font-semibold text-[#1c2421]">
                    {translateRound.promptZh}
                  </p>
                )}

                {translateRound.promptMain && (
                  <p className="font-display text-xl md:text-2xl font-semibold text-[#1c2421]">
                    {translateRound.promptMain}
                  </p>
                )}

                {translateRound.promptSub && (
                  <p className="text-sm text-[#616b66]">{translateRound.promptSub}</p>
                )}
              </div>

              <textarea
                rows={2}
                lang={translateRound.zhInput ? 'zh-CN' : 'vi'}
                disabled={submitted}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing &&
                    inputVal.trim() &&
                    !submitted
                  ) {
                    e.preventDefault();
                    setSubmitted(true);
                    if (translateRound.s) speakZh(translateRound.s, speed);
                  }
                }}
                placeholder={translateRound.placeholder}
                className={`w-full rounded-2xl border border-[#e6e2da] bg-white p-4 text-[#1c2421] focus:border-[#1f7a63] focus:outline-none ${
                  translateRound.zhInput ? 'font-zh text-xl' : 'text-base'
                }`}
              />

              {hintLevel > 0 && (
                <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-3 text-xs text-[#616b66] space-y-1">
                  {translateRound.hints.slice(0, hintLevel).map((h, idx) => (
                    <p key={idx}>• {h}</p>
                  ))}
                </div>
              )}

              {!submitted ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setHintLevel((h) => Math.min(translateRound.hints.length, h + 1))
                    }
                    className="rounded-xl border border-[#e6e2da] bg-white px-4 py-3 text-sm font-medium text-[#1c2421] hover:bg-[#f3f0eb] min-h-[46px]"
                  >
                    Gợi ý ({hintLevel}/{translateRound.hints.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!inputVal.trim()) return;
                      setSubmitted(true);
                      if (translateRound.s) speakZh(translateRound.s, speed);
                    }}
                    className="flex-1 rounded-xl bg-[#1f7a63] py-3 text-sm font-semibold text-white hover:bg-[#186250] min-h-[46px]"
                  >
                    Kiểm tra
                  </button>
                </div>
              ) : translateRound.selfCheck ? (
                <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#1f7a63]">
                    {translateRound.selfLabel}
                  </p>
                  <p className="font-zh text-xl text-[#1c2421]">{translateRound.ans}</p>
                  {translateRound.note && (
                    <p className="text-xs text-[#616b66]">
                      {translateRound.note(inputVal)}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onRecord(translateRound.w, false);
                        nextRound();
                      }}
                      className="rounded-xl border border-[#e8c5c1] bg-[#fdf2f1] py-3 text-sm font-semibold text-[#b8352b]"
                    >
                      Chưa đúng
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onRecord(translateRound.w, true);
                        nextRound();
                      }}
                      className="rounded-xl bg-[#1f7a63] py-3 text-sm font-semibold text-white"
                    >
                      Mình đúng
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-3">
                  {(() => {
                    const score = overrideCorrect
                      ? 2
                      : translateRound.check
                        ? translateRound.check(inputVal)
                        : 0;
                    const label =
                      score === 2
                        ? 'Chính xác'
                        : score === 1
                          ? translateRound.lab1 || 'Gần đúng'
                          : 'Chưa đúng';

                    const ansChars = [...nz(translateRound.ans)];
                    const userChars = [...nz(inputVal)];

                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-semibold ${
                              score === 2
                                ? 'text-[#1f7a63]'
                                : score === 1
                                  ? 'text-[#8a5d0e]'
                                  : 'text-[#b8352b]'
                            }`}
                          >
                            {label}
                          </span>
                          <SpeechControl
                            text={translateRound.s || translateRound.w.h}
                            speed={speed}
                            onChangeSpeed={onChangeSpeed}
                            compact
                          />
                        </div>

                        {translateRound.diff && (
                          <p className="text-sm">
                            Bạn gõ:{' '}
                            <span className="font-zh text-lg">
                              {userChars.map((c, idx) => (
                                <span
                                  key={idx}
                                  className={
                                    c === ansChars[idx]
                                      ? 'text-[#1c2421]'
                                      : 'text-[#b8352b] underline'
                                  }
                                >
                                  {c}
                                </span>
                              ))}
                            </span>
                          </p>
                        )}

                        <p className="text-sm">
                          Đáp án:{' '}
                          <span className="font-zh text-xl font-semibold text-[#1c2421]">
                            {translateRound.ans}
                          </span>
                        </p>
                        {translateRound.extra && (
                          <p className="text-xs text-[#616b66]">{translateRound.extra}</p>
                        )}

                        <div className="flex gap-2">
                          {score < 2 && (
                            <button
                              type="button"
                              onClick={() => setOverrideCorrect(true)}
                              className="rounded-xl border border-[#ead9b7] bg-[#fbf5e8] px-4 py-3 text-xs font-semibold text-[#8a5d0e]"
                            >
                              Đáp án khác, vẫn đúng
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onRecord(translateRound.w, score === 2);
                              nextRound();
                            }}
                            className="flex-1 rounded-xl bg-[#1f7a63] py-3 text-sm font-semibold text-white"
                          >
                            Tiếp tục
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode 8: Tập viết nét chữ Hán */}
      {mode === 'wr' && (
        <div className="mx-auto max-w-2xl space-y-4">
          {!writerWord ? (
            <div className="rounded-2xl border border-[#e6e2da] bg-white p-8 text-center text-sm text-[#616b66]">
              Chưa có từ nào trong mục này.
            </div>
          ) : (
            <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 md:p-8 space-y-5 text-center">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-xs text-[#616b66]">Bài {writerWord.l}</p>
                  <p className="font-display text-xl font-semibold text-[#1c2421]">
                    {writerWord.vi}
                  </p>
                  <p className="text-sm font-medium text-[#d96b43]">{writerWord.py}</p>
                </div>
                <SpeechControl
                  text={writerWord.h}
                  speed={speed}
                  onChangeSpeed={onChangeSpeed}
                  compact
                />
              </div>

              <HanziCanvas
                hanzi={writerWord.h}
                size={152}
                onComplete={() => onRecord(writerWord, true)}
              />

              <button
                type="button"
                onClick={nextRound}
                className="w-full rounded-xl bg-[#1f7a63] py-3 text-sm font-semibold text-white hover:bg-[#186250] min-h-[44px]"
              >
                Chuyển sang từ khác
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode 9: Mô phỏng Gõ Pinyin chọn Chữ Hán (IME như nhắn tin) */}
      {mode === 'ime' && (
        <div className="mx-auto max-w-2xl space-y-4">
          {!imeRound ? (
            <div className="rounded-2xl border border-[#e6e2da] bg-white p-8 text-center text-sm text-[#616b66]">
              Chưa có từ nào trong mục này.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Situation Card */}
              <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 text-center space-y-2">
                <span className="text-xs font-medium text-[#616b66]">
                  Tình huống tiếng Việt · Gõ Pinyin không dấu rồi chọn chữ Hán từ thanh gợi ý
                </span>
                <p className="font-display text-xl md:text-2xl font-semibold text-[#1c2421]">
                  {imeRound.promptVi}
                </p>
                <p className="text-xs text-[#616b66]">
                  Từ khóa gợi ý: {imeRound.w.vi} ({imeRound.pinyinHint})
                </p>
              </div>

              {/* Composed Message Box */}
              <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#616b66]">
                    Tin nhắn đã ghép:
                  </span>
                  <button
                    type="button"
                    disabled={submitted || !imeComposed}
                    onClick={() =>
                      setImeComposed((prev) => {
                        const chars = [...prev];
                        chars.pop();
                        return chars.join('');
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-[#e6e2da] bg-[#faf9f7] px-2.5 py-1 text-xs font-medium text-[#616b66] hover:text-[#1c2421] disabled:opacity-40"
                  >
                    <Delete className="h-3.5 w-3.5" />
                    Xóa 1 chữ
                  </button>
                </div>

                <div className="min-h-[56px] rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-4 py-3 font-zh text-2xl text-[#1c2421] flex items-center">
                  {imeComposed || (
                    <span className="font-sans text-sm text-[#8c948f]">
                      Chữ Hán bạn chọn sẽ hiện tại đây...
                    </span>
                  )}
                </div>

                {/* Candidate Bar */}
                {!submitted && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 min-h-[42px] items-center rounded-xl bg-[#f3f0eb] p-2">
                      {imeCandidates.length === 0 ? (
                        <span className="text-xs text-[#616b66] px-2">
                          {imePyBuffer.trim()
                            ? 'Không có chữ Hán khớp, thử xóa bớt hoặc tách từng âm tiết (vd: wo, zai, sushe)...'
                            : 'Gõ Pinyin không dấu vào ô bên dưới (vd: qingwen, tushuguan, wo, zai...)'}
                        </span>
                      ) : (
                        imeCandidates.map((cand, idx) => (
                          <button
                            key={`${cand}_${idx}`}
                            type="button"
                            onClick={() => {
                              setImeComposed((prev) => prev + cand);
                              setImePyBuffer('');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-white px-3.5 py-2 font-zh text-xl text-[#1c2421] shadow-2xs hover:border-[#1f7a63] hover:bg-[#e3f1ec] active:scale-95 transition-all"
                          >
                            <span className="font-mono-num text-xs text-[#616b66]">
                              {idx + 1}.
                            </span>
                            <span>{cand}</span>
                          </button>
                        ))
                      )}
                    </div>

                    <input
                      type="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      value={imePyBuffer}
                      onChange={(e) => setImePyBuffer(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          (e.key === ' ' || e.key === 'Enter') &&
                          imeCandidates.length > 0
                        ) {
                          e.preventDefault();
                          setImeComposed((prev) => prev + imeCandidates[0]);
                          setImePyBuffer('');
                        } else if (
                          /^[1-7]$/.test(e.key) &&
                          imeCandidates[Number(e.key) - 1]
                        ) {
                          e.preventDefault();
                          setImeComposed(
                            (prev) => prev + imeCandidates[Number(e.key) - 1]
                          );
                          setImePyBuffer('');
                        }
                      }}
                      placeholder="Gõ Pinyin không dấu (vd: qingwen, zai, sushe)..."
                      className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-4 py-3 text-base text-[#1c2421] focus:border-[#1f7a63] focus:bg-white focus:outline-none min-h-[48px]"
                    />
                  </div>
                )}
              </div>

              {!submitted ? (
                <button
                  type="button"
                  disabled={!imeComposed.trim()}
                  onClick={() => {
                    const ok =
                      nz(imeComposed) === nz(imeRound.targetZh) ||
                      sim(nz(imeComposed), nz(imeRound.targetZh)) === 2;
                    setSubmitted(true);
                    onRecord(imeRound.w, ok);
                    speakZh(imeRound.targetZh, speed);
                  }}
                  className="w-full rounded-xl bg-[#1f7a63] py-3.5 text-sm font-semibold text-white hover:bg-[#186250] disabled:opacity-50 min-h-[48px]"
                >
                  Gửi & Kiểm tra
                </button>
              ) : (
                <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-3">
                  {(() => {
                    const ok = nz(imeComposed) === nz(imeRound.targetZh);
                    return (
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                            ok ? 'text-[#1f7a63]' : 'text-[#b8352b]'
                          }`}
                        >
                          {ok ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {ok ? 'Chính xác' : `Chưa khớp (Bạn ghép: ${imeComposed})`}
                        </span>
                        <SpeechControl
                          text={imeRound.targetZh}
                          speed={speed}
                          onChangeSpeed={onChangeSpeed}
                          compact
                        />
                      </div>
                    );
                  })()}
                  <p className="text-sm text-[#1c2421]">
                    Đáp án chuẩn:{' '}
                    <span className="font-zh text-xl font-semibold">
                      {imeRound.targetZh}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={nextRound}
                    className="w-full rounded-xl bg-[#1f7a63] py-3 text-sm font-semibold text-white hover:bg-[#186250] min-h-[46px]"
                  >
                    Tình huống tiếp theo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode 10: Bài tập phản xạ Lượng từ & Collocations (Mobile-first) */}
      {mode === 'colloc' && collocRound && (
        <div className="mx-auto max-w-xl flex flex-col justify-between gap-4 min-h-[calc(100vh-260px)] md:min-h-0">
          {/* Upper Question Card */}
          <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 md:p-8 text-center space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs text-[#616b66]">
              <span>
                {collocRound.item.category === 'mw_noun'
                  ? 'Lượng từ + Danh từ'
                  : 'Động từ + Tân ngữ'}
                {collocRound.item.isAi ? ' · Câu AI mới' : ''}
              </span>
              <span className="font-mono-num">
                Đúng {collocStats.ok}/{collocStats.total}
              </span>
            </div>

            <p className="font-zh text-4xl md:text-5xl font-semibold text-[#1c2421] py-3 tracking-wide">
              {selectedOpt !== null
                ? collocRound.item.zhFull
                : collocRound.item.prompt}
            </p>

            {selectedOpt !== null && collocRound.item.pinyin && (
              <p className="text-sm font-medium text-[#d96b43]">
                {collocRound.item.pinyin}
              </p>
            )}

            <p className="text-sm font-medium text-[#616b66]">
              Gợi ý: <span className="text-[#1f7a63]">{collocRound.item.viFull}</span>
            </p>
          </div>

          {/* Explanation & SRS Update Card (appears immediately after picking) */}
          {selectedOpt !== null && (
            <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-2.5">
              {(() => {
                const ok =
                  collocRound.options[selectedOpt] === collocRound.item.answer;
                return (
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                        ok ? 'text-[#1f7a63]' : 'text-[#b8352b]'
                      }`}
                    >
                      {ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      {ok
                        ? 'Chính xác'
                        : `Chưa đúng · Đáp án: ${collocRound.item.answer}`}
                    </span>
                    <SpeechControl
                      text={collocRound.item.zhFull}
                      speed={speed}
                      onChangeSpeed={onChangeSpeed}
                      compact
                    />
                  </div>
                );
              })()}

              <p className="text-sm text-[#1c2421] leading-relaxed">
                {collocRound.item.explanation}
              </p>

              {collocRound.matchedWord && (
                <p className="text-xs text-[#616b66]">
                  Đã cập nhật tiến độ SRS cho từ{' '}
                  <span className="font-zh font-semibold text-[#1c2421]">
                    {collocRound.matchedWord.h}
                  </span>{' '}
                  ({collocRound.matchedWord.vi}).
                </p>
              )}
            </div>
          )}

          {aiCollocError && (
            <div className="rounded-xl border border-[#e8c5c1] bg-[#fdf2f1] px-4 py-2.5 text-xs text-[#b8352b]">
              {aiCollocError}
            </div>
          )}

          {/* Lower Thumb-Friendly Controls: 4 large buttons in 2 rows + AI generator */}
          <div className="space-y-3 mt-auto pt-1">
            <div className="grid grid-cols-2 gap-3">
              {collocRound.options.map((opt, i) => {
                const isAnswered = selectedOpt !== null;
                const isCorrect = opt === collocRound.item.answer;
                const isSelected = selectedOpt === i;
                let cls =
                  'border-[#e6e2da] bg-white text-[#1c2421] hover:border-[#1f7a63]/50 hover:bg-[#faf9f7] active:scale-[0.98]';
                if (isAnswered) {
                  if (isCorrect) {
                    cls = 'border-[#1f7a63] bg-[#e3f1ec] text-[#145443] font-bold';
                  } else if (isSelected) {
                    cls = 'border-[#b8352b] bg-[#fdf2f1] text-[#b8352b]';
                  } else {
                    cls = 'border-[#e6e2da] bg-white/60 text-[#616b66]';
                  }
                }

                return (
                  <button
                    key={`${collocRound.item.id}_${opt}_${i}`}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => {
                      setSelectedOpt(i);
                      const ok = opt === collocRound.item.answer;
                      setCollocStats((s) => ({
                        total: s.total + 1,
                        ok: s.ok + (ok ? 1 : 0),
                      }));
                      if (collocRound.matchedWord) {
                        onRecord(collocRound.matchedWord, ok);
                      }
                      speakZh(collocRound.item.zhFull, speed);
                    }}
                    className={`rounded-2xl border p-4 text-center font-zh text-2xl md:text-3xl font-semibold transition-all min-h-[68px] ${cls}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {selectedOpt !== null && (
                <button
                  type="button"
                  onClick={advanceCollocRound}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1f7a63] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#186250] min-h-[52px]"
                >
                  <span>Câu tiếp theo</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                disabled={aiCollocLoading || words.length === 0}
                onClick={handleGenerateAiCollocations}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d96b43]/40 bg-[#fbece6] px-4 py-3.5 text-sm font-semibold text-[#b84c27] hover:bg-[#f7ddd3] disabled:opacity-60 min-h-[52px]"
              >
                {aiCollocLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>✨ AI tạo thêm câu mới</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
