import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  BookOpen,
  BookMarked,
  Dumbbell,
  MessageCircle,
  Award,
  Bot,
  SlidersHorizontal,
  Plus,
} from 'lucide-react';
import {
  IV,
  getSheetUrl,
  getSyncConfig,
  getWordProgress,
  loadPersistedData,
  mergeRemoteData,
  normalizePersistedData,
  parseWordRows,
  savePersistedData,
  upsertWords,
  upsertWordsWithStats,
} from './data/boyaSeed';
import type {
  DayLog,
  DeepWordAnalysis,
  MainTab,
  PersistedData,
  SyncConfig,
  Word,
} from './types';
import { parseCsv, td } from './utils/practice';
import {
  getSavedSpeechSpeed,
  saveSpeechSpeed,
  stopSpeech,
  type SpeechSpeed,
} from './utils/speech';
import { DashboardView } from './components/DashboardView';
import { FlashcardView } from './components/FlashcardView';
import { VocabularyView } from './components/VocabularyView';
import { GrammarView } from './components/GrammarView';
import { PracticeView } from './components/PracticeView';
import { RoleplayView } from './components/RoleplayView';
import { HskRoadmapView } from './components/HskRoadmapView';
import { AiAssistantView } from './components/AiAssistantView';
import { SettingsStatsView } from './components/SettingsStatsView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { QuickAddWordModal } from './components/QuickAddWordModal';
import { SpeedDrillModal } from './components/SpeedDrillModal';
import { WordDetailModal } from './components/WordDetailModal';

interface NavItem {
  id: MainTab;
  label: string;
  shortLabel: string;
  icon: typeof Layers;
}

interface SidebarGroup {
  groupTitle: string;
  items: NavItem[];
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    groupTitle: 'Hôm nay',
    items: [
      { id: 'dash', label: 'Bảng điều khiển', shortLabel: 'Tổng quan', icon: LayoutDashboard },
      { id: 'fc', label: 'Thẻ Flashcard SRS', shortLabel: 'Thẻ SRS', icon: Layers },
    ],
  },
  {
    groupTitle: 'Luyện tập',
    items: [
      { id: 'practice', label: 'Luyện tập Tổng hợp', shortLabel: 'Luyện tập', icon: Dumbbell },
      { id: 'roleplay', label: 'Hội thoại AI nhập vai', shortLabel: 'Hội thoại', icon: MessageCircle },
      { id: 'hs', label: 'Thi thử HSK & Lộ trình', shortLabel: 'HSK', icon: Award },
    ],
  },
  {
    groupTitle: 'Thư viện',
    items: [
      { id: 'vocab', label: 'Kho Từ Vựng', shortLabel: 'Từ vựng', icon: BookOpen },
      { id: 'grammar', label: 'Sổ tay Ngữ pháp', shortLabel: 'Ngữ pháp', icon: BookMarked },
    ],
  },
  {
    groupTitle: 'Công cụ & Tiến độ',
    items: [
      { id: 'ai', label: 'Gia sư AI & Sửa câu', shortLabel: 'Gia sư AI', icon: Bot },
      { id: 'ad', label: 'Cài đặt & Nhập liệu', shortLabel: 'Cài đặt', icon: SlidersHorizontal },
    ],
  },
];

const ALL_NAV_ITEMS = SIDEBAR_GROUPS.flatMap((g) => g.items);

const MOBILE_BOTTOM_NAV: NavItem[] = [
  { id: 'dash', label: 'Bảng điều khiển', shortLabel: 'Tổng quan', icon: LayoutDashboard },
  { id: 'fc', label: 'Thẻ SRS', shortLabel: 'Thẻ SRS', icon: Layers },
  { id: 'practice', label: 'Luyện tập', shortLabel: 'Luyện tập', icon: Dumbbell },
  { id: 'vocab', label: 'Từ vựng', shortLabel: 'Từ vựng', icon: BookOpen },
  { id: 'roleplay', label: 'Hội thoại AI', shortLabel: 'Hội thoại', icon: MessageCircle },
];

export default function App() {
  const [data, setData] = useState<PersistedData>(() => loadPersistedData());
  const [tab, setTab] = useState<MainTab>('dash');
  const [lessonFilter, setLessonFilter] = useState<string>('all');
  const [speed, setSpeed] = useState<SpeechSpeed>(() => getSavedSpeechSpeed());
  const [prioritizeWrongOnly, setPrioritizeWrongOnly] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [speedDrillSession, setSpeedDrillSession] = useState<{
    title: string;
    words: Word[];
  } | null>(null);
  const [detailModal, setDetailModal] = useState<{
    word: Word;
    initialAnalysis?: DeepWordAnalysis | null;
  } | null>(null);
  const [lastSheetSyncMsg, setLastSheetSyncMsg] = useState<string>('');

  const handleSpeedChange = (next: SpeechSpeed) => {
    setSpeed(next);
    saveSpeechSpeed(next);
  };

  const commitData = (updater: (prev: PersistedData) => PersistedData) => {
    setData((prev) => {
      const next = updater(prev);
      savePersistedData(next);
      return next;
    });
  };

  const lessons = useMemo(() => {
    return Array.from(new Set(data.w.map((w) => w.l))).sort((a, b) => {
      if (a === 'Từ sưu tầm') return 1;
      if (b === 'Từ sưu tầm') return -1;
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [data.w]);

  const filteredPool = useMemo(() => {
    if (lessonFilter === 'all') return data.w;
    if (lessonFilter === 'wrong') {
      return data.w.filter((w) => (getWordProgress(data.p, w).wrong || 0) > 0);
    }
    return data.w.filter((w) => w.l === lessonFilter);
  }, [data.w, data.p, lessonFilter]);

  /**
   * Unified SRS feedback across ALL learning modes (Quiz, Listen, Read, Translate, Write, HSK, IME):
   * - Correct: advance box (0 -> 6), schedule 1 -> 2 -> 4 -> 8 -> 16 -> 32 days.
   * - Wrong: reset box to 0, schedule retry after 5 minutes, increment wrong counter.
   */
  const recordAttempt = (word: Word, ok: boolean) => {
    commitData((prev) => {
      const now = Date.now();
      const d = td();
      const existing = getWordProgress(prev.p, word);
      const nextP = { ...existing };
      if (!nextP.first) nextP.first = d;
      nextP.n = (nextP.n || 0) + 1;
      nextP.last = d;

      if (ok) {
        nextP.box = Math.min(IV.length - 1, (nextP.box || 0) + 1);
        nextP.due = now + IV[nextP.box] * 864e5;
      } else {
        nextP.wrong = (nextP.wrong || 0) + 1;
        nextP.box = 0;
        nextP.due = now + 5 * 60 * 1000; // 5 minutes
      }

      const prevDay = (prev.log[d] as DayLog | undefined) || { n: 0, ok: 0 };
      const nextDay: DayLog = {
        n: (prevDay.n || 0) + 1,
        ok: (prevDay.ok || 0) + (ok ? 1 : 0),
      };

      return {
        ...prev,
        p: { ...prev.p, [word.id]: nextP },
        log: { ...prev.log, [d]: nextDay },
      };
    });
  };

  // Flashcard SRS 3-level rating (0 = Quên -> 5 mins, 1 = Mơ hồ -> 10 mins, 2 = Nhớ -> 1..32 days)
  const handleFlashcardRate = (word: Word, rating: 0 | 1 | 2) => {
    commitData((prev) => {
      const now = Date.now();
      const d = td();
      const existing = getWordProgress(prev.p, word);
      const nextP = { ...existing };

      if (!nextP.first) nextP.first = d;
      nextP.n = (nextP.n || 0) + 1;
      nextP.last = d;

      if (rating === 2) {
        nextP.box = Math.min(IV.length - 1, (nextP.box || 0) + 1);
        nextP.due = now + IV[nextP.box] * 864e5;
      } else if (rating === 1) {
        nextP.due = now + 10 * 60 * 1000;
      } else {
        nextP.box = 0;
        nextP.wrong = (nextP.wrong || 0) + 1;
        nextP.due = now + 5 * 60 * 1000;
      }

      const prevDay = (prev.log[d] as DayLog | undefined) || { n: 0, ok: 0 };
      const nextDay: DayLog = {
        n: (prevDay.n || 0) + 1,
        ok: (prevDay.ok || 0) + (rating === 2 ? 1 : 0),
      };

      return {
        ...prev,
        p: { ...prev.p, [word.id]: nextP },
        log: { ...prev.log, [d]: nextDay },
      };
    });
  };

  const handleToggleFav = (word: Word) => {
    commitData((prev) => {
      const existing = getWordProgress(prev.p, word);
      return {
        ...prev,
        p: {
          ...prev.p,
          [word.id]: {
            ...existing,
            fav: !existing.fav,
          },
        },
      };
    });
  };

  const handleImportWords = (incoming: Word[]): number => {
    commitData((prev) => ({
      ...prev,
      w: upsertWords(prev.w, incoming),
    }));
    return incoming.length;
  };

  const handleSaveQuickWord = (word: Word) => {
    commitData((prev) => {
      const existing = prev.p[word.id];
      return {
        ...prev,
        w: upsertWords(prev.w, [word]),
        p: {
          ...prev.p,
          [word.id]: existing
            ? { ...existing, due: Date.now() }
            : { box: 0, due: Date.now(), wrong: 0, n: 0 },
        },
      };
    });
  };

  const handleUrgentReview = (wrongWords: Word[]) => {
    if (!wrongWords.length) return;
    commitData((prev) => {
      const nextP = { ...prev.p };
      const now = Date.now();
      wrongWords.forEach((w) => {
        const cur = getWordProgress(nextP, w);
        nextP[w.id] = {
          ...cur,
          box: 0,
          due: now,
          wrong: Math.max(1, (cur.wrong || 0) + 1),
        };
      });
      return { ...prev, p: nextP };
    });
    setLessonFilter('wrong');
    setPrioritizeWrongOnly(true);
    stopSpeech();
    setTab('fc');
  };

  const handleUpdateGoals = (dailyReviews: number, dailyNew: number) => {
    commitData((prev) => ({
      ...prev,
      log: {
        ...prev.log,
        _g: dailyReviews,
        _nw: dailyNew,
      },
    }));
  };

  const handleSaveTest = (pct: number, n: number) => {
    commitData((prev) => ({
      ...prev,
      tests: [...prev.tests, { d: td(), pct, n }],
    }));
  };

  const handleRestoreBackup = (backup: PersistedData) => {
    const normalized = normalizePersistedData(backup);
    savePersistedData(normalized);
    setData(normalized);
  };

  const handleResetProgress = () => {
    commitData((prev) => ({
      ...prev,
      p: {},
      log: {},
      tests: [],
    }));
  };

  const handleSyncGoogleSheet = async (
    rawUrl: string,
    setStatus: (msg: string) => void
  ) => {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
      setStatus('Chưa nhập link Google Sheet.');
      return;
    }
    let u = trimmed.replace('/pubhtml', '/pub');
    if (u.includes('output=html')) {
      u = u.replace('output=html', 'output=csv');
    } else if (u.includes('/pub') && !u.includes('output=csv')) {
      u += (u.includes('?') ? '&' : '?') + 'output=csv';
    }
    setStatus('Đang cập nhật từ Google Sheet...');
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const t = await r.text();
      if (t.trim().startsWith('<')) {
        throw new Error('không phải CSV, hãy dùng link Publish to web');
      }
      const rows = parseCsv(t);
      const incoming = parseWordRows(rows);
      if (!incoming.length) throw new Error('không có dòng hợp lệ');

      const currentWords = loadPersistedData().w;
      const preview = upsertWordsWithStats(currentWords, incoming);
      commitData((prev) => ({
        ...prev,
        w: upsertWordsWithStats(prev.w, incoming).words,
      }));

      const msg = `Đã đồng bộ ${incoming.length} từ từ Google Sheet (thêm mới ${preview.added}, cập nhật ${preview.updated} từ trùng ID) lúc ${new Date().toLocaleTimeString()}.`;
      setLastSheetSyncMsg(msg);
      setStatus(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
      const errText = `Không đọc được Sheet (${msg}). Kiểm tra link Publish to web dạng CSV.`;
      setLastSheetSyncMsg(errText);
      setStatus(errText);
    }
  };

  const handleSyncSupabase = async (
    cfg: SyncConfig,
    setStatus: (msg: string) => void
  ) => {
    if (!cfg.u || !cfg.k || !cfg.c) {
      setStatus('Nhập đủ Supabase URL, anon key và mã đồng bộ.');
      return;
    }
    const headers = {
      apikey: cfg.k,
      Authorization: `Bearer ${cfg.k}`,
      'Content-Type': 'application/json',
    };
    const baseUrl = cfg.u.endsWith('/') ? cfg.u.slice(0, -1) : cfg.u;
    const url = `${baseUrl}/rest/v1/sync`;
    setStatus('Đang đồng bộ với Supabase...');
    try {
      const r = await fetch(
        `${url}?id=eq.${encodeURIComponent(cfg.c)}&select=data`,
        { headers }
      );
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { data?: Partial<PersistedData> }[];

      let latestData = loadPersistedData();
      if (j[0]?.data) {
        latestData = mergeRemoteData(latestData, j[0].data);
        savePersistedData(latestData);
        setData(latestData);
      }

      const r2 = await fetch(url, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: cfg.c,
          data: {
            w: latestData.w,
            p: latestData.p,
            log: latestData.log,
            tests: latestData.tests,
          },
          updated_at: new Date().toISOString(),
        }),
      });
      if (!r2.ok) throw new Error(String(r2.status));
      setStatus(`Đồng bộ xong lúc ${new Date().toLocaleTimeString()}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi mạng';
      setStatus(
        `Lỗi đồng bộ (${msg}). Kiểm tra URL, anon key, bảng sync và kết nối.`
      );
    }
  };

  // Sequential startup sync if configured (Supabase + Google Sheet CSV)
  useEffect(() => {
    let active = true;
    const runStartupSync = async () => {
      const cfg = getSyncConfig();
      if (cfg.c && cfg.u && cfg.k && active) {
        await handleSyncSupabase(cfg, () => {});
      }
      const sheet = getSheetUrl();
      if (sheet && active) {
        await handleSyncGoogleSheet(sheet, () => {});
      }
    };
    void runStartupSync();
    return () => {
      active = false;
    };
  }, []);

  const switchTab = (next: MainTab) => {
    stopSpeech();
    if (next !== 'fc') setPrioritizeWrongOnly(false);
    setTab(next);
  };

  const activeNavMeta = ALL_NAV_ITEMS.find((n) => n.id === tab) || ALL_NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#1c2421] flex flex-col md:flex-row">
      {/* Desktop Fixed Left Sidebar (4 semantic groups) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-[#e6e2da] bg-[#faf9f7] px-4 py-5 justify-between overflow-y-auto">
        <div className="space-y-5">
          <div className="px-2">
            <span className="font-display text-lg font-bold tracking-tight text-[#1c2421]">
              Boya Chinese 3.0
            </span>
            <p className="text-xs text-[#616b66] mt-0.5">
              SRS · Phản xạ · Ngữ pháp · AI
            </p>
          </div>

          <nav className="space-y-4" aria-label="Điều hướng chính">
            {SIDEBAR_GROUPS.map((group) => (
              <div key={group.groupTitle} className="space-y-1">
                <p className="px-3 text-xs font-semibold text-[#616b66]/90">
                  {group.groupTitle}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => switchTab(item.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-[#e3f1ec] text-[#1f7a63] font-semibold'
                          : 'text-[#616b66] hover:bg-[#f3f0eb] hover:text-[#1c2421]'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? 'text-[#1f7a63]' : 'text-[#616b66]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Lesson Scope Selector */}
        <div className="mt-4 rounded-2xl border border-[#e6e2da] bg-white p-3.5 space-y-2">
          <label className="block text-xs font-medium text-[#616b66]">
            Phạm vi bài học
          </label>
          <select
            value={lessonFilter}
            onChange={(e) => setLessonFilter(e.target.value)}
            className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-2.5 py-2 text-xs font-medium text-[#1c2421] focus:border-[#1f7a63] focus:outline-none"
          >
            <option value="all">Tất cả bài ({data.w.length})</option>
            {lessons.map((l) => (
              <option key={l} value={l}>
                Bài {l}
              </option>
            ))}
            <option value="wrong">Từ hay sai</option>
          </select>
          <p className="text-xs text-[#616b66] font-mono-num">
            Đang chọn: {filteredPool.length} từ
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen pb-20 md:pb-0">
        {/* Clean Top Header */}
        <header className="sticky top-0 z-30 border-b border-[#e6e2da] bg-[#faf9f7]/95 backdrop-blur-sm px-4 md:px-8 py-3 pt-safe">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <h1 className="font-display text-base md:text-lg font-semibold text-[#1c2421] whitespace-nowrap truncate">
              {activeNavMeta.label}
            </h1>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <PWAInstallButton compact />

              {/* Mobile Quick Access for Secondary Tools (Grammar / HSK / AI / Settings) */}
              <div className="flex md:hidden items-center gap-1">
                <button
                  type="button"
                  onClick={() => switchTab('grammar')}
                  title="Sổ tay Ngữ pháp"
                  className={`rounded-xl border p-2 ${
                    tab === 'grammar'
                      ? 'border-[#1f7a63] bg-[#e3f1ec] text-[#1f7a63]'
                      : 'border-[#e6e2da] bg-white text-[#616b66]'
                  }`}
                >
                  <BookMarked className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('hs')}
                  title="Thi thử HSK"
                  className={`rounded-xl border p-2 ${
                    tab === 'hs'
                      ? 'border-[#1f7a63] bg-[#e3f1ec] text-[#1f7a63]'
                      : 'border-[#e6e2da] bg-white text-[#616b66]'
                  }`}
                >
                  <Award className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('ai')}
                  title="Gia sư AI"
                  className={`rounded-xl border p-2 ${
                    tab === 'ai'
                      ? 'border-[#1f7a63] bg-[#e3f1ec] text-[#1f7a63]'
                      : 'border-[#e6e2da] bg-white text-[#616b66]'
                  }`}
                >
                  <Bot className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('ad')}
                  title="Cài đặt & Nhập liệu"
                  className={`rounded-xl border p-2 ${
                    tab === 'ad'
                      ? 'border-[#1f7a63] bg-[#e3f1ec] text-[#1f7a63]'
                      : 'border-[#e6e2da] bg-white text-[#616b66]'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>

              {/* Desktop Global Speed Toggle */}
              <div className="hidden sm:inline-flex items-center rounded-xl border border-[#e6e2da] bg-[#f3f0eb] p-0.5">
                <button
                  type="button"
                  onClick={() => handleSpeedChange(0.7)}
                  className={`rounded-lg px-2 py-1 font-mono-num text-xs font-medium transition-colors ${
                    speed === 0.7 ? 'bg-white text-[#d96b43] shadow-xs' : 'text-[#616b66]'
                  }`}
                >
                  0.7x
                </button>
                <button
                  type="button"
                  onClick={() => handleSpeedChange(1.0)}
                  className={`rounded-lg px-2 py-1 font-mono-num text-xs font-medium transition-colors ${
                    speed === 1.0 ? 'bg-white text-[#1f7a63] shadow-xs' : 'text-[#616b66]'
                  }`}
                >
                  1.0x
                </button>
              </div>
            </div>
          </div>

          {/* Persistent Lesson-First Scope Bar (Desktop & Mobile across all tabs) */}
          <div className="max-w-6xl mx-auto mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-medium text-[#616b66] whitespace-nowrap shrink-0 mr-1">
              Phạm vi:
            </span>
            <button
              type="button"
              onClick={() => setLessonFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                lessonFilter === 'all'
                  ? 'bg-[#1f7a63] text-white'
                  : 'border border-[#e6e2da] bg-white text-[#616b66] hover:text-[#1c2421]'
              }`}
            >
              Tất cả ({data.w.length})
            </button>
            {lessons.map((l) => {
              const label = l === 'Từ sưu tầm' ? 'Từ sưu tầm' : `Bài ${l}`;
              const count = data.w.filter((w) => w.l === l).length;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLessonFilter(l)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    lessonFilter === l
                      ? 'bg-[#1f7a63] text-white'
                      : 'border border-[#e6e2da] bg-white text-[#616b66] hover:text-[#1c2421]'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setLessonFilter('wrong')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                lessonFilter === 'wrong'
                  ? 'bg-[#b8352b] text-white'
                  : 'border border-[#e8c5c1] bg-[#fdf2f1] text-[#b8352b] hover:bg-[#fae2df]'
              }`}
            >
              Từ hay sai
            </button>
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 px-4 md:px-8 py-5 md:py-6">
          <div className="max-w-6xl mx-auto">
            {tab === 'dash' && (
              <DashboardView
                data={data}
                words={filteredPool}
                speed={speed}
                onChangeSpeed={handleSpeedChange}
                onStartReviewNow={(wrongOnly) => {
                  setPrioritizeWrongOnly(Boolean(wrongOnly));
                  setTab('fc');
                }}
                onStartSpeedDrill={() => {
                  const title =
                    lessonFilter === 'all'
                      ? 'Tất cả bài'
                      : lessonFilter === 'wrong'
                        ? 'Từ hay sai'
                        : lessonFilter === 'Từ sưu tầm'
                          ? 'Từ sưu tầm'
                          : `Bài ${lessonFilter}`;
                  setSpeedDrillSession({ title, words: filteredPool });
                }}
                onOpenHsk={() => switchTab('hs')}
                onOpenGrammar={() => switchTab('grammar')}
              />
            )}

            {tab === 'fc' && (
              <FlashcardView
                words={filteredPool}
                allWords={data.w}
                progress={data.p}
                log={data.log}
                lessonFilter={lessonFilter}
                speed={speed}
                prioritizeWrongOnly={prioritizeWrongOnly}
                onClearWrongOnly={() => setPrioritizeWrongOnly(false)}
                onChangeSpeed={handleSpeedChange}
                onRate={handleFlashcardRate}
                onToggleFav={handleToggleFav}
                onOpenWordDetail={(w) => setDetailModal({ word: w })}
              />
            )}

            {tab === 'vocab' && (
              <VocabularyView
                allWords={data.w}
                progress={data.p}
                lessonFilter={lessonFilter}
                onChangeLessonFilter={setLessonFilter}
                speed={speed}
                onChangeSpeed={handleSpeedChange}
                onToggleFav={handleToggleFav}
                onOpenWordDetail={(w) => setDetailModal({ word: w })}
              />
            )}

            {tab === 'grammar' && (
              <GrammarView
                allWords={data.w}
                lessonFilter={lessonFilter}
                speed={speed}
                onChangeSpeed={handleSpeedChange}
              />
            )}

            {tab === 'practice' && (
              <PracticeView
                words={filteredPool}
                allWords={data.w}
                progress={data.p}
                lessonFilter={lessonFilter}
                speed={speed}
                onChangeSpeed={handleSpeedChange}
                onRecord={recordAttempt}
              />
            )}

            {tab === 'roleplay' && (
              <RoleplayView
                words={filteredPool}
                lessonFilter={lessonFilter}
                speed={speed}
                onChangeSpeed={handleSpeedChange}
              />
            )}

            {tab === 'hs' && (
              <HskRoadmapView
                words={filteredPool}
                allWords={data.w}
                lessonFilter={lessonFilter}
                progress={data.p}
                tests={data.tests}
                speed={speed}
                onChangeSpeed={handleSpeedChange}
                onRecord={recordAttempt}
                onSaveTest={handleSaveTest}
                onJumpToLesson={(l) => {
                  setLessonFilter(l);
                  switchTab('fc');
                }}
                onStartSpeedDrill={(lessonTitle, lessonWords) =>
                  setSpeedDrillSession({ title: lessonTitle, words: lessonWords })
                }
                onUrgentReview={handleUrgentReview}
              />
            )}

            {tab === 'ai' && (
              <AiAssistantView
                words={filteredPool}
                speed={speed}
                onChangeSpeed={handleSpeedChange}
              />
            )}

            {tab === 'ad' && (
              <SettingsStatsView
                data={data}
                speed={speed}
                lastSheetSyncMsg={lastSheetSyncMsg}
                onChangeSpeed={handleSpeedChange}
                onImportWords={handleImportWords}
                onUpdateGoals={handleUpdateGoals}
                onRestoreBackup={handleRestoreBackup}
                onResetProgress={handleResetProgress}
                onSyncSupabase={handleSyncSupabase}
                onSyncGoogleSheet={handleSyncGoogleSheet}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Quick Add Word Button (+) */}
      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Thêm nhanh từ vựng mới"
        title="Thêm nhanh từ vựng mới"
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#d96b43] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#c25b36] active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Quick Add Word Modal / Bottom Sheet */}
      {quickAddOpen && (
        <QuickAddWordModal
          lessons={lessons}
          defaultLesson={lessonFilter}
          onSaveAndOpenDetail={(word, analysis) => {
            handleSaveQuickWord(word);
            setQuickAddOpen(false);
            setDetailModal({ word, initialAnalysis: analysis });
          }}
          onClose={() => setQuickAddOpen(false)}
        />
      )}

      {/* Deep Etymology & Radical Dictionary Detail Modal */}
      {detailModal && (
        <WordDetailModal
          word={detailModal.word}
          allWords={data.w}
          progress={data.p}
          lessonFilter={lessonFilter}
          speed={speed}
          initialAnalysis={detailModal.initialAnalysis}
          onChangeSpeed={handleSpeedChange}
          onToggleFav={handleToggleFav}
          onAddToReview={handleSaveQuickWord}
          onClose={() => setDetailModal(null)}
        />
      )}

      {/* 3-Minute Speed Drill Modal */}
      {speedDrillSession && (
        <SpeedDrillModal
          title={speedDrillSession.title}
          words={speedDrillSession.words}
          allWords={data.w}
          speed={speed}
          onChangeSpeed={handleSpeedChange}
          onRecord={recordAttempt}
          onClose={() => setSpeedDrillSession(null)}
        />
      )}

      {/* Mobile 5-Item Thumb-Friendly Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#e6e2da] bg-white/95 backdrop-blur-sm pb-safe"
        aria-label="Điều hướng di động"
      >
        <div className="grid grid-cols-5 h-16">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-[#1f7a63] font-semibold' : 'text-[#616b66]'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-full px-1">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
