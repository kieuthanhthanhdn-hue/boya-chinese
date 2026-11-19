import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Volume2,
  Loader2,
  CheckCircle2,
  XCircle,
  BookMarked,
  RotateCcw,
  Link2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DEFAULT_GRAMMAR_SUMMARY, GRAMMAR_STORAGE_KEY } from '../data/boyaSeed';
import type { GrammarLessonSummary, Word } from '../types';
import { buildCollocationCatalog } from '../utils/collocations';
import { aiGrammarSummary } from '../utils/geminiClient';
import { speakZh, type SpeechSpeed } from '../utils/speech';

interface GrammarViewProps {
  allWords: Word[];
  lessonFilter: string;
  speed: SpeechSpeed;
  onChangeSpeed: (s: SpeechSpeed) => void;
}

function loadSavedSummaries(): Record<string, GrammarLessonSummary> {
  try {
    const raw = localStorage.getItem(GRAMMAR_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_GRAMMAR_SUMMARY, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_GRAMMAR_SUMMARY };
}

export function GrammarView({
  allWords,
  lessonFilter,
  speed,
  onChangeSpeed,
}: GrammarViewProps) {
  const lessons = useMemo(
    () => Array.from(new Set(allWords.map((w) => w.l))),
    [allWords]
  );

  const [selectedLesson, setSelectedLesson] = useState<string>(() => {
    if (lessonFilter !== 'all' && lessonFilter !== 'wrong') return lessonFilter;
    return lessons[0] || '4';
  });

  useEffect(() => {
    if (lessonFilter !== 'all' && lessonFilter !== 'wrong') {
      setSelectedLesson(lessonFilter);
    }
  }, [lessonFilter]);

  const [summaries, setSummaries] =
    useState<Record<string, GrammarLessonSummary>>(loadSavedSummaries);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 5-question quiz answers for current lesson
  const [answers, setAnswers] = useState<Record<number, number>>({});

  // Collocation & Measure-word lookup card state (Pinyin hidden by default)
  const [collocScopeAll, setCollocScopeAll] = useState(false);
  const [revealedPinyinIds, setRevealedPinyinIds] = useState<Record<string, boolean>>({});

  const currentSummary = summaries[selectedLesson] || null;
  const lessonWords = useMemo(
    () => allWords.filter((w) => w.l === selectedLesson),
    [allWords, selectedLesson]
  );

  const collocationCatalog = useMemo(
    () => buildCollocationCatalog(allWords, collocScopeAll ? allWords : lessonWords),
    [allWords, lessonWords, collocScopeAll]
  );

  const toggleCollocPinyin = (id: string) => {
    setRevealedPinyinIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGenerateGrammar = async () => {
    if (!lessonWords.length || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await aiGrammarSummary({
        lessonLabel: `Bài ${selectedLesson}`,
        vocab: lessonWords.map((w) => ({
          h: w.h,
          py: w.py,
          vi: w.vi,
          pos: w.pos,
        })),
      });
      const next = { ...summaries, [selectedLesson]: data };
      setSummaries(next);
      setAnswers({});
      try {
        localStorage.setItem(GRAMMAR_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể tạo tóm tắt ngữ pháp.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#1c2421]">
            <BookMarked className="h-4 w-4 text-[#1f7a63]" />
            <span>Sổ tay Ngữ pháp Boya</span>
          </div>

          <select
            value={selectedLesson}
            onChange={(e) => {
              setSelectedLesson(e.target.value);
              setAnswers({});
              setErrorMsg(null);
            }}
            className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2 text-sm font-medium text-[#1c2421] focus:border-[#1f7a63] focus:outline-none"
          >
            {lessons.map((l) => (
              <option key={l} value={l}>
                Bài {l} ({allWords.filter((w) => w.l === l).length} từ)
              </option>
            ))}
          </select>

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

        <button
          type="button"
          disabled={loading || lessonWords.length === 0}
          onClick={handleGenerateGrammar}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d96b43] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c25b36] disabled:opacity-60 min-h-[42px] whitespace-nowrap"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          AI tóm tắt ngữ pháp bài này
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-[#e8c5c1] bg-[#fdf2f1] p-4 text-sm text-[#b8352b]">
          {errorMsg}
        </div>
      )}

      {/* Thẻ tra cứu Cụm từ & Lượng từ (Collocations) */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-base font-display font-semibold text-[#1c2421]">
              <Link2 className="h-4 w-4 text-[#d96b43]" />
              <span>Thẻ tra cứu Cụm từ & Lượng từ (Collocations)</span>
            </div>
            <p className="text-xs text-[#616b66] mt-0.5">
              Tự động gom nhóm bám sát kho từ vựng Boya. Pinyin ẩn mặc định — chạm vào từng thẻ để xem phiên âm và ghi chú.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-[#e6e2da] bg-[#f3f0eb] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCollocScopeAll(false)}
                className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  !collocScopeAll ? 'bg-white text-[#1f7a63] shadow-xs' : 'text-[#616b66]'
                }`}
              >
                Theo Bài {selectedLesson}
              </button>
              <button
                type="button"
                onClick={() => setCollocScopeAll(true)}
                className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  collocScopeAll ? 'bg-white text-[#1f7a63] shadow-xs' : 'text-[#616b66]'
                }`}
              >
                Tất cả kho Boya
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Nhóm 1: Lượng từ + Danh từ */}
          <div className="rounded-2xl border border-[#e6e2da] bg-[#faf9f7] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-[#145443]">
                1. Lượng từ + Danh từ
              </h3>
              <span className="font-mono-num text-xs text-[#616b66]">
                {collocationCatalog.mwNoun.length} cặp
              </span>
            </div>

            <div className="space-y-2">
              {(collocScopeAll
                ? collocationCatalog.mwNoun
                : collocationCatalog.mwNoun.slice(0, 8)
              ).map((item) => {
                const isRevealed = Boolean(revealedPinyinIds[item.id]);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleCollocPinyin(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCollocPinyin(item.id);
                      }
                    }}
                    className="w-full text-left rounded-xl border border-[#e6e2da] bg-white p-3.5 transition-colors hover:border-[#1f7a63]/50 cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-zh text-lg font-semibold text-[#1c2421]">
                            {item.zhFull}
                          </span>
                          <span className="text-xs font-medium text-[#1f7a63]">
                            {item.viFull}
                          </span>
                          {item.inScope && !collocScopeAll && (
                            <span className="rounded bg-[#e3f1ec] px-1.5 py-0.5 text-[10px] font-semibold text-[#145443]">
                              Bài {selectedLesson}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          {isRevealed ? (
                            <span className="font-medium text-[#d96b43] inline-flex items-center gap-1">
                              <EyeOff className="h-3 w-3 shrink-0" />
                              {item.pinyin || '—'}
                            </span>
                          ) : (
                            <span className="text-[#616b66] inline-flex items-center gap-1">
                              <Eye className="h-3 w-3 shrink-0" />
                              Chạm để hiện Pinyin
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakZh(item.zhFull, speed);
                        }}
                        aria-label={`Nghe phát âm ${item.zhFull}`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2 text-xs font-medium text-[#1f7a63] hover:bg-[#e3f1ec] min-h-[40px]"
                      >
                        <Volume2 className="h-4 w-4" />
                        <span>{speed}x</span>
                      </button>
                    </div>
                    {isRevealed && item.explanation && (
                      <p className="text-xs text-[#616b66] pt-1 border-t border-[#f0ede6]">
                        {item.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nhóm 2: Động từ + Tân ngữ */}
          <div className="rounded-2xl border border-[#e6e2da] bg-[#faf9f7] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-[#b84c27]">
                2. Động từ + Tân ngữ
              </h3>
              <span className="font-mono-num text-xs text-[#616b66]">
                {collocationCatalog.verbObj.length} cặp
              </span>
            </div>

            <div className="space-y-2">
              {(collocScopeAll
                ? collocationCatalog.verbObj
                : collocationCatalog.verbObj.slice(0, 8)
              ).map((item) => {
                const isRevealed = Boolean(revealedPinyinIds[item.id]);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleCollocPinyin(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCollocPinyin(item.id);
                      }
                    }}
                    className="w-full text-left rounded-xl border border-[#e6e2da] bg-white p-3.5 transition-colors hover:border-[#d96b43]/50 cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-zh text-lg font-semibold text-[#1c2421]">
                            {item.zhFull}
                          </span>
                          <span className="text-xs font-medium text-[#d96b43]">
                            {item.viFull}
                          </span>
                          {item.inScope && !collocScopeAll && (
                            <span className="rounded bg-[#fbece6] px-1.5 py-0.5 text-[10px] font-semibold text-[#b84c27]">
                              Bài {selectedLesson}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          {isRevealed ? (
                            <span className="font-medium text-[#d96b43] inline-flex items-center gap-1">
                              <EyeOff className="h-3 w-3 shrink-0" />
                              {item.pinyin || '—'}
                            </span>
                          ) : (
                            <span className="text-[#616b66] inline-flex items-center gap-1">
                              <Eye className="h-3 w-3 shrink-0" />
                              Chạm để hiện Pinyin
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakZh(item.zhFull, speed);
                        }}
                        aria-label={`Nghe phát âm ${item.zhFull}`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2 text-xs font-medium text-[#1f7a63] hover:bg-[#e3f1ec] min-h-[40px]"
                      >
                        <Volume2 className="h-4 w-4" />
                        <span>{speed}x</span>
                      </button>
                    </div>
                    {isRevealed && item.explanation && (
                      <p className="text-xs text-[#616b66] pt-1 border-t border-[#f0ede6]">
                        {item.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!currentSummary ? (
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-10 text-center space-y-4">
          <p className="font-display text-lg font-semibold text-[#1c2421]">
            Chưa có tóm tắt ngữ pháp cho Bài {selectedLesson}
          </p>
          <p className="text-sm text-[#616b66] max-w-md mx-auto">
            Bấm nút "AI tóm tắt ngữ pháp bài này" để hệ thống phân tích vốn từ của Bài {selectedLesson} thành công thức cấu trúc, 3 ví dụ kèm phát âm và 5 câu bài tập vận dụng nhanh.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={handleGenerateGrammar}
            className="inline-flex items-center gap-2 rounded-xl bg-[#d96b43] px-5 py-3 text-sm font-semibold text-white hover:bg-[#c25b36]"
          >
            <Sparkles className="h-4 w-4" />
            Tạo sổ tay Bài {selectedLesson}
          </button>
        </div>
      ) : (
        <>
          {/* Grammar Formula Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {currentSummary.grammarPoints.map((pt, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[#e6e2da] bg-white p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-[#1c2421]">
                      {idx + 1}. {pt.title}
                    </h3>
                  </div>

                  {/* Highlighted Formula Box */}
                  <div className="rounded-xl border border-[#1f7a63]/25 bg-[#e3f1ec]/55 px-4 py-2.5">
                    <p className="font-zh text-lg font-semibold text-[#145443] tracking-wide">
                      {pt.formula}
                    </p>
                  </div>

                  <p className="text-sm text-[#616b66] leading-relaxed">
                    {pt.explanation}
                  </p>
                </div>

                {/* 3 Examples with Speaker */}
                <div className="space-y-2 pt-2 border-t border-[#f0ede6]">
                  <p className="text-xs font-semibold text-[#616b66]">
                    Ví dụ minh họa
                  </p>
                  {pt.examples.slice(0, 3).map((ex, eIdx) => (
                    <div
                      key={eIdx}
                      className="flex items-start justify-between gap-2.5 rounded-xl bg-[#faf9f7] border border-[#e6e2da] p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-zh text-base font-medium text-[#1c2421]">
                          {ex.zh}
                        </p>
                        <p className="text-xs font-medium text-[#d96b43] mt-0.5">
                          {ex.py}
                        </p>
                        <p className="text-xs text-[#616b66] mt-0.5">{ex.vi}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => speakZh(ex.zh, speed)}
                        className="shrink-0 rounded-lg border border-[#e6e2da] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1f7a63] hover:bg-[#e3f1ec]/50"
                        title={`Nghe ví dụ (${speed}x)`}
                      >
                        <Volume2 className="h-3.5 w-3.5 inline mr-1" />
                        {speed}x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 5 Quick Application Exercises */}
          <div className="rounded-2xl border border-[#e6e2da] bg-white p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#1c2421]">
                  Bài tập vận dụng nhanh ({currentSummary.exercises.length} câu)
                </h3>
                <p className="text-xs text-[#616b66]">
                  Chạm đáp án để kiểm tra ngay kiến thức ngữ pháp Bài {selectedLesson}
                </p>
              </div>
              {Object.keys(answers).length > 0 && (
                <button
                  type="button"
                  onClick={() => setAnswers({})}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-1.5 text-xs font-medium text-[#1c2421] hover:bg-[#f3f0eb]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Làm lại
                </button>
              )}
            </div>

            <div className="space-y-4">
              {currentSummary.exercises.slice(0, 5).map((ex, qIdx) => {
                const chosen = answers[qIdx];
                const isAnswered = chosen !== undefined;
                const isCorrect = chosen === ex.correctIndex;

                return (
                  <div
                    key={qIdx}
                    className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[#1c2421]">
                        <span className="font-mono-num font-semibold text-[#1f7a63] mr-1.5">
                          Câu {qIdx + 1}:
                        </span>
                        {ex.question}
                      </p>
                      <button
                        type="button"
                        onClick={() => speakZh(ex.promptZh, speed)}
                        className="shrink-0 rounded-lg border border-[#e6e2da] bg-white p-1.5 text-[#1f7a63]"
                        title="Nghe câu mẫu"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="font-zh text-xl font-semibold text-[#1c2421]">
                      {ex.promptZh}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ex.options.map((opt, oIdx) => {
                        let btnStyle =
                          'border-[#e6e2da] bg-white text-[#1c2421] hover:border-[#1f7a63]/50';
                        if (isAnswered) {
                          if (oIdx === ex.correctIndex) {
                            btnStyle =
                              'border-[#1f7a63] bg-[#e3f1ec] text-[#145443] font-semibold';
                          } else if (oIdx === chosen) {
                            btnStyle =
                              'border-[#b8352b] bg-[#fdf2f1] text-[#b8352b]';
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            disabled={isAnswered}
                            onClick={() =>
                              setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))
                            }
                            className={`rounded-xl border px-3.5 py-2.5 text-left font-zh text-base transition-colors min-h-[44px] ${btnStyle}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {isAnswered && (
                      <div
                        className={`flex items-start gap-2 rounded-xl p-3 text-xs ${
                          isCorrect
                            ? 'bg-[#e3f1ec]/70 text-[#145443]'
                            : 'bg-[#fdf2f1] text-[#b8352b]'
                        }`}
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        )}
                        <span>{ex.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
