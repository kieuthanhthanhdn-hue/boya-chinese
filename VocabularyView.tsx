import { useMemo, useState } from 'react';
import {
  BookOpen,
  Search,
  Star,
  Volume2,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { getWordProgress } from '../data/boyaSeed';
import type { Word, WordProgress } from '../types';
import { wordStatus } from '../utils/practice';
import { speakZh, type SpeechSpeed } from '../utils/speech';

interface VocabularyViewProps {
  allWords: Word[];
  progress: Record<string, WordProgress>;
  lessonFilter: string;
  onChangeLessonFilter: (lesson: string) => void;
  speed: SpeechSpeed;
  onChangeSpeed: (s: SpeechSpeed) => void;
  onToggleFav: (word: Word) => void;
  onOpenWordDetail: (word: Word) => void;
}

type StatusFilter = 'Tất cả' | 'Mới' | 'Đang học' | 'Thuộc' | 'Chưa nhớ' | 'Yêu thích';

export function VocabularyView({
  allWords,
  progress,
  lessonFilter,
  onChangeLessonFilter,
  speed,
  onChangeSpeed,
  onToggleFav,
  onOpenWordDetail,
}: VocabularyViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Tất cả');
  const [query, setQuery] = useState('');

  const lessons = useMemo(
    () => Array.from(new Set(allWords.map((w) => w.l))),
    [allWords]
  );

  const lessonScoped = useMemo(() => {
    if (lessonFilter === 'all') return allWords;
    if (lessonFilter === 'wrong') {
      return allWords.filter((w) => (getWordProgress(progress, w).wrong || 0) > 0);
    }
    return allWords.filter((w) => w.l === lessonFilter);
  }, [allWords, progress, lessonFilter]);

  const counts = useMemo(() => {
    const map: Record<StatusFilter, number> = {
      'Tất cả': lessonScoped.length,
      Mới: 0,
      'Đang học': 0,
      Thuộc: 0,
      'Chưa nhớ': 0,
      'Yêu thích': 0,
    };
    lessonScoped.forEach((w) => {
      const p = getWordProgress(progress, w);
      const st = wordStatus(p);
      map[st] += 1;
      if (p.fav) map['Yêu thích'] += 1;
    });
    return map;
  }, [lessonScoped, progress]);

  const filteredWords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessonScoped.filter((w) => {
      const p = getWordProgress(progress, w);
      const st = wordStatus(p);
      if (statusFilter === 'Yêu thích') {
        if (!p.fav) return false;
      } else if (statusFilter !== 'Tất cả' && st !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${w.h} ${w.py} ${w.vi} ${w.hv} ${w.rad} ${w.mn} ${w.en}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [lessonScoped, progress, statusFilter, query]);

  const renderStatusBadge = (st: ReturnType<typeof wordStatus>) => {
    if (st === 'Thuộc') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1f7a63]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Thuộc
        </span>
      );
    }
    if (st === 'Đang học') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8a5d0e]">
          <Clock className="h-3.5 w-3.5" />
          Đang học
        </span>
      );
    }
    if (st === 'Chưa nhớ') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#b8352b]">
          <AlertCircle className="h-3.5 w-3.5" />
          Hay sai
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#616b66]">
        <Sparkles className="h-3.5 w-3.5" />
        Mới
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter & Search Toolbar */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#616b66]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm chữ Hán, pinyin, nghĩa Việt, bộ thủ (讠 氵 口 木...)"
              className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] pl-10 pr-9 py-2.5 text-sm text-[#1c2421] placeholder:text-[#8c948f] focus:border-[#1f7a63] focus:bg-white focus:outline-none min-h-[42px]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#616b66] hover:text-[#1c2421]"
                aria-label="Xóa tìm kiếm"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={lessonFilter}
              onChange={(e) => onChangeLessonFilter(e.target.value)}
              className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2.5 text-sm font-medium text-[#1c2421] focus:border-[#1f7a63] focus:outline-none min-h-[42px]"
              aria-label="Lọc theo bài học"
            >
              <option value="all">Tất cả bài ({allWords.length})</option>
              {lessons.map((l) => (
                <option key={l} value={l}>
                  Bài {l}
                </option>
              ))}
              <option value="wrong">Từ hay sai</option>
            </select>

            <div className="hidden sm:flex items-center rounded-xl border border-[#e6e2da] bg-[#f3f0eb] p-0.5">
              <button
                type="button"
                onClick={() => onChangeSpeed(0.7)}
                className={`rounded-lg px-2.5 py-1.5 font-mono-num text-xs font-medium ${
                  speed === 0.7 ? 'bg-white text-[#d96b43] shadow-xs' : 'text-[#616b66]'
                }`}
              >
                0.7x
              </button>
              <button
                type="button"
                onClick={() => onChangeSpeed(1.0)}
                className={`rounded-lg px-2.5 py-1.5 font-mono-num text-xs font-medium ${
                  speed === 1.0 ? 'bg-white text-[#1f7a63] shadow-xs' : 'text-[#616b66]'
                }`}
              >
                1.0x
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(
            ['Tất cả', 'Mới', 'Đang học', 'Thuộc', 'Chưa nhớ', 'Yêu thích'] as StatusFilter[]
          ).map((st) => {
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                  active
                    ? 'bg-[#1f7a63] text-white'
                    : 'bg-[#f3f0eb] text-[#616b66] hover:text-[#1c2421]'
                }`}
              >
                {st === 'Chưa nhớ' ? 'Hay sai' : st}{' '}
                <span className="font-mono-num opacity-80">({counts[st]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3-column Desktop / 1-column Mobile Grid */}
      {filteredWords.length === 0 ? (
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-[#9aa39e]" />
          <p className="mt-3 font-display text-base font-semibold text-[#1c2421]">
            Không tìm thấy từ vựng phù hợp
          </p>
          <p className="mt-1 text-sm text-[#616b66]">
            Thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredWords.map((w) => {
            const p = getWordProgress(progress, w);
            const st = wordStatus(p);
            return (
              <div
                key={w.id}
                onClick={() => onOpenWordDetail(w)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenWordDetail(w);
                  }
                }}
                className="group rounded-2xl border border-[#e6e2da] bg-white p-5 transition-all hover:border-[#1f7a63]/50 hover:shadow-sm cursor-pointer flex flex-col justify-between text-left"
              >
                <div>
                  {/* Quiet metadata top line (zero pills) */}
                  <div className="flex items-center justify-between gap-2 text-xs text-[#616b66]">
                    <span>
                      Bài {w.l}
                      {w.pos ? ` · ${w.pos}` : ''}
                      {w.hv ? ` · ${w.hv}` : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakZh(w.h, speed);
                        }}
                        aria-label={`Phát âm ${w.h}`}
                        className="rounded-lg p-1.5 text-[#1f7a63] hover:bg-[#e3f1ec] transition-colors"
                        title={`Nghe (${speed}x)`}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFav(w);
                        }}
                        aria-label="Đánh dấu từ khó / yêu thích"
                        className="rounded-lg p-1.5 hover:bg-[#f3f0eb] transition-colors"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            p.fav
                              ? 'fill-[#d96b43] text-[#d96b43]'
                              : 'text-[#9aa39e] group-hover:text-[#616b66]'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Primary Hanzi + Pinyin + Meaning */}
                  <div className="mt-2">
                    <p className="font-zh text-3xl font-semibold text-[#1c2421] leading-tight">
                      {w.h}
                    </p>
                    <p className="mt-1 text-base font-medium text-[#d96b43]">{w.py}</p>
                    <p className="mt-1.5 font-display text-base font-semibold text-[#1c2421] line-clamp-2">
                      {w.vi}
                    </p>
                  </div>

                  {w.rad && (
                    <p className="mt-2.5 text-xs text-[#616b66] line-clamp-2">
                      {w.rad}
                    </p>
                  )}
                </div>

                {/* Footer Status */}
                <div className="mt-4 pt-3 border-t border-[#f3f0eb] flex items-center justify-between gap-2">
                  {renderStatusBadge(st)}
                  <span className="text-xs text-[#616b66] font-mono-num">
                    {p.n
                      ? `Box ${p.box || 0}/6 · Ôn ${p.n}${p.wrong ? ` · Sai ${p.wrong}` : ''}`
                      : 'Chưa ôn'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
