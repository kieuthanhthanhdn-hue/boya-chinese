import { useState } from 'react';
import { Sparkles, Loader2, X, Plus } from 'lucide-react';
import { enrichWordExamples, makeWordId } from '../data/boyaSeed';
import type { DeepWordAnalysis, Word } from '../types';
import { aiAnalyzeWordDetail } from '../utils/geminiClient';
import { getCachedWordAnalysis, setCachedWordAnalysis } from '../utils/pinyin';

interface QuickAddWordModalProps {
  lessons: string[];
  defaultLesson: string;
  onSaveAndOpenDetail: (word: Word, analysis: DeepWordAnalysis) => void;
  onClose: () => void;
}

const COLLECTED_LESSON = 'Từ sưu tầm';

export function QuickAddWordModal({
  lessons,
  defaultLesson,
  onSaveAndOpenDetail,
  onClose,
}: QuickAddWordModalProps) {
  const initialLesson =
    defaultLesson && defaultLesson !== 'all' && defaultLesson !== 'wrong'
      ? defaultLesson
      : COLLECTED_LESSON;

  const [hanziInput, setHanziInput] = useState('');
  const [lesson, setLesson] = useState(initialLesson);
  const [customLesson, setCustomLesson] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const availableLessons = Array.from(new Set([COLLECTED_LESSON, ...lessons]));

  const effectiveLesson =
    lesson === '__custom__' ? customLesson.trim() || COLLECTED_LESSON : lesson;

  const handleAnalyzeAndSave = async () => {
    const cleanHanzi = hanziInput.trim();
    if (!cleanHanzi) {
      setErrorMsg('Hãy nhập hoặc dán từ / cụm từ tiếng Trung cần thêm.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      let analysis = getCachedWordAnalysis(cleanHanzi);

      if (!analysis) {
        analysis = await aiAnalyzeWordDetail({ hanzi: cleanHanzi });
        setCachedWordAnalysis(cleanHanzi, analysis);
      }

      const finalLesson = effectiveLesson || COLLECTED_LESSON;
      const radSummary = analysis.chars?.length
        ? analysis.chars
            .map((c) => `${c.char} = bộ ${c.radical} (${c.radicalMeaning})`)
            .join('; ')
        : '';

      const constructed: Word = enrichWordExamples({
        id: makeWordId(finalLesson, analysis.hanzi || cleanHanzi),
        l: finalLesson,
        h: (analysis.hanzi || cleanHanzi).trim(),
        py: analysis.pinyin || '',
        pos: analysis.pos || '',
        hv: analysis.hanViet || '',
        en: analysis.english || '',
        vi: analysis.vietnamese || '',
        rad: radSummary,
        mn: analysis.mnemonicStory || '',
        ex: analysis.exampleZhSpaced || '',
        exvi: analysis.exampleVi || '',
        exs:
          analysis.exampleZhSpaced && analysis.exampleVi
            ? [[analysis.exampleZhSpaced, analysis.exampleVi]]
            : [],
      });

      onSaveAndOpenDetail(constructed, analysis);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể phân tích từ vựng lúc này.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 sm:p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-[#e6e2da] bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0ede6] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fbece6] text-[#d96b43]">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-[#1c2421]">
                Thêm nhanh & Phân tích Chiết tự AI
              </h2>
              <p className="text-xs text-[#616b66]">
                AI tự động phân tích bộ thủ, Lục thư, bút thuận và từ liên quan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thêm từ"
            className="rounded-xl p-1.5 text-[#616b66] hover:bg-[#f3f0eb] hover:text-[#1c2421]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4 pb-safe">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1c2421]">
              Từ hoặc cụm từ tiếng Trung
            </label>
            <input
              type="text"
              lang="zh-CN"
              autoFocus
              value={hanziInput}
              onChange={(e) => setHanziInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  void handleAnalyzeAndSave();
                }
              }}
              placeholder="Ví dụ: 知道, 教室, 了解, 图书馆..."
              className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-4 py-3 font-zh text-2xl text-[#1c2421] focus:border-[#1f7a63] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1c2421]">
              Lưu vào bài học
            </label>
            <select
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2.5 text-sm text-[#1c2421] focus:border-[#1f7a63] focus:bg-white focus:outline-none"
            >
              {availableLessons.map((l) => (
                <option key={l} value={l}>
                  {l === COLLECTED_LESSON ? COLLECTED_LESSON : `Bài ${l}`}
                </option>
              ))}
              <option value="__custom__">+ Nhập tên bài mới...</option>
            </select>
          </div>

          {lesson === '__custom__' && (
            <input
              type="text"
              value={customLesson}
              onChange={(e) => setCustomLesson(e.target.value)}
              placeholder="Ví dụ: 6 hoặc HSK1"
              className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2.5 text-sm text-[#1c2421] focus:border-[#1f7a63] focus:outline-none"
            />
          )}

          {errorMsg && (
            <p className="rounded-xl border border-[#e8c5c1] bg-[#fdf2f1] px-3.5 py-2.5 text-xs text-[#b8352b]">
              {errorMsg}
            </p>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleAnalyzeAndSave}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#d96b43] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#c25b36] disabled:opacity-60 min-h-[48px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? 'Đang phân tích chuyên sâu & lưu...' : 'Lưu & AI phân tích chuyên sâu'}
          </button>
        </div>
      </div>
    </div>
  );
}
