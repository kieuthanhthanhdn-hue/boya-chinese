import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  PenTool,
  RotateCw,
  RefreshCw,
  Star,
  Volume2,
  X,
  BookOpen,
} from 'lucide-react';
import { IV, getWordProgress } from '../data/boyaSeed';
import type { DayLog, LogMap, Word, WordProgress } from '../types';
import { cleanSentence, td } from '../utils/practice';
import { speakZh, type SpeechSpeed } from '../utils/speech';
import { SpeechControl } from './SpeechControl';
import { HanziCanvas } from './HanziCanvas';

interface FlashcardViewProps {
  words: Word[];
  allWords: Word[];
  progress: Record<string, WordProgress>;
  log: LogMap;
  lessonFilter?: string;
  speed: SpeechSpeed;
  prioritizeWrongOnly?: boolean;
  onClearWrongOnly?: () => void;
  onChangeSpeed: (s: SpeechSpeed) => void;
  onRate: (word: Word, rating: 0 | 1 | 2) => void;
  onToggleFav: (word: Word) => void;
  onOpenWordDetail: (word: Word) => void;
}

export function FlashcardView({
  words,
  allWords,
  progress,
  log,
  lessonFilter = 'all',
  speed,
  prioritizeWrongOnly = false,
  onClearWrongOnly,
  onChangeSpeed,
  onRate,
  onToggleFav,
  onOpenWordDetail,
}: FlashcardViewProps) {
  const [reverseDir, setReverseDir] = useState(false); // false = Hanzi front, true = Meaning front
  const [flipped, setFlipped] = useState(false);
  const [forceAll, setForceAll] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showWriter, setShowWriter] = useState(false);
  const [exampleIdx, setExampleIdx] = useState(0);

  const touchStartX = useRef<number | null>(null);

  const todayKey = td();
  const todayLog = (log[todayKey] as DayLog | undefined) || { n: 0, ok: 0 };
  const dailyGoal = typeof log._g === 'number' ? log._g : 20;
  const dailyNewCap = typeof log._nw === 'number' ? log._nw : 10;

  const newTodayCount = useMemo(() => {
    return allWords.filter((w) => getWordProgress(progress, w).first === todayKey).length;
  }, [allWords, progress, todayKey]);

  const queue = useMemo(() => {
    const now = Date.now();
    return words
      .filter((w) => {
        const p = getWordProgress(progress, w);
        if (prioritizeWrongOnly) {
          return (p.wrong || 0) > 0;
        }
        if (forceAll) return true;
        const isDue = (p.due || 0) <= now;
        const allowedNew = (p.n || 0) > 0 || newTodayCount < dailyNewCap;
        return isDue && allowedNew;
      })
      .sort((a, b) => {
        const pa = getWordProgress(progress, a);
        const pb = getWordProgress(progress, b);
        const wrongDiff = (pb.wrong || 0) - (pa.wrong || 0);
        if (wrongDiff !== 0) return wrongDiff;
        const seenDiff = (pb.n ? 1 : 0) - (pa.n ? 1 : 0);
        if (seenDiff !== 0) return seenDiff;
        return (pa.due || 0) - (pb.due || 0);
      });
  }, [words, progress, forceAll, prioritizeWrongOnly, newTodayCount, dailyNewCap]);

  const currentWord = useMemo(() => {
    if (!queue.length) return null;
    if (currentId) {
      const found = queue.find((w) => w.id === currentId);
      if (found) return found;
    }
    return queue[0];
  }, [queue, currentId]);

  useEffect(() => {
    setForceAll(false);
    setFlipped(false);
    setShowWriter(false);
    setExampleIdx(0);
    setCurrentId(null);
  }, [lessonFilter]);

  useEffect(() => {
    if (currentWord && currentWord.id !== currentId) {
      setCurrentId(currentWord.id);
      setFlipped(false);
      setShowWriter(false);
      setExampleIdx(0);
    } else if (!currentWord && currentId !== null) {
      setCurrentId(null);
    }
  }, [currentWord, currentId]);

  const handleFlip = () => {
    if (!currentWord) return;
    setFlipped((prev) => {
      const next = !prev;
      if (next) {
        speakZh(currentWord.h, speed);
      }
      return next;
    });
  };

  const handleCommitRate = (rating: 0 | 1 | 2) => {
    if (!currentWord) return;
    const nextIdx = queue.findIndex((w) => w.id === currentWord.id);
    const fallbackNext = queue.length > 1 ? queue[(nextIdx + 1) % queue.length].id : null;
    onRate(currentWord, rating);
    setFlipped(false);
    setShowWriter(false);
    setExampleIdx(0);
    setCurrentId(fallbackNext);
  };

  // Keyboard shortcuts: Space (flip), 1/2/3 (rate), R (speak)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!currentWord) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        speakZh(currentWord.h, speed);
      } else if (flipped && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        const map: Record<string, 0 | 1 | 2> = { '1': 0, '2': 1, '3': 2 };
        handleCommitRate(map[e.key]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentWord, flipped, speed, queue]);

  if (words.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-10 text-center">
        <p className="font-display text-lg font-semibold text-[#1c2421]">
          Chưa có từ nào trong bộ lọc này
        </p>
        <p className="mt-2 text-sm text-[#616b66]">
          Chọn "Tất cả bài" hoặc thêm từ vựng mới trong mục Thống kê & Cài đặt.
        </p>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#e6e2da] bg-white p-8 md:p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e3f1ec] text-[#1f7a63]">
          <Check className="h-7 w-7" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-[#1c2421]">
          Đã hoàn thành thẻ đến hạn hôm nay
        </h2>
        <p className="mt-2 text-sm text-[#616b66]">
          Hôm nay bạn đã ôn <span className="font-mono-num font-semibold text-[#1c2421]">{todayLog.n}</span>/{dailyGoal} lượt. Quay lại theo lịch SRS hoặc ôn tiếp toàn bộ thẻ ngay bây giờ.
        </p>
        <button
          type="button"
          onClick={() => setForceAll(true)}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1f7a63] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#186250] min-h-[44px]"
        >
          <RefreshCw className="h-4 w-4" />
          Ôn thêm tất cả ({words.length} từ)
        </button>
      </div>
    );
  }

  const p = getWordProgress(progress, currentWord);
  const examples = currentWord.exs?.length
    ? currentWord.exs
    : currentWord.ex
      ? [[currentWord.ex, currentWord.exvi] as [string, string]]
      : [];
  const activeExample = examples[exampleIdx % Math.max(1, examples.length)] || null;
  const activeExClean = activeExample ? cleanSentence(activeExample[0]) : '';
  const pct = Math.min(100, Math.round((todayLog.n / Math.max(1, dailyGoal)) * 100));

  const nextBoxIfRemember = Math.min(IV.length - 1, (p.box || 0) + 1);
  const nextIntervalDays = IV[nextBoxIfRemember] ?? 1;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {prioritizeWrongOnly && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#e8c5c1] bg-[#fdf2f1] px-4 py-2.5 text-xs text-[#b8352b]">
          <span className="font-medium">
            Đang lọc chế độ ôn tập trung: Từ hay sai ({queue.length} thẻ)
          </span>
          {onClearWrongOnly && (
            <button
              type="button"
              onClick={onClearWrongOnly}
              className="font-semibold underline"
            >
              Về chế độ tất cả thẻ
            </button>
          )}
        </div>
      )}
      {/* Compact Session Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#e6e2da] bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setReverseDir((d) => !d);
              setFlipped(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-1.5 text-xs font-medium text-[#1c2421] transition-colors hover:bg-[#f3f0eb] min-h-[36px] whitespace-nowrap"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#1f7a63]" />
            Mặt trước: {reverseDir ? 'Nghĩa Việt' : 'Chữ Hán'}
          </button>

          <button
            type="button"
            onClick={() => setForceAll((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors min-h-[36px] whitespace-nowrap ${
              forceAll
                ? 'border-[#d96b43] bg-[#fbece6] text-[#d96b43]'
                : 'border-[#e6e2da] bg-[#faf9f7] text-[#1c2421] hover:bg-[#f3f0eb]'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {forceAll
              ? `Đang ôn toàn bộ (${words.length} thẻ) · Về SRS`
              : 'Ôn lại toàn bộ bài này (Bỏ qua lịch hẹn SRS)'}
          </button>

          <SpeechControl
            text={currentWord.h}
            speed={speed}
            onChangeSpeed={onChangeSpeed}
            label="Đọc từ"
            compact={false}
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-[#616b66]">
          <span className="font-mono-num">
            Còn <strong className="text-[#1c2421]">{queue.length}</strong> thẻ
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">
            Hôm nay <strong className="text-[#1f7a63]">{todayLog.n}</strong>/{dailyGoal}
          </span>
        </div>
      </div>

      {/* Thin Daily Progress Line */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e6e2da]">
        <div
          className="h-full rounded-full bg-[#1f7a63] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 3D Flip Card Stage */}
      <div className="perspective-1200">
        <div
          className={`preserve-3d relative w-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            flipped ? 'rotate-y-180' : ''
          }`}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null || !flipped) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (dx > 90) handleCommitRate(2);
            else if (dx < -90) handleCommitRate(0);
          }}
        >
          {/* FRONT FACE */}
          <div
            onClick={() => {
              if (!flipped) handleFlip();
            }}
            className={`backface-hidden rounded-2xl border border-[#e6e2da] bg-white p-6 md:p-10 shadow-xs flex flex-col justify-between min-h-[340px] md:min-h-[380px] cursor-pointer select-none ${
              flipped ? 'pointer-events-none' : ''
            }`}
          >
            <div className="flex items-center justify-between text-xs text-[#616b66]">
              <span>
                Bài {currentWord.l}
                {currentWord.pos ? ` · ${currentWord.pos}` : ''}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenWordDetail(currentWord);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e6e2da] bg-[#faf9f7] px-2.5 py-1 text-xs font-medium text-[#1f7a63] hover:bg-[#e3f1ec]"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Chiết tự
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFav(currentWord);
                  }}
                  aria-label={p.fav ? 'Bỏ đánh dấu yêu thích' : 'Đánh dấu từ khó / yêu thích'}
                  className="rounded-lg p-1.5 transition-colors hover:bg-[#f3f0eb]"
                >
                  <Star
                    className={`h-4 w-4 ${
                      p.fav ? 'fill-[#d96b43] text-[#d96b43]' : 'text-[#9aa39e]'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="my-auto py-6 text-center">
              {reverseDir ? (
                <div className="space-y-3">
                  <p className="font-display text-3xl md:text-4xl font-semibold text-[#1c2421]">
                    {currentWord.vi}
                  </p>
                  <p className="text-sm text-[#616b66]">
                    {currentWord.pos} · {currentWord.en}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="font-zh text-6xl md:text-7xl font-semibold tracking-wide text-[#1c2421]">
                    {currentWord.h}
                  </p>
                  <div className="flex justify-center">
                    <SpeechControl
                      text={currentWord.h}
                      speed={speed}
                      onChangeSpeed={onChangeSpeed}
                      label="Phát âm"
                      compact
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-[#616b66]">
              <RotateCw className="h-3.5 w-3.5" />
              <span>Chạm thẻ hoặc nhấn Space để lật</span>
            </div>
          </div>

          {/* BACK FACE */}
          <div
            className={`backface-hidden rotate-y-180 rounded-2xl border border-[#e6e2da] bg-white p-6 md:p-8 shadow-xs flex flex-col justify-between min-h-[340px] md:min-h-[380px] ${
              flipped ? 'relative -mt-[340px] md:-mt-[380px]' : 'absolute inset-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#f0ede6]">
              <div className="text-xs text-[#616b66]">
                Bài {currentWord.l}
                {currentWord.pos ? ` · ${currentWord.pos}` : ''}
                {p.n ? ` · Ôn ${p.n} lần` : ' · Từ mới'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenWordDetail(currentWord)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#1f7a63]/35 bg-[#e3f1ec]/60 px-3 py-1.5 text-xs font-semibold text-[#1f7a63] transition-colors hover:bg-[#e3f1ec] min-h-[34px] whitespace-nowrap"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Chiết tự chuyên sâu
                </button>
                <button
                  type="button"
                  onClick={() => setShowWriter((s) => !s)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors min-h-[34px] whitespace-nowrap ${
                    showWriter
                      ? 'border-[#d96b43] bg-[#fbece6] text-[#d96b43]'
                      : 'border-[#e6e2da] bg-[#faf9f7] text-[#1c2421] hover:bg-[#f3f0eb]'
                  }`}
                >
                  <PenTool className="h-3.5 w-3.5" />
                  {showWriter ? 'Ẩn tập viết' : 'Tập viết nét'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFav(currentWord)}
                  aria-label="Đánh dấu yêu thích"
                  className="rounded-lg p-1.5 transition-colors hover:bg-[#f3f0eb]"
                >
                  <Star
                    className={`h-4 w-4 ${
                      p.fav ? 'fill-[#d96b43] text-[#d96b43]' : 'text-[#9aa39e]'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="py-4 space-y-4">
              {/* Main Word Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenWordDetail(currentWord)}
                      className="font-zh text-4xl md:text-5xl font-semibold text-[#1c2421] hover:text-[#1f7a63] transition-colors text-left"
                      title="Bấm để xem Từ điển Chiết tự chuyên sâu"
                    >
                      {currentWord.h}
                    </button>
                    <span className="text-xl md:text-2xl font-medium text-[#1f7a63]">
                      {currentWord.py}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-xl font-semibold text-[#1c2421]">
                    {currentWord.vi}
                  </p>
                  <p className="text-xs text-[#616b66] mt-0.5">
                    Hán Việt: <span className="text-[#1c2421] font-medium">{currentWord.hv || '—'}</span>
                    {currentWord.en ? ` · ${currentWord.en}` : ''}
                  </p>
                </div>

                <SpeechControl
                  text={currentWord.h}
                  speed={speed}
                  onChangeSpeed={onChangeSpeed}
                  label="Nghe từ"
                />
              </div>

              {/* Inline Stroke Writer Drawer */}
              {showWriter && (
                <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[#1c2421]">
                      Tập viết chữ Hán: {currentWord.h}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowWriter(false)}
                      className="rounded-lg p-1 text-[#616b66] hover:bg-white"
                      aria-label="Đóng tập viết"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <HanziCanvas hanzi={currentWord.h} size={132} />
                </div>
              )}

              {/* Example Sentence Box */}
              {activeExample && (
                <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#1f7a63]">
                      Câu ví dụ {examples.length > 1 ? `(${(exampleIdx % examples.length) + 1}/${examples.length})` : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {examples.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExampleIdx((i) => i + 1)}
                          className="rounded-lg border border-[#e6e2da] bg-white px-2 py-1 text-xs text-[#616b66] hover:text-[#1c2421]"
                        >
                          Đổi câu
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => speakZh(activeExClean, speed)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#e6e2da] bg-white px-2.5 py-1 text-xs font-medium text-[#1f7a63] hover:bg-[#e3f1ec]/50"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        Đọc câu ({speed}x)
                      </button>
                    </div>
                  </div>
                  <p className="font-zh text-lg text-[#1c2421]">{activeExClean}</p>
                  <p className="text-sm text-[#616b66]">{activeExample[1]}</p>
                </div>
              )}

              {/* Radical & Mnemonic Boxes */}
              {(currentWord.rad || currentWord.mn) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentWord.rad && (
                    <div className="rounded-xl border border-[#e6e2da] bg-[#e3f1ec]/35 p-3 text-sm">
                      <p className="text-xs font-semibold text-[#1f7a63] mb-1">
                        Chiết tự bộ thủ
                      </p>
                      <p className="text-[#1c2421] leading-relaxed">{currentWord.rad}</p>
                    </div>
                  )}
                  {currentWord.mn && (
                    <div className="rounded-xl border border-[#e6e2da] bg-[#fbece6]/45 p-3 text-sm">
                      <p className="text-xs font-semibold text-[#d96b43] mb-1">
                        Mẹo nhớ nhanh
                      </p>
                      <p className="text-[#1c2421] leading-relaxed">{currentWord.mn}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-[#616b66]">
              <button
                type="button"
                onClick={handleFlip}
                className="inline-flex items-center gap-1 hover:text-[#1c2421]"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Lật lại mặt trước (Space)
              </button>
              <span className="hidden sm:inline">Phím tắt: Space lật · 1/2/3 chấm thẻ · R đọc lại</span>
            </div>
          </div>
        </div>
      </div>

      {/* SRS Rating Buttons */}
      {flipped ? (
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleCommitRate(0)}
            className="flex flex-col items-center justify-center rounded-2xl border border-[#e8c5c1] bg-[#fdf2f1] px-3 py-3.5 text-[#b8352b] transition-colors hover:bg-[#fae2df] min-h-[56px]"
          >
            <span className="font-display text-base font-semibold">1 · Quên</span>
            <span className="text-xs opacity-80">Ôn lại sau 5 phút</span>
          </button>

          <button
            type="button"
            onClick={() => handleCommitRate(1)}
            className="flex flex-col items-center justify-center rounded-2xl border border-[#ead9b7] bg-[#fbf5e8] px-3 py-3.5 text-[#8a5d0e] transition-colors hover:bg-[#f6ebd3] min-h-[56px]"
          >
            <span className="font-display text-base font-semibold">2 · Mơ hồ</span>
            <span className="text-xs opacity-80">Ôn lại sau 10 phút</span>
          </button>

          <button
            type="button"
            onClick={() => handleCommitRate(2)}
            className="flex flex-col items-center justify-center rounded-2xl bg-[#1f7a63] px-3 py-3.5 text-white transition-colors hover:bg-[#186250] min-h-[56px]"
          >
            <span className="font-display text-base font-semibold">3 · Nhớ</span>
            <span className="text-xs opacity-90">Ôn sau {nextIntervalDays} ngày</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleFlip}
          className="w-full rounded-2xl bg-[#1f7a63] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#186250] min-h-[48px]"
        >
          Lật thẻ xem đáp án (Space)
        </button>
      )}
    </div>
  );
}
