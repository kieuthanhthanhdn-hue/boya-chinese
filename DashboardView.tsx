import { useMemo } from 'react';
import {
  Play,
  Flame,
  AlertCircle,
  Clock,
  BookOpen,
  CheckCircle2,
  Volume2,
  Award,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { IV, getWordProgress } from '../data/boyaSeed';
import type { DayLog, PersistedData, Word } from '../types';
import { dk, fdt, td, wordStatus } from '../utils/practice';
import { speakZh, type SpeechSpeed } from '../utils/speech';

interface DashboardViewProps {
  data: PersistedData;
  words: Word[];
  speed: SpeechSpeed;
  onChangeSpeed: (s: SpeechSpeed) => void;
  onStartReviewNow: (prioritizeWrongOnly?: boolean) => void;
  onStartSpeedDrill: () => void;
  onOpenHsk: () => void;
  onOpenGrammar: () => void;
}

export function DashboardView({
  data,
  words,
  speed,
  onChangeSpeed,
  onStartReviewNow,
  onStartSpeedDrill,
  onOpenHsk,
  onOpenGrammar,
}: DashboardViewProps) {
  const summary = useMemo(() => {
    const now = Date.now();
    let dueCount = 0;
    let wrongCount = 0;
    let learningCount = 0;
    let masteredCount = 0;

    const wrongList: { word: Word; wrong: number; box: number; due: number }[] = [];

    words.forEach((w) => {
      const p = getWordProgress(data.p, w);
      const st = wordStatus(p);
      const isDue = !p.n || (p.due || 0) <= now;
      if (isDue) dueCount += 1;
      if ((p.wrong || 0) > 0) {
        wrongCount += 1;
        wrongList.push({
          word: w,
          wrong: p.wrong || 0,
          box: p.box || 0,
          due: p.due || 0,
        });
      }
      if (st === 'Đang học') learningCount += 1;
      if (st === 'Thuộc') masteredCount += 1;
    });

    wrongList.sort((a, b) => b.wrong - a.wrong);

    const todayKey = td();
    const todayLog = (data.log[todayKey] as DayLog | undefined) || { n: 0, ok: 0 };
    const dailyGoal = typeof data.log._g === 'number' ? data.log._g : 20;
    const goalPct = Math.min(100, Math.round((100 * todayLog.n) / Math.max(1, dailyGoal)));
    const accuracy = todayLog.n ? Math.round((100 * todayLog.ok) / todayLog.n) : 0;

    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const l = data.log[dk(i)] as DayLog | undefined;
      if (l && l.n > 0) streak += 1;
      else if (i > 0) break;
    }

    const days: { key: string; label: string; n: number; ok: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const k = dk(i);
      const l = (data.log[k] as DayLog | undefined) || { n: 0, ok: 0 };
      days.push({
        key: k,
        label: `${k.slice(8)}/${k.slice(5, 7)}`,
        n: l.n || 0,
        ok: l.ok || 0,
      });
    }
    const maxDay = Math.max(1, ...days.map((d) => d.n));

    return {
      dueCount,
      wrongCount,
      learningCount,
      masteredCount,
      topWrong: wrongList.slice(0, 6),
      todayLog,
      dailyGoal,
      goalPct,
      accuracy,
      streak,
      days,
      maxDay,
    };
  }, [data, words]);

  return (
    <div className="space-y-5">
      {/* Hero Action Banner (Thumb-friendly CTA on mobile) */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-xs text-[#616b66]">
            <span className="inline-flex items-center gap-1 font-semibold text-[#d96b43]">
              <Flame className="h-4 w-4" />
              Chuỗi {summary.streak} ngày
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">
              Hôm nay {summary.todayLog.n}/{summary.dailyGoal} lượt ({summary.accuracy}% đúng)
            </span>
          </div>
          <h2 className="font-display text-xl md:text-2xl font-semibold text-[#1c2421]">
            {summary.dueCount > 0
              ? `Bạn có ${summary.dueCount} từ ưu tiên cần ôn hôm nay`
              : 'Đã hoàn thành toàn bộ thẻ đến hạn hôm nay'}
          </h2>
          <p className="text-sm text-[#616b66]">
            Thuật toán SRS tự động ưu tiên từ đến hạn và từ hay sai, giảm tần suất từ đã thuộc (giãn đến 32 ngày).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onStartReviewNow(false)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1f7a63] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#186250] min-h-[48px] whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            Ôn ngay ({summary.dueCount})
          </button>
          <button
            type="button"
            onClick={onStartSpeedDrill}
            disabled={words.length < 2}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d96b43]/40 bg-[#fbece6] px-4 py-3 text-sm font-semibold text-[#d96b43] transition-colors hover:bg-[#f7ddd2] disabled:opacity-50 min-h-[48px] whitespace-nowrap"
          >
            <Zap className="h-4 w-4" />
            Test nhanh 3 phút
          </button>
          {summary.wrongCount > 0 && (
            <button
              type="button"
              onClick={() => onStartReviewNow(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e8c5c1] bg-[#fdf2f1] px-4 py-3 text-sm font-semibold text-[#b8352b] transition-colors hover:bg-[#fae2df] min-h-[48px] whitespace-nowrap"
            >
              <AlertCircle className="h-4 w-4" />
              Ôn từ hay sai ({summary.wrongCount})
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 md:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#616b66]">
            <span>Cần ôn hôm nay</span>
            <Clock className="h-4 w-4 text-[#d96b43]" />
          </div>
          <p className="font-mono-num text-2xl md:text-3xl font-bold text-[#d96b43]">
            {summary.dueCount}
          </p>
          <p className="text-xs text-[#616b66]">Đến hạn & từ mới</p>
        </div>

        <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 md:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#616b66]">
            <span>Từ hay sai</span>
            <AlertCircle className="h-4 w-4 text-[#b8352b]" />
          </div>
          <p className="font-mono-num text-2xl md:text-3xl font-bold text-[#b8352b]">
            {summary.wrongCount}
          </p>
          <p className="text-xs text-[#616b66]">Tự động tăng tần suất</p>
        </div>

        <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 md:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#616b66]">
            <span>Đang học</span>
            <BookOpen className="h-4 w-4 text-[#8a5d0e]" />
          </div>
          <p className="font-mono-num text-2xl md:text-3xl font-bold text-[#8a5d0e]">
            {summary.learningCount}
          </p>
          <p className="text-xs text-[#616b66]">Box 1 – Box 2</p>
        </div>

        <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 md:p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#616b66]">
            <span>Đã thuộc</span>
            <CheckCircle2 className="h-4 w-4 text-[#1f7a63]" />
          </div>
          <p className="font-mono-num text-2xl md:text-3xl font-bold text-[#1f7a63]">
            {summary.masteredCount}
          </p>
          <p className="text-xs text-[#616b66]">Giãn cách 4–32 ngày</p>
        </div>
      </div>

      {/* Middle Split: 7-day Activity Chart + Top Wrong Words */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 7-Day Chart */}
        <div className="lg:col-span-5 rounded-2xl border border-[#e6e2da] bg-white p-5 md:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-[#1c2421]">
                Nhịp độ 7 ngày qua
              </h3>
              <span className="font-mono-num text-xs font-semibold text-[#1f7a63]">
                Mục tiêu {summary.goalPct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6e2da]">
              <div
                className="h-full rounded-full bg-[#1f7a63] transition-all"
                style={{ width: `${summary.goalPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-end gap-2.5 h-36 pt-4">
            {summary.days.map((d) => {
              const hPx = Math.max(6, Math.round((d.n / summary.maxDay) * 86));
              const isToday = d.key === td();
              return (
                <div
                  key={d.key}
                  className="flex-1 flex flex-col items-center justify-end gap-1.5"
                >
                  <span className="font-mono-num text-xs text-[#616b66]">
                    {d.n}
                  </span>
                  <div
                    className={`w-full max-w-[38px] rounded-t-lg transition-all ${
                      isToday ? 'bg-[#d96b43]' : 'bg-[#1f7a63]/80'
                    }`}
                    style={{ height: `${hPx}px` }}
                  />
                  <span className="font-mono-num text-[11px] text-[#616b66]">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#f0ede6] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenGrammar}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f7a63] hover:underline"
            >
              Mở Sổ tay Ngữ pháp
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenHsk}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#d96b43] hover:underline"
            >
              <Award className="h-3.5 w-3.5" />
              Thi thử HSK
            </button>
          </div>
        </div>

        {/* Top Wrong Words */}
        <div className="lg:col-span-7 rounded-2xl border border-[#e6e2da] bg-white p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-[#1c2421]">
                Top từ hay sai nhất
              </h3>
              <p className="text-xs text-[#616b66]">
                Ghi nhận tự động từ Flashcard, Nghe, Đọc, Dịch, Viết và HSK
              </p>
            </div>
            <div className="inline-flex items-center rounded-xl border border-[#e6e2da] bg-[#f3f0eb] p-0.5">
              <button
                type="button"
                onClick={() => onChangeSpeed(0.7)}
                className={`rounded-lg px-2 py-1 font-mono-num text-xs font-medium ${
                  speed === 0.7 ? 'bg-white text-[#d96b43] shadow-xs' : 'text-[#616b66]'
                }`}
              >
                0.7x
              </button>
              <button
                type="button"
                onClick={() => onChangeSpeed(1.0)}
                className={`rounded-lg px-2 py-1 font-mono-num text-xs font-medium ${
                  speed === 1.0 ? 'bg-white text-[#1f7a63] shadow-xs' : 'text-[#616b66]'
                }`}
              >
                1.0x
              </button>
            </div>
          </div>

          {summary.topWrong.length === 0 ? (
            <div className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-6 text-center text-sm text-[#616b66]">
              Chưa có từ nào bị đánh dấu sai. Tiếp tục giữ vững phong độ!
            </div>
          ) : (
            <div className="divide-y divide-[#f0ede6]">
              {summary.topWrong.map(({ word, wrong, box, due }) => {
                const intervalDays = IV[Math.min(IV.length - 1, box)] || 0;
                const dueLabel =
                  due <= Date.now() ? 'Đến hạn ôn' : `Ôn lại ${fdt(due)}`;
                return (
                  <div
                    key={word.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => speakZh(word.h, speed)}
                        className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-2 text-[#1f7a63] hover:bg-[#e3f1ec] shrink-0"
                        title={`Nghe ${word.h} (${speed}x)`}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-zh text-xl font-semibold text-[#1c2421]">
                            {word.h}
                          </span>
                          <span className="text-sm font-medium text-[#1f7a63]">
                            {word.py}
                          </span>
                          <span className="text-sm text-[#616b66] truncate">
                            · {word.vi}
                          </span>
                        </div>
                        <p className="text-xs text-[#616b66] font-mono-num">
                          Bài {word.l} · Box {box} ({intervalDays} ngày) · {dueLabel}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono-num text-xs font-semibold text-[#b8352b]">
                        Sai {wrong} lần
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
