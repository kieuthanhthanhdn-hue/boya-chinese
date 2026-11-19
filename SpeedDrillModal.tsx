import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Zap,
  Clock,
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import type { Word } from '../types';
import { shuf } from '../utils/practice';
import { speakZh, stopSpeech, type SpeechSpeed } from '../utils/speech';
import { SpeechControl } from './SpeechControl';

interface SpeedDrillModalProps {
  title: string;
  words: Word[];
  allWords: Word[];
  speed: SpeechSpeed;
  onChangeSpeed: (s: SpeechSpeed) => void;
  onRecord: (word: Word, ok: boolean) => void;
  onClose: () => void;
}

interface DrillQuestion {
  w: Word;
  kind: 'meaning' | 'pinyin' | 'audio';
  promptLabel: string;
  promptZh?: string;
  sayText?: string;
  zhOpts?: boolean;
  options: { id: string; label: string }[];
  correctIdx: number;
}

interface DrillAnswerLog {
  w: Word;
  ok: boolean;
  chosenLabel: string;
  correctLabel: string;
  timedOut: boolean;
}

const TOTAL_SECONDS = 180; // 3 minutes
const QUESTION_SECONDS = 10; // 10 seconds per question

function buildDrillQuestion(words: Word[], allWords: Word[], idx: number): DrillQuestion {
  const pool = words.length ? words : allWords;
  const w = pool[Math.floor(Math.random() * pool.length)];
  const kindRoll = idx % 3;
  const kind: DrillQuestion['kind'] =
    kindRoll === 0 ? 'meaning' : kindRoll === 1 ? 'pinyin' : 'audio';

  const distractors = shuf(
    allWords.filter((x) => {
      if (x.id === w.id) return false;
      if (kind === 'meaning') return x.vi !== w.vi;
      if (kind === 'pinyin') return x.py !== w.py;
      return x.h !== w.h;
    })
  ).slice(0, 3);

  const items = shuf([w, ...distractors]);

  if (kind === 'meaning') {
    return {
      w,
      kind,
      promptLabel: 'Nhìn chữ Hán · Chọn nghĩa đúng thật nhanh',
      promptZh: w.h,
      options: items.map((x) => ({ id: x.id, label: x.vi })),
      correctIdx: items.indexOf(w),
    };
  }

  if (kind === 'pinyin') {
    return {
      w,
      kind,
      promptLabel: 'Nhìn chữ Hán · Chọn Pinyin đúng',
      promptZh: w.h,
      options: items.map((x) => ({ id: x.id, label: x.py || x.vi })),
      correctIdx: items.indexOf(w),
    };
  }

  return {
    w,
    kind,
    promptLabel: 'Nghe phát âm · Chọn chữ Hán tương ứng',
    sayText: w.h,
    zhOpts: true,
    options: items.map((x) => ({ id: x.id, label: x.h })),
    correctIdx: items.indexOf(w),
  };
}

export function SpeedDrillModal({
  title,
  words,
  allWords,
  speed,
  onChangeSpeed,
  onRecord,
  onClose,
}: SpeedDrillModalProps) {
  const [totalLeft, setTotalLeft] = useState(TOTAL_SECONDS);
  const [qMsLeft, setQMsLeft] = useState(QUESTION_SECONDS * 1000);
  const [qIndex, setQIndex] = useState(0);
  const [question, setQuestion] = useState<DrillQuestion>(() =>
    buildDrillQuestion(words, allWords, 0)
  );
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [logs, setLogs] = useState<DrillAnswerLog[]>([]);
  const [finished, setFinished] = useState(false);

  const lockedRef = useRef(false);
  const questionStartRef = useRef(Date.now());
  const advanceTimerRef = useRef<number | null>(null);

  const advanceNext = (nextIdx: number) => {
    lockedRef.current = false;
    setPickedIdx(null);
    setQIndex(nextIdx);
    setQuestion(buildDrillQuestion(words, allWords, nextIdx));
    setQMsLeft(QUESTION_SECONDS * 1000);
    questionStartRef.current = Date.now();
  };

  // Auto-play audio for audio questions
  useEffect(() => {
    if (finished) return;
    if (question.sayText) {
      speakZh(question.sayText, speed);
    }
  }, [qIndex, finished, question.sayText, speed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
      stopSpeech();
    };
  }, []);

  // Total 3-minute timer + 10s per-question shrinking bar
  useEffect(() => {
    if (finished) return;

    const totalTimer = window.setInterval(() => {
      setTotalLeft((prev) => {
        if (prev <= 1) {
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const qTimer = window.setInterval(() => {
      if (lockedRef.current) return;
      const elapsed = Date.now() - questionStartRef.current;
      const rem = Math.max(0, QUESTION_SECONDS * 1000 - elapsed);
      setQMsLeft(rem);
      if (rem <= 0) {
        lockedRef.current = true;
        onRecord(question.w, false);
        setLogs((prev) => [
          ...prev,
          {
            w: question.w,
            ok: false,
            chosenLabel: '(hết 10 giây)',
            correctLabel: question.options[question.correctIdx]?.label || '',
            timedOut: true,
          },
        ]);
        advanceTimerRef.current = window.setTimeout(() => {
          advanceNext(qIndex + 1);
        }, 480);
      }
    }, 80);

    return () => {
      window.clearInterval(totalTimer);
      window.clearInterval(qTimer);
    };
  }, [finished, qIndex, question]);

  const handleChoose = (optIdx: number) => {
    if (lockedRef.current || finished) return;
    lockedRef.current = true;
    setPickedIdx(optIdx);

    const ok = optIdx === question.correctIdx;
    onRecord(question.w, ok);
    if (!question.sayText) {
      speakZh(question.w.h, speed);
    }

    setLogs((prev) => [
      ...prev,
      {
        w: question.w,
        ok,
        chosenLabel: question.options[optIdx]?.label || '',
        correctLabel: question.options[question.correctIdx]?.label || '',
        timedOut: false,
      },
    ]);

    advanceTimerRef.current = window.setTimeout(() => {
      advanceNext(qIndex + 1);
    }, 450);
  };

  const handleRestart = () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    lockedRef.current = false;
    setTotalLeft(TOTAL_SECONDS);
    setQMsLeft(QUESTION_SECONDS * 1000);
    setQIndex(0);
    setQuestion(buildDrillQuestion(words, allWords, 0));
    setPickedIdx(null);
    setLogs([]);
    setFinished(false);
    questionStartRef.current = Date.now();
  };

  const stats = useMemo(() => {
    const totalAnswered = logs.length;
    const correctCount = logs.filter((l) => l.ok).length;
    const accuracy = totalAnswered ? Math.round((100 * correctCount) / totalAnswered) : 0;
    const spentSec = Math.max(1, TOTAL_SECONDS - totalLeft);
    const avgSec = totalAnswered ? (spentSec / totalAnswered).toFixed(1) : '0.0';
    const wrongLogs = logs.filter((l) => !l.ok);
    return { totalAnswered, correctCount, accuracy, avgSec, wrongLogs };
  }, [logs, totalLeft]);

  const mins = Math.floor(totalLeft / 60);
  const secs = String(totalLeft % 60).padStart(2, '0');
  const qPct = Math.max(0, Math.min(100, (qMsLeft / (QUESTION_SECONDS * 1000)) * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#e6e2da] bg-[#faf9f7] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#e6e2da] bg-white px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="h-4 w-4 text-[#d96b43] shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-sm sm:text-base font-semibold text-[#1c2421] truncate">
                Phản xạ 3 phút · {title}
              </h2>
              <p className="text-[11px] text-[#616b66] font-mono-num">
                Đã trả lời {stats.totalAnswered} câu · Đúng {stats.correctCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-mono-num text-sm font-bold ${
                totalLeft <= 20
                  ? 'bg-[#fdf2f1] text-[#b8352b]'
                  : 'bg-[#fbece6] text-[#d96b43]'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {mins}:{secs}
            </span>

            {!finished && (
              <button
                type="button"
                onClick={() => setFinished(true)}
                className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-2.5 py-1.5 text-xs font-medium text-[#616b66] hover:text-[#1c2421]"
              >
                Kết thúc
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng kiểm tra nhanh"
              className="rounded-xl p-1.5 text-[#616b66] hover:bg-[#f3f0eb] hover:text-[#1c2421]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {finished ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 text-center space-y-3">
                <p className="text-xs font-semibold text-[#d96b43]">
                  Hoàn thành Speed Drill
                </p>
                <p className="font-mono-num text-4xl sm:text-5xl font-bold text-[#1c2421]">
                  {stats.accuracy}%
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[#616b66] font-mono-num">
                  <span>
                    Đúng <strong className="text-[#1f7a63]">{stats.correctCount}</strong>/{stats.totalAnswered} câu
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Tốc độ <strong className="text-[#1c2421]">{stats.avgSec}s</strong>/câu
                  </span>
                </div>

                <div className="pt-2 flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1f7a63] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#186250] min-h-[44px]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Thi lại 3 phút
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-[#e6e2da] bg-white px-5 py-2.5 text-sm font-medium text-[#1c2421] hover:bg-[#f3f0eb] min-h-[44px]"
                  >
                    Đóng
                  </button>
                </div>
              </div>

              {stats.wrongLogs.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="font-display text-sm font-semibold text-[#1c2421]">
                    Từ phản xạ chậm / chọn nhầm ({stats.wrongLogs.length})
                  </h3>
                  <div className="space-y-2">
                    {stats.wrongLogs.map((item, i) => (
                      <div
                        key={`${item.w.id}_${i}`}
                        className="rounded-xl border border-[#e6e2da] bg-white px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-zh text-xl font-semibold text-[#1c2421]">
                              {item.w.h}
                            </span>
                            <span className="text-xs font-medium text-[#1f7a63]">
                              {item.w.py}
                            </span>
                            <span className="text-xs text-[#616b66]">· {item.w.vi}</span>
                          </div>
                          <p className="text-xs text-[#b8352b] mt-0.5">
                            Đã chọn: {item.chosenLabel} · Đáp án: {item.correctLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => speakZh(item.w.h, speed)}
                          className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-2 text-[#1f7a63] hover:bg-[#e3f1ec] shrink-0"
                          title={`Nghe ${item.w.h}`}
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 10-second Shrinking Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#616b66]">
                  <span>Câu #{qIndex + 1}</span>
                  <span className="font-mono-num font-semibold text-[#d96b43]">
                    {(qMsLeft / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6e2da]">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      qPct < 30 ? 'bg-[#b8352b]' : 'bg-[#d96b43]'
                    }`}
                    style={{ width: `${qPct}%` }}
                  />
                </div>
              </div>

              {/* Prompt Card */}
              <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 sm:p-8 text-center space-y-3">
                <p className="text-xs font-medium text-[#616b66]">
                  {question.promptLabel}
                </p>

                {question.promptZh && (
                  <p className="font-zh text-5xl sm:text-6xl font-semibold text-[#1c2421] py-2">
                    {question.promptZh}
                  </p>
                )}

                {question.sayText && (
                  <div className="py-3 flex justify-center">
                    <SpeechControl
                      text={question.sayText}
                      speed={speed}
                      onChangeSpeed={onChangeSpeed}
                      label="Nghe lại"
                    />
                  </div>
                )}
              </div>

              {/* 4 Big Thumb-Friendly Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {question.options.map((opt, i) => {
                  const isPicked = pickedIdx === i;
                  const isCorrect = i === question.correctIdx;
                  let cls =
                    'border-[#e6e2da] bg-white text-[#1c2421] hover:border-[#1f7a63] hover:bg-[#f3f0eb]/50';
                  if (pickedIdx !== null) {
                    if (isCorrect) {
                      cls = 'border-[#1f7a63] bg-[#e3f1ec] text-[#145443] font-semibold';
                    } else if (isPicked) {
                      cls = 'border-[#b8352b] bg-[#fdf2f1] text-[#b8352b]';
                    } else {
                      cls = 'border-[#e6e2da] bg-white/60 text-[#616b66]';
                    }
                  }

                  return (
                    <button
                      key={`${opt.id}_${i}`}
                      type="button"
                      disabled={pickedIdx !== null}
                      onClick={() => handleChoose(i)}
                      className={`flex items-center justify-between gap-2 rounded-2xl border p-4 text-left transition-colors min-h-[60px] active:scale-[0.98] ${
                        question.zhOpts ? 'font-zh text-2xl' : 'text-base font-medium'
                      } ${cls}`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {pickedIdx !== null && isCorrect && (
                        <CheckCircle2 className="h-5 w-5 text-[#1f7a63] shrink-0" />
                      )}
                      {pickedIdx !== null && isPicked && !isCorrect && (
                        <XCircle className="h-5 w-5 text-[#b8352b] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
