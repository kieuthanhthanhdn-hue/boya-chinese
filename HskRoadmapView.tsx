import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { getWordProgress } from '../data/boyaSeed';
import type { HskQuestion, TestRecord, Word, WordProgress } from '../types';
import { mkq, shuf, wordStatus } from '../utils/practice';
import { speakZh, type SpeechSpeed } from '../utils/speech';
import { SpeechControl } from './SpeechControl';

interface HskRoadmapViewProps {
  words: Word[];
  allWords: Word[];
  lessonFilter: string;
  progress: Record<string, WordProgress>;
  tests: TestRecord[];
  speed: SpeechSpeed;
  onChangeSpeed: (s: SpeechSpeed) => void;
  onRecord: (word: Word, ok: boolean) => void;
  onSaveTest: (pct: number, n: number) => void;
  onJumpToLesson: (lesson: string) => void;
  onStartSpeedDrill: (lessonTitle: string, lessonWords: Word[]) => void;
  onUrgentReview: (wrongWords: Word[]) => void;
}

interface ExamState {
  qs: HskQuestion[];
  idx: number;
  ans: (number | null)[];
  endAt: number;
  done: boolean;
}

export function HskRoadmapView({
  words,
  allWords,
  lessonFilter,
  progress,
  tests,
  speed,
  onChangeSpeed,
  onRecord,
  onSaveTest,
  onJumpToLesson,
  onStartSpeedDrill,
  onUrgentReview,
}: HskRoadmapViewProps) {
  const [exam, setExam] = useState<ExamState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [examScope, setExamScope] = useState<'scoped' | 'all'>(() =>
    lessonFilter === 'all' ? 'all' : 'scoped'
  );
  const [urgentAdded, setUrgentAdded] = useState(false);

  useEffect(() => {
    setExamScope(lessonFilter === 'all' ? 'all' : 'scoped');
  }, [lessonFilter]);

  const examPool = useMemo(
    () => (examScope === 'all' ? allWords : words),
    [examScope, allWords, words]
  );

  const startExam = (count: number) => {
    const p = shuf(examPool);
    if (p.length < 2) return;
    const listenCut = Math.ceil(count / 3);
    const readCut = Math.ceil((count * 2) / 3);
    const qs: HskQuestion[] = [];
    for (let i = 0; i < count; i++) {
      const targetWord = p[i % p.length];
      let qType: string;
      if (i < listenCut) {
        qType = i % 2 === 0 ? 'L1' : 'L2';
      } else if (i < readCut) {
        qType = ['R1', 'R2', 'R4', 'R5'][(i - listenCut) % 4];
      } else {
        qType = (i - readCut) % 2 === 0 ? 'W1' : 'W2';
      }
      qs.push(mkq(targetWord, qType, allWords));
    }
    const endAt = Date.now() + count * 50000;
    setSecondsLeft(count * 50);
    setUrgentAdded(false);
    setExam({
      qs,
      idx: 0,
      ans: Array(count).fill(null),
      endAt,
      done: false,
    });
  };

  const finishExam = (currentExam: ExamState) => {
    if (currentExam.done) return;
    let correct = 0;
    currentExam.qs.forEach((q, i) => {
      const ok = currentExam.ans[i] === q.a;
      if (ok) correct += 1;
      onRecord(q.w, ok);
    });
    const pct = Math.round((100 * correct) / currentExam.qs.length);
    onSaveTest(pct, currentExam.qs.length);
    setExam({ ...currentExam, done: true });
  };

  // Timer tick
  useEffect(() => {
    if (!exam || exam.done) return;
    const id = window.setInterval(() => {
      const rem = Math.max(0, Math.round((exam.endAt - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem <= 0) {
        window.clearInterval(id);
        finishExam(exam);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [exam]);

  // Speak question audio automatically when switching question
  useEffect(() => {
    if (!exam || exam.done) return;
    const q = exam.qs[exam.idx];
    if (q?.say) {
      speakZh(q.say, speed);
    }
  }, [exam?.idx, exam?.done]);

  // Boya lesson mastery breakdown
  const lessonRoadmap = useMemo(() => {
    const groups = new Map<
      string,
      { lesson: string; total: number; mastered: number; learning: number; fresh: number; wrong: number }
    >();

    allWords.forEach((w) => {
      const entry = groups.get(w.l) || {
        lesson: w.l,
        total: 0,
        mastered: 0,
        learning: 0,
        fresh: 0,
        wrong: 0,
      };
      entry.total += 1;
      const p = getWordProgress(progress, w);
      const st = wordStatus(p);
      if (st === 'Thuộc') entry.mastered += 1;
      else if (st === 'Đang học') entry.learning += 1;
      else if (st === 'Chưa nhớ') entry.wrong += 1;
      else entry.fresh += 1;
      groups.set(w.l, entry);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const na = Number(a.lesson);
      const nb = Number(b.lesson);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.lesson.localeCompare(b.lesson);
    });
  }, [allWords, progress]);

  // Active Exam Screen
  if (exam && !exam.done) {
    const q = exam.qs[exam.idx];
    const isLast = exam.idx === exam.qs.length - 1;
    const mins = Math.floor(secondsLeft / 60);
    const secs = String(secondsLeft % 60).padStart(2, '0');

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-[#e6e2da] bg-white px-4 py-3 text-sm">
          <span className="font-medium text-[#1c2421]">
            {q.sec} · Câu <span className="font-mono-num">{exam.idx + 1}/{exam.qs.length}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono-num font-semibold text-[#d96b43]">
            <Clock className="h-4 w-4" />
            {mins}:{secs}
          </span>
        </div>

        <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 md:p-8 text-center space-y-4">
          <p className="text-xs font-medium text-[#616b66]">{q.promptTitle}</p>

          {q.say && (
            <div className="flex justify-center">
              <SpeechControl
                text={q.say}
                speed={speed}
                onChangeSpeed={onChangeSpeed}
                label="Nghe lại"
              />
            </div>
          )}

          {q.promptZh && (
            <p className="font-zh text-3xl md:text-4xl font-semibold text-[#1c2421]">
              {q.promptZh}
            </p>
          )}

          {q.promptSub && (
            <p className="text-lg font-medium text-[#1f7a63]">{q.promptSub}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {q.opts.map((opt, i) => {
            const selected = exam.ans[exam.idx] === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const nextAns = [...exam.ans];
                  nextAns[exam.idx] = i;
                  setExam({ ...exam, ans: nextAns });
                }}
                className={`rounded-2xl border p-4 text-left transition-colors min-h-[54px] ${
                  q.zhOpts ? 'font-zh text-xl' : 'text-base font-medium'
                } ${
                  selected
                    ? 'border-[#1f7a63] bg-[#e3f1ec] text-[#145443] font-semibold'
                    : 'border-[#e6e2da] bg-white text-[#1c2421] hover:bg-[#faf9f7]'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {exam.idx > 0 && (
            <button
              type="button"
              onClick={() => setExam({ ...exam, idx: exam.idx - 1 })}
              className="rounded-xl border border-[#e6e2da] bg-white px-5 py-3 text-sm font-medium text-[#1c2421]"
            >
              Câu trước
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isLast) finishExam(exam);
              else setExam({ ...exam, idx: exam.idx + 1 });
            }}
            className="flex-1 rounded-xl bg-[#1f7a63] py-3 text-sm font-semibold text-white hover:bg-[#186250] min-h-[46px]"
          >
            {isLast ? 'Nộp bài & Chấm điểm' : 'Câu tiếp theo'}
          </button>
        </div>
      </div>
    );
  }

  // Exam Result Screen
  if (exam && exam.done) {
    const secMap: Record<string, [number, number]> = {
      '听力 · Nghe': [0, 0],
      '阅读 · Đọc': [0, 0],
      '书写 · Viết': [0, 0],
    };
    let correct = 0;
    exam.qs.forEach((q, i) => {
      const ok = exam.ans[i] === q.a;
      if (ok) correct += 1;
      if (!secMap[q.sec]) secMap[q.sec] = [0, 0];
      secMap[q.sec][1] += 1;
      if (ok) secMap[q.sec][0] += 1;
    });
    const total = exam.qs.length;
    const pct = Math.round((100 * correct) / total);
    const passed = pct >= 60;
    const wrongItems = exam.qs
      .map((q, i) => ({ q, chosen: exam.ans[i], ok: exam.ans[i] === q.a }))
      .filter((x) => !x.ok);

    const wrongUniqueWords = Array.from(
      new Map(wrongItems.map((x) => [x.q.w.id, x.q.w])).values()
    );

    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 md:p-8 text-center space-y-4">
          <p className="font-mono-num text-5xl font-bold text-[#1c2421]">{pct}%</p>
          <p
            className={`inline-flex items-center gap-1.5 text-base font-semibold ${
              passed ? 'text-[#1f7a63]' : 'text-[#b8352b]'
            }`}
          >
            {passed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {passed ? 'Đạt chuẩn (>= 60%)' : 'Chưa đạt (< 60%)'} · {correct}/{total} câu đúng
          </p>

          {/* 3-Skill Breakdown: Nghe / Đọc / Viết */}
          <div className="grid grid-cols-3 gap-2.5 pt-1 text-left">
            {Object.entries(secMap).map(([sec, [okC, totC]]) => {
              const secPct = totC ? Math.round((100 * okC) / totC) : 0;
              return (
                <div
                  key={sec}
                  className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-3 space-y-1"
                >
                  <p className="text-[11px] font-medium text-[#616b66] truncate">{sec}</p>
                  <p className="font-mono-num text-base font-bold text-[#1c2421]">
                    {okC}/{totC}
                    <span className="ml-1 text-xs font-medium text-[#1f7a63]">
                      ({secPct}%)
                    </span>
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-2.5">
            {wrongUniqueWords.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setUrgentAdded(true);
                  onUrgentReview(wrongUniqueWords);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#d96b43] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#c25b36] min-h-[44px]"
              >
                <AlertCircle className="h-4 w-4" />
                {urgentAdded
                  ? `Đã đưa ${wrongUniqueWords.length} từ vào ôn gấp`
                  : `Đưa ${wrongUniqueWords.length} từ sai vào danh sách ôn gấp`}
              </button>
            )}

            <button
              type="button"
              onClick={() => setExam(null)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1f7a63] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#186250] min-h-[44px]"
            >
              <RotateCcw className="h-4 w-4" />
              Quay lại phòng thi & lộ trình
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-base font-semibold text-[#1c2421]">
            Xem lại câu sai ({wrongItems.length})
          </h3>
          {wrongItems.length === 0 ? (
            <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 text-center text-sm text-[#1f7a63]">
              Xuất sắc! Bạn đã trả lời đúng toàn bộ các câu hỏi.
            </div>
          ) : (
            wrongItems.map(({ q, chosen }, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-1.5"
              >
                <p className="text-xs text-[#616b66]">{q.sec}</p>
                <p className="font-zh text-lg font-medium text-[#1c2421]">{q.exp}</p>
                <p className="text-xs text-[#616b66]">
                  Bạn chọn:{' '}
                  <span className="text-[#b8352b]">
                    {chosen === null ? '(bỏ trống)' : q.opts[chosen]}
                  </span>{' '}
                  · Đáp án đúng:{' '}
                  <span className="font-semibold text-[#1f7a63]">{q.opts[q.a]}</span>
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Default Lobby: HSK Mock Exam + Boya Lesson Roadmap
  const scopeLabel =
    lessonFilter === 'all'
      ? 'Tất cả các bài'
      : lessonFilter === 'wrong'
        ? 'Nhóm từ hay sai'
        : lessonFilter === 'Từ sưu tầm'
          ? 'Từ sưu tầm'
          : `Bài ${lessonFilter}`;

  return (
    <div className="space-y-6">
      {/* HSK Mock Exam Card */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 md:p-8 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#d96b43]">
              <Award className="h-4 w-4" />
              Phòng thi thử chuẩn HSK
            </div>
            <h2 className="font-display text-xl md:text-2xl font-semibold text-[#1c2421]">
              Kiểm tra 3 kỹ năng Nghe (听力) · Đọc (阅读) · Viết (书写)
            </h2>
            <p className="text-sm text-[#616b66] leading-relaxed">
              Có đồng hồ đếm ngược tổng thời gian, tự động nộp bài khi hết giờ. Đạt từ 60% và thống kê chi tiết từng kỹ năng.
            </p>
          </div>
          {tests.length > 0 && (
            <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-4 py-3 text-right">
              <p className="text-xs text-[#616b66]">Lần thi gần nhất</p>
              <p className="font-mono-num text-xl font-bold text-[#1f7a63]">
                {tests[tests.length - 1].pct}%
              </p>
              <p className="text-xs text-[#616b66]">
                {tests[tests.length - 1].n} câu · {tests[tests.length - 1].d}
              </p>
            </div>
          )}
        </div>

        {/* Scope Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-[#616b66]">Phạm vi đề thi:</span>
          <button
            type="button"
            onClick={() => setExamScope('scoped')}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              examScope === 'scoped'
                ? 'bg-[#1f7a63] text-white'
                : 'border border-[#e6e2da] bg-[#faf9f7] text-[#1c2421] hover:bg-[#f3f0eb]'
            }`}
          >
            Chỉ thi {scopeLabel} ({words.length} từ)
          </button>
          <button
            type="button"
            onClick={() => setExamScope('all')}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              examScope === 'all'
                ? 'bg-[#1f7a63] text-white'
                : 'border border-[#e6e2da] bg-[#faf9f7] text-[#1c2421] hover:bg-[#f3f0eb]'
            }`}
          >
            Tổng hợp tất cả các bài ({allWords.length} từ)
          </button>
        </div>

        {examPool.length < 2 ? (
          <p className="text-sm text-[#b8352b]">
            Cần ít nhất 2 từ trong phạm vi thi đã chọn để bắt đầu bài thi.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {[10, 20, 30].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => startExam(n)}
                className="flex items-center justify-between rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-5 py-4 text-left transition-colors hover:border-[#1f7a63] hover:bg-[#e3f1ec]/40"
              >
                <div>
                  <p className="font-display text-base font-semibold text-[#1c2421]">
                    Đề {n} câu
                  </p>
                  <p className="text-xs text-[#616b66] font-mono-num">
                    Thời gian ~{Math.ceil((n * 50) / 60)} phút
                  </p>
                </div>
                <Play className="h-4 w-4 text-[#1f7a63]" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Boya Lesson Roadmap */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#1c2421]">
              Lộ trình từng bài học Boya
            </h3>
            <p className="text-xs text-[#616b66]">
              Kiểm tra phản xạ 3 phút hoặc ôn lại thẻ SRS theo từng bài học
            </p>
          </div>
          <span className="font-mono-num text-xs text-[#616b66]">
            {lessonRoadmap.length} bài học
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lessonRoadmap.map((item) => {
            const masteryPct = Math.round((100 * item.mastered) / Math.max(1, item.total));
            const lessonWords = allWords.filter((w) => w.l === item.lesson);
            const displayTitle =
              item.lesson === 'Từ sưu tầm' ? 'Từ sưu tầm' : `Bài ${item.lesson}`;
            return (
              <div
                key={item.lesson}
                className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-base font-semibold text-[#1c2421]">
                      {displayTitle}
                    </p>
                    <p className="text-xs text-[#616b66] font-mono-num mt-0.5">
                      {item.total} từ · Thuộc {item.mastered} · Đang học {item.learning} · Mới {item.fresh}
                      {item.wrong > 0 ? ` · Hay sai ${item.wrong}` : ''}
                    </p>
                  </div>
                  <span className="font-mono-num text-sm font-semibold text-[#1f7a63]">
                    {masteryPct}%
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6e2da]">
                  <div
                    className="h-full rounded-full bg-[#1f7a63] transition-all"
                    style={{ width: `${masteryPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onStartSpeedDrill(displayTitle, lessonWords)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#d96b43]/40 bg-[#fbece6]/60 px-3 py-1.5 text-xs font-semibold text-[#d96b43] hover:bg-[#fbece6] whitespace-nowrap"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Test nhanh 3 phút
                  </button>

                  <button
                    type="button"
                    onClick={() => onJumpToLesson(item.lesson)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1f7a63] hover:underline whitespace-nowrap"
                  >
                    Ôn thẻ {displayTitle}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
