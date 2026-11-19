import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Star,
  Plus,
  PenTool,
  Volume2,
  Sparkles,
  Loader2,
  RefreshCw,
  CheckCircle2,
  BookOpen,
  GitCompare,
  Layers,
  Copy,
  Check,
  Save,
} from 'lucide-react';
import { enrichWordExamples, getWordProgress, makeWordId } from '../data/boyaSeed';
import type { DeepWordAnalysis, Word, WordProgress } from '../types';
import { cleanSentence, fdt } from '../utils/practice';
import {
  getCachedWordAnalysis,
  getPersonalNote,
  getToneSummaryFromPinyin,
  savePersonalNote,
  setCachedWordAnalysis,
} from '../utils/pinyin';
import { aiAnalyzeWordDetail } from '../utils/geminiClient';
import { speakZh, type SpeechSpeed } from '../utils/speech';
import { HanziCanvas } from './HanziCanvas';
import { SpeechControl } from './SpeechControl';
import { TonePinyin } from './TonePinyin';

interface WordDetailModalProps {
  word: Word;
  allWords: Word[];
  progress: Record<string, WordProgress>;
  lessonFilter: string;
  speed: SpeechSpeed;
  initialAnalysis?: DeepWordAnalysis | null;
  onChangeSpeed: (s: SpeechSpeed) => void;
  onToggleFav: (word: Word) => void;
  onAddToReview: (word: Word) => void;
  onClose: () => void;
}

export function WordDetailModal({
  word,
  allWords,
  progress,
  lessonFilter,
  speed,
  initialAnalysis = null,
  onChangeSpeed,
  onToggleFav,
  onAddToReview,
  onClose,
}: WordDetailModalProps) {
  const [activeWord, setActiveWord] = useState<Word>(word);
  const [analysis, setAnalysis] = useState<DeepWordAnalysis | null>(
    () => initialAnalysis || getCachedWordAnalysis(word.h)
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [personalNote, setPersonalNote] = useState(() =>
    getPersonalNote(word.h)
  );
  const [noteSavedTick, setNoteSavedTick] = useState(false);
  const [reviewAddedTick, setReviewAddedTick] = useState(false);
  const [copiedExcel, setCopiedExcel] = useState(false);

  // Selected character in Block 2 (null = practice full word)
  const [writerCharFilter, setWriterCharFilter] = useState<string | null>(null);
  const [writerTrigger, setWriterTrigger] = useState<{
    type: 'animate' | 'quiz';
    seq: number;
  } | null>(null);

  const writerSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveWord(word);
    setPersonalNote(getPersonalNote(word.h));
    setWriterCharFilter(null);
    setReviewAddedTick(false);
    setCopiedExcel(false);
  }, [word.id, word.h]);

  const fetchDeepAnalysis = async (target: Word, bypassCache = false) => {
    if (!bypassCache) {
      const cached = getCachedWordAnalysis(target.h);
      if (cached) {
        setAnalysis(cached);
        setErrorMsg('');
        return;
      }
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await aiAnalyzeWordDetail({
        hanzi: target.h,
        knownMeaning: target.vi,
        knownPinyin: target.py,
      });
      setCachedWordAnalysis(target.h, result);
      setAnalysis(result);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể tải phân tích chiết tự lúc này.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      initialAnalysis &&
      initialAnalysis.hanzi === activeWord.h
    ) {
      setCachedWordAnalysis(activeWord.h, initialAnalysis);
      setAnalysis(initialAnalysis);
      setErrorMsg('');
      return;
    }
    const cached = getCachedWordAnalysis(activeWord.h);
    if (cached) {
      setAnalysis(cached);
      setErrorMsg('');
    } else {
      setAnalysis(null);
      void fetchDeepAnalysis(activeWord, false);
    }
  }, [activeWord.h]);

  const existingInLibrary = useMemo(
    () =>
      allWords.find(
        (w) => w.id === activeWord.id || w.h === activeWord.h
      ) || null,
    [allWords, activeWord.id, activeWord.h]
  );

  const wordProgress = getWordProgress(
    progress,
    existingInLibrary || activeWord
  );

  const hanziChars = useMemo(
    () => [...activeWord.h].filter((c) => /[\u4e00-\u9fff]/.test(c)),
    [activeWord.h]
  );

  const displayPinyin = analysis?.pinyin || activeWord.py;
  const displayHanViet = analysis?.hanViet || activeWord.hv;
  const displayVi = analysis?.vietnamese || activeWord.vi;
  const displayEn = analysis?.english || activeWord.en;
  const displayPos = analysis?.pos || activeWord.pos;
  const tonesSummary =
    analysis?.tonesSummary || getToneSummaryFromPinyin(displayPinyin);

  const handleJumpToWriter = (triggerType: 'animate' | 'quiz' = 'quiz') => {
    writerSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    setWriterTrigger((prev) => ({
      type: triggerType,
      seq: (prev?.seq || 0) + 1,
    }));
  };

  const handleAddOrPrioritizeReview = () => {
    const targetLesson =
      existingInLibrary?.l ||
      (lessonFilter !== 'all' && lessonFilter !== 'wrong'
        ? lessonFilter
        : activeWord.l || 'Từ sưu tầm');

    const enriched: Word = enrichWordExamples({
      ...activeWord,
      id: makeWordId(targetLesson, activeWord.h),
      l: targetLesson,
      py: displayPinyin || activeWord.py,
      pos: displayPos || activeWord.pos,
      hv: displayHanViet || activeWord.hv,
      en: displayEn || activeWord.en,
      vi: displayVi || activeWord.vi,
      rad:
        activeWord.rad ||
        (analysis?.chars?.length
          ? analysis.chars
              .map(
                (c) =>
                  `${c.char}: bộ ${c.radical} (${c.radicalMeaning})`
              )
              .join('; ')
          : ''),
      mn: activeWord.mn || analysis?.mnemonicStory || '',
      ex: activeWord.ex || analysis?.exampleZhSpaced || '',
      exvi: activeWord.exvi || analysis?.exampleVi || '',
    });

    onAddToReview(enriched);
    setReviewAddedTick(true);
    window.setTimeout(() => setReviewAddedTick(false), 2600);
  };

  const handleCopyExcelRow = async () => {
    const radText =
      activeWord.rad ||
      (analysis?.chars?.length
        ? analysis.chars
            .map((c) => `${c.char} = bộ ${c.radical} (${c.radicalMeaning})`)
            .join('; ')
        : '');
    const row = [
      activeWord.l,
      activeWord.h,
      displayPinyin,
      displayPos,
      displayHanViet,
      displayEn,
      displayVi,
      radText,
      activeWord.mn || analysis?.mnemonicStory || '',
      activeWord.ex || analysis?.exampleZhSpaced || '',
      activeWord.exvi || analysis?.exampleVi || '',
    ]
      .map((cell) => String(cell || '').replace(/[\r\n\t]+/g, ' ').trim())
      .join('\t');

    try {
      await navigator.clipboard.writeText(row);
      setCopiedExcel(true);
      window.setTimeout(() => setCopiedExcel(false), 2200);
    } catch {
      // Ignore clipboard permission failure
    }
  };

  const handleInspectRelated = (item: {
    zh: string;
    py: string;
    hv: string;
    vi: string;
  }) => {
    const cleanZh = item.zh.trim();
    if (!cleanZh) return;
    const found = allWords.find((w) => w.h === cleanZh);
    const targetLesson =
      lessonFilter !== 'all' && lessonFilter !== 'wrong'
        ? lessonFilter
        : activeWord.l || 'Từ sưu tầm';
    const nextWord: Word =
      found ||
      enrichWordExamples({
        id: makeWordId(targetLesson, cleanZh),
        l: targetLesson,
        h: cleanZh,
        py: item.py,
        pos: '',
        hv: item.hv,
        en: '',
        vi: item.vi,
        rad: '',
        mn: '',
        ex: '',
        exvi: '',
        exs: [],
      });
    setActiveWord(nextWord);
    setPersonalNote(getPersonalNote(nextWord.h));
    setWriterCharFilter(null);
    setReviewAddedTick(false);
  };

  const handleNoteChange = (val: string) => {
    setPersonalNote(val);
    savePersonalNote(activeWord.h, val);
    setNoteSavedTick(true);
    window.setTimeout(() => setNoteSavedTick(false), 1500);
  };

  const targetLessonLabel =
    lessonFilter !== 'all' && lessonFilter !== 'wrong'
      ? lessonFilter === 'Từ sưu tầm'
        ? 'Từ sưu tầm'
        : `Bài ${lessonFilter}`
      : activeWord.l === 'Từ sưu tầm'
        ? 'Từ sưu tầm'
        : `Bài ${activeWord.l}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl max-h-[92vh] rounded-t-3xl sm:rounded-2xl border border-[#e6e2da] bg-[#faf9f7] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Sticky Modal Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-[#e6e2da] bg-white px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-4 w-4 text-[#1f7a63] shrink-0" />
            <span className="font-display text-sm font-semibold text-[#1c2421] truncate">
              Từ điển Chiết tự chuyên sâu · {activeWord.h}
            </span>
            <span className="hidden sm:inline text-xs text-[#616b66] font-mono-num">
              {wordProgress.n
                ? `· Ôn ${wordProgress.n} lần${wordProgress.due <= Date.now() ? ' (Đến hạn)' : ` (${fdt(wordProgress.due)})`}`
                : '· Từ mới'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void fetchDeepAnalysis(activeWord, true)}
              disabled={loading}
              title="Phân tích lại bằng Gemini"
              className="inline-flex items-center gap-1 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-2.5 py-1.5 text-xs font-medium text-[#616b66] hover:text-[#1c2421] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#d96b43]' : ''}`}
              />
              <span className="hidden sm:inline">Phân tích lại</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFav(existingInLibrary || activeWord)}
              className="rounded-xl border border-[#e6e2da] bg-white p-1.5 hover:bg-[#f3f0eb]"
              aria-label="Đánh dấu yêu thích"
            >
              <Star
                className={`h-4 w-4 ${
                  wordProgress.fav
                    ? 'fill-[#d96b43] text-[#d96b43]'
                    : 'text-[#616b66]'
                }`}
              />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng chi tiết từ vựng"
              className="rounded-xl border border-[#e6e2da] bg-white p-1.5 text-[#616b66] hover:bg-[#f3f0eb] hover:text-[#1c2421]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable 4-Block Dictionary Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-safe">
          {/* ================================================================= */}
          {/* KHỐI 1: TỔNG QUAN & SƠ ĐỒ CẤU TẠO CHỮ                             */}
          {/* ================================================================= */}
          <section className="rounded-2xl border border-[#e6e2da] bg-white p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-baseline gap-3.5 flex-wrap">
                  <h2 className="font-zh text-5xl sm:text-6xl font-semibold text-[#1c2421] leading-none">
                    {activeWord.h}
                  </h2>
                  <TonePinyin
                    pinyin={displayPinyin}
                    showLegend
                    className="text-2xl sm:text-3xl font-semibold gap-x-2"
                  />
                </div>

                <p className="font-display text-xl sm:text-2xl font-semibold text-[#1c2421] pt-1">
                  {displayVi || 'Đang phân tích nghĩa...'}
                </p>

                <p className="text-sm text-[#616b66]">
                  Hán Việt:{' '}
                  <span className="font-semibold text-[#1c2421]">
                    {displayHanViet || '—'}
                  </span>
                  {analysis?.chars && analysis.chars.length > 1 && (
                    <span className="text-xs text-[#616b66]">
                      {' '}
                      (
                      {analysis.chars
                        .map((c) => `${c.char}: ${c.hanViet}`)
                        .join(' · ')}
                      )
                    </span>
                  )}
                  {displayEn ? ` · ${displayEn}` : ''}
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <SpeechControl
                  text={activeWord.h}
                  speed={speed}
                  onChangeSpeed={onChangeSpeed}
                  label="Phát âm zh-CN"
                />
              </div>
            </div>

            {/* Thanh tách cấu tạo chữ trực quan */}
            <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-3.5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1f7a63]">
                Sơ đồ cấu tạo chữ
              </p>
              {analysis?.chars && analysis.chars.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-zh text-lg font-bold text-[#1c2421]">
                    {activeWord.h}
                  </span>
                  <span className="text-[#616b66] font-semibold">=</span>
                  {analysis.chars.map((c, idx) => (
                    <div key={`${c.char}_${idx}`} className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e6e2da] bg-white px-2.5 py-1 text-xs sm:text-sm text-[#1c2421]">
                        <span className="font-zh text-base font-semibold text-[#1c2421]">
                          {c.char}
                        </span>
                        <span className="text-[#616b66]">
                          [{c.hanViet} · bộ{' '}
                          <span className="font-zh text-[#d96b43] font-medium">
                            {c.radical}
                          </span>
                          ]
                        </span>
                      </span>
                      {idx < analysis.chars.length - 1 && (
                        <span className="text-[#616b66] font-semibold">+</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#616b66]">
                  {analysis?.decompositionFormula ||
                    activeWord.rad ||
                    (loading
                      ? 'Đang phân tích cấu tạo chữ và bộ thủ...'
                      : 'Chưa có dữ liệu sơ đồ cấu tạo.')}
                </p>
              )}
            </div>

            {/* Nhãn thông tin (4 ô chỉ số gọn gàng) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2">
                <p className="text-[11px] text-[#616b66]">Loại từ</p>
                <p className="text-sm font-semibold text-[#1c2421]">
                  {displayPos || '—'}
                </p>
              </div>
              <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2">
                <p className="text-[11px] text-[#616b66]">Số chữ</p>
                <p className="font-mono-num text-sm font-semibold text-[#1c2421]">
                  {hanziChars.length} chữ
                </p>
              </div>
              <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2">
                <p className="text-[11px] text-[#616b66]">Tổng số nét</p>
                <p className="font-mono-num text-sm font-semibold text-[#1c2421]">
                  {analysis?.totalStrokes ? `${analysis.totalStrokes} nét` : loading ? '...' : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2">
                <p className="text-[11px] text-[#616b66]">Thanh điệu</p>
                <p className="text-xs sm:text-sm font-semibold text-[#1f7a63] truncate" title={tonesSummary}>
                  {tonesSummary}
                </p>
              </div>
            </div>

            {/* Action Buttons: + Thêm vào ôn tập & Luyện viết & Copy Excel */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleAddOrPrioritizeReview}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1f7a63] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#186250] min-h-[42px]"
              >
                {reviewAddedTick ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Đã thêm vào lịch SRS ({targetLessonLabel})</span>
                  </>
                ) : existingInLibrary ? (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>+ Thêm vào ôn tập ngay</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>+ Thêm vào ôn tập ({targetLessonLabel})</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleJumpToWriter('quiz')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#d96b43]/40 bg-[#fbece6] px-4 py-2.5 text-sm font-semibold text-[#d96b43] transition-colors hover:bg-[#f7ddd2] min-h-[42px]"
              >
                <PenTool className="h-4 w-4" />
                <span>Luyện viết</span>
              </button>

              <button
                type="button"
                onClick={handleCopyExcelRow}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e6e2da] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#1c2421] transition-colors hover:bg-[#f3f0eb] min-h-[42px]"
              >
                {copiedExcel ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#1f7a63]" />
                    <span className="text-[#1f7a63]">Đã copy Excel</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[#1f7a63]" />
                    <span>Copy dòng Excel</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* AI Loading / Error Status Banner */}
          {loading && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-[#1f7a63]/30 bg-[#e3f1ec] px-4 py-3 text-sm text-[#145443]">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>
                AI đang phân tích bộ thủ, Lục thư, bút thuận và từ liên quan cho "{activeWord.h}"...
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e8c5c1] bg-[#fdf2f1] px-4 py-3 text-xs text-[#b8352b]">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => void fetchDeepAnalysis(activeWord, true)}
                className="font-semibold underline shrink-0"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* ================================================================= */}
          {/* KHỐI 2: BÚT THUẬN & PHÂN TÍCH TỪNG CHỮ ĐƠN                        */}
          {/* ================================================================= */}
          <section
            ref={writerSectionRef}
            className="rounded-2xl border border-[#e6e2da] bg-white p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-[#1c2421] flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-[#1f7a63]" />
                  Bút thuận & Phân tích từng chữ đơn
                </h3>
                <p className="text-xs text-[#616b66] mt-0.5">
                  Khung lưới điền tự (田) · Xem thứ tự nét viết hoặc tự luyện viết bằng tay
                </p>
              </div>

              {hanziChars.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setWriterCharFilter(null)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      writerCharFilter === null
                        ? 'bg-[#1f7a63] text-white'
                        : 'border border-[#e6e2da] bg-[#faf9f7] text-[#616b66]'
                    }`}
                  >
                    Tất cả ({hanziChars.length})
                  </button>
                  {hanziChars.map((ch, idx) => (
                    <button
                      key={`${ch}_${idx}`}
                      type="button"
                      onClick={() => setWriterCharFilter(ch)}
                      className={`rounded-lg px-2.5 py-1 font-zh text-sm font-medium ${
                        writerCharFilter === ch
                          ? 'bg-[#1f7a63] text-white'
                          : 'border border-[#e6e2da] bg-[#faf9f7] text-[#1c2421]'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-4">
              <HanziCanvas
                hanzi={writerCharFilter || activeWord.h}
                size={136}
                gridType="tian"
                actionTrigger={writerTrigger}
              />
            </div>

            {/* Bảng thông tin từng chữ */}
            {analysis?.chars && analysis.chars.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[#e6e2da]">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#faf9f7] text-[#616b66] border-b border-[#e6e2da]">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">Chữ</th>
                      <th className="px-3.5 py-2.5 font-semibold">Hán Việt</th>
                      <th className="px-3.5 py-2.5 font-semibold">Bộ thủ chính</th>
                      <th className="px-3.5 py-2.5 font-semibold">Số nét</th>
                      <th className="px-3.5 py-2.5 font-semibold">Kết cấu hình thái</th>
                      <th className="px-3.5 py-2.5 font-semibold">Lục thư</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0ede6] bg-white">
                    {analysis.chars.map((c, idx) => (
                      <tr key={`${c.char}_${idx}`} className="hover:bg-[#faf9f7]">
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-zh text-xl font-semibold text-[#1c2421]">
                              {c.char}
                            </span>
                            <TonePinyin pinyin={c.pinyin} className="text-xs font-medium" />
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-[#1c2421]">
                          {c.hanViet}
                        </td>
                        <td className="px-3.5 py-2.5 text-[#1c2421]">
                          <span className="font-zh font-semibold text-[#d96b43] mr-1">
                            {c.radical}
                          </span>
                          <span className="text-xs text-[#616b66]">
                            ({c.radicalMeaning})
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono-num text-[#1c2421]">
                          {c.strokeCount} nét
                        </td>
                        <td className="px-3.5 py-2.5 text-[#616b66]">
                          {c.structure}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-[#1f7a63]">
                          {c.liuShu}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ================================================================= */}
          {/* KHỐI 3: CHIẾT TỰ & MẸO NHỚ SINH ĐỘNG                              */}
          {/* ================================================================= */}
          <section className="rounded-2xl border border-[#e6e2da] bg-white p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#1c2421] flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#d96b43]" />
              Chiết tự bộ thủ & Mẹo nhớ sinh động
            </h3>

            {/* Chi tiết bộ thủ thành phần từng chữ */}
            {analysis?.chars && analysis.chars.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.chars.map((c, idx) => (
                  <div
                    key={`${c.char}_parts_${idx}`}
                    className="rounded-xl border border-[#e6e2da] bg-[#e3f1ec]/30 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-zh text-lg font-semibold text-[#1c2421]">
                        {c.char}{' '}
                        <span className="font-sans text-xs font-medium text-[#1f7a63]">
                          ({c.hanViet})
                        </span>
                      </span>
                      <span className="text-[11px] text-[#616b66]">
                        {c.structure}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {c.components.map((comp, pIdx) => (
                        <p key={pIdx} className="text-xs sm:text-sm text-[#1c2421]">
                          <span className="font-zh font-semibold text-[#d96b43] mr-1.5">
                            {comp.part}
                          </span>
                          <span className="font-medium">{comp.name}</span>
                          <span className="text-[#616b66]"> — {comp.meaning}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              activeWord.rad && (
                <div className="rounded-xl border border-[#e6e2da] bg-[#e3f1ec]/30 p-3.5 text-sm text-[#1c2421]">
                  {activeWord.rad}
                </div>
              )
            )}

            {/* Câu mẹo nhớ logic từ AI */}
            {(analysis?.mnemonicStory || activeWord.mn) && (
              <div className="rounded-xl border border-[#d96b43]/25 bg-[#fbece6]/45 p-4 space-y-1">
                <p className="text-xs font-semibold text-[#d96b43]">
                  Mẹo ghi nhớ nhanh
                </p>
                <p className="text-sm text-[#1c2421] leading-relaxed">
                  {analysis?.mnemonicStory || activeWord.mn}
                </p>
              </div>
            )}

            {/* Ghi chú mẹo cá nhân (lưu localStorage) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#1c2421]">
                  Ghi chú mẹo nhớ cá nhân của bạn
                </label>
                {noteSavedTick && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1f7a63]">
                    <Save className="h-3 w-3" />
                    Đã lưu vào máy
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                value={personalNote}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder="Tự viết câu liên tưởng riêng của bạn để nhớ chữ Hán này lâu hơn..."
                className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2.5 text-sm text-[#1c2421] placeholder:text-[#8c948f] focus:border-[#1f7a63] focus:bg-white focus:outline-none"
              />
            </div>
          </section>

          {/* ================================================================= */}
          {/* KHỐI 4: KẾT HỢP THƯỜNG GẶP & MỞ RỘNG TỪ VỰNG                      */}
          {/* ================================================================= */}
          <section className="rounded-2xl border border-[#e6e2da] bg-white p-5 sm:p-6 space-y-5">
            <h3 className="font-display text-base font-semibold text-[#1c2421] flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#1f7a63]" />
              Kết hợp thường gặp & Mở rộng từ vựng
            </h3>

            {/* 4.1 Kết hợp thường gặp */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-[#616b66] uppercase tracking-wide">
                Kết hợp thường gặp & Câu mẫu
              </p>

              <div className="space-y-2">
                {(analysis?.collocations || []).map((col, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-zh text-lg font-semibold text-[#1c2421]">
                          {col.zh}
                        </span>
                        <TonePinyin pinyin={col.py} className="text-xs sm:text-sm font-medium" />
                      </div>
                      <p className="text-xs sm:text-sm text-[#616b66] mt-0.5">
                        {col.vi}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakZh(col.zh, speed)}
                      className="rounded-lg border border-[#e6e2da] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1f7a63] hover:bg-[#e3f1ec] shrink-0"
                    >
                      <Volume2 className="h-3.5 w-3.5 inline mr-1" />
                      {speed}x
                    </button>
                  </div>
                ))}

                {/* Câu ví dụ gốc của từ (nếu có) */}
                {(activeWord.exs?.length || analysis?.exampleZhSpaced) && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1f7a63]/25 bg-[#e3f1ec]/25 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#1f7a63]">
                        Câu ví dụ trọng tâm
                      </p>
                      <p className="font-zh text-base font-medium text-[#1c2421]">
                        {cleanSentence(
                          activeWord.exs?.[0]?.[0] ||
                            activeWord.ex ||
                            analysis?.exampleZhSpaced
                        )}
                      </p>
                      <p className="text-xs sm:text-sm text-[#616b66]">
                        {activeWord.exs?.[0]?.[1] ||
                          activeWord.exvi ||
                          analysis?.exampleVi}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        speakZh(
                          cleanSentence(
                            activeWord.exs?.[0]?.[0] ||
                              activeWord.ex ||
                              analysis?.exampleZhSpaced
                          ),
                          speed
                        )
                      }
                      className="rounded-lg border border-[#e6e2da] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1f7a63] hover:bg-[#e3f1ec] shrink-0"
                    >
                      <Volume2 className="h-3.5 w-3.5 inline mr-1" />
                      {speed}x
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 4.2 Mạng lưới từ liên quan (3 nhóm: Từ ghép, Từ cận nghĩa, Từ trái nghĩa) */}
            {analysis && (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#616b66] uppercase tracking-wide">
                  Mạng lưới từ liên quan
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      title: 'Từ ghép mở rộng',
                      accent: 'text-[#1f7a63]',
                      items: analysis.compounds || [],
                    },
                    {
                      title: 'Từ cận nghĩa',
                      accent: 'text-[#8a5d0e]',
                      items: analysis.synonyms || [],
                    },
                    {
                      title: 'Từ trái nghĩa',
                      accent: 'text-[#b8352b]',
                      items: analysis.antonyms || [],
                    },
                  ].map((group) => (
                    <div
                      key={group.title}
                      className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-3.5 space-y-2.5"
                    >
                      <p className={`text-xs font-semibold ${group.accent}`}>
                        {group.title}
                      </p>
                      {group.items.length === 0 ? (
                        <p className="text-xs text-[#8c948f]">Không có mục nào</p>
                      ) : (
                        <div className="space-y-2">
                          {group.items.map((item, idx) => (
                            <div
                              key={`${item.zh}_${idx}`}
                              className="rounded-lg border border-[#e6e2da] bg-white p-2.5 flex items-start justify-between gap-2"
                            >
                              <button
                                type="button"
                                onClick={() => handleInspectRelated(item)}
                                className="text-left min-w-0 flex-1 hover:opacity-80"
                                title={`Tra chiết tự từ ${item.zh}`}
                              >
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="font-zh text-base font-semibold text-[#1c2421]">
                                    {item.zh}
                                  </span>
                                  <span className="text-[11px] text-[#1f7a63]">
                                    {item.py}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#616b66]">
                                  {item.hv ? `[${item.hv}] ` : ''}
                                  {item.vi}
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() => speakZh(item.zh, speed)}
                                className="rounded-md p-1 text-[#1f7a63] hover:bg-[#e3f1ec] shrink-0"
                                aria-label={`Nghe ${item.zh}`}
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4.3 Phân biệt từ dễ nhầm */}
            {analysis?.confusable && analysis.confusable.compareWord && (
              <div className="rounded-xl border border-[#d96b43]/30 bg-[#fbece6]/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GitCompare className="h-4 w-4 text-[#d96b43]" />
                    <span className="text-xs font-semibold text-[#d96b43] uppercase tracking-wide">
                      Phân biệt từ dễ nhầm
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#1c2421]">
                    <span className="font-zh text-sm">{activeWord.h}</span> vs{' '}
                    <span className="font-zh text-sm text-[#d96b43]">
                      {analysis.confusable.compareWord}
                    </span>{' '}
                    ({analysis.confusable.comparePinyin} · {analysis.confusable.compareHanViet}:{' '}
                    {analysis.confusable.compareMeaning})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                  <div className="rounded-xl border border-[#e6e2da] bg-white p-3 space-y-1">
                    <p className="text-xs font-semibold text-[#1f7a63]">
                      Giống nhau
                    </p>
                    <p className="text-[#1c2421] leading-relaxed">
                      {analysis.confusable.similarity}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e6e2da] bg-white p-3 space-y-1">
                    <p className="text-xs font-semibold text-[#d96b43]">
                      Khác nhau
                    </p>
                    <p className="text-[#1c2421] leading-relaxed">
                      {analysis.confusable.difference}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-[#e6e2da] bg-white p-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#1f7a63]">
                        Dùng {activeWord.h}:
                      </p>
                      <p className="font-zh text-sm text-[#1c2421] mt-0.5">
                        {analysis.confusable.exampleTargetZh}
                      </p>
                      <p className="text-[#616b66]">
                        {analysis.confusable.exampleTargetPy} ·{' '}
                        {analysis.confusable.exampleTargetVi}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        speakZh(analysis.confusable!.exampleTargetZh, speed)
                      }
                      className="rounded-md p-1 text-[#1f7a63] hover:bg-[#e3f1ec] shrink-0"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="rounded-xl border border-[#e6e2da] bg-white p-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#d96b43]">
                        Dùng {analysis.confusable.compareWord}:
                      </p>
                      <p className="font-zh text-sm text-[#1c2421] mt-0.5">
                        {analysis.confusable.exampleCompareZh}
                      </p>
                      <p className="text-[#616b66]">
                        {analysis.confusable.exampleComparePy} ·{' '}
                        {analysis.confusable.exampleCompareVi}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        speakZh(analysis.confusable!.exampleCompareZh, speed)
                      }
                      className="rounded-md p-1 text-[#1f7a63] hover:bg-[#e3f1ec] shrink-0"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
