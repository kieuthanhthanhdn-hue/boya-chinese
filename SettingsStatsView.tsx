import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Sparkles,
  Upload,
  Cloud,
  RefreshCw,
  Download,
  RotateCcw,
  Trash2,
  Loader2,
  CheckCircle2,
  Plus,
  Volume2,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import {
  getSheetUrl,
  getSyncConfig,
  getWordProgress,
  parseWordRows,
  parseWords,
  setSheetUrl,
  setSyncConfig,
} from '../data/boyaSeed';
import type { DayLog, PersistedData, Word } from '../types';
import {
  aiAutofillWords,
  getGeminiApiKey,
  saveGeminiApiKey,
} from '../utils/geminiClient';
import { dk, parseCsv, td, wordStatus } from '../utils/practice';
import {
  SPEECH_SOURCE_OPTIONS,
  getAvailableChineseVoices,
  getSavedSpeechSource,
  getSavedVoiceUri,
  saveSpeechSource,
  saveVoiceUri,
  speakZh,
  subscribeVoicesChanged,
  type SpeechSource,
  type SpeechSpeed,
} from '../utils/speech';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsStatsViewProps {
  data: PersistedData;
  speed: SpeechSpeed;
  lastSheetSyncMsg?: string;
  onChangeSpeed: (s: SpeechSpeed) => void;
  onImportWords: (words: Word[]) => number;
  onUpdateGoals: (dailyReviews: number, dailyNew: number) => void;
  onRestoreBackup: (backup: PersistedData) => void;
  onResetProgress: () => void;
  onSyncSupabase: (
    cfg: { u: string; k: string; c: string },
    setStatus: (msg: string) => void
  ) => Promise<void>;
  onSyncGoogleSheet: (url: string, setStatus: (msg: string) => void) => Promise<void>;
}

export function SettingsStatsView({
  data,
  speed,
  lastSheetSyncMsg,
  onChangeSpeed,
  onImportWords,
  onUpdateGoals,
  onRestoreBackup,
  onResetProgress,
  onSyncSupabase,
  onSyncGoogleSheet,
}: SettingsStatsViewProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    getAvailableChineseVoices()
  );
  const [selectedVoice, setSelectedVoice] = useState<string>(() => getSavedVoiceUri());
  const [speechSource, setSpeechSource] = useState<SpeechSource>(() =>
    getSavedSpeechSource()
  );

  useEffect(() => {
    setVoices(getAvailableChineseVoices());
    return subscribeVoicesChanged(() => {
      setVoices(getAvailableChineseVoices());
    });
  }, []);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => getGeminiApiKey());
  const [showApiKey, setShowApiKey] = useState(false);

  const [pasteText, setPasteText] = useState('');
  const [aiWordsInput, setAiWordsInput] = useState('');
  const [aiDefaultLesson, setAiDefaultLesson] = useState('5');
  const [aiLoading, setAiLoading] = useState(false);

  const [goalReviews, setGoalReviews] = useState(
    typeof data.log._g === 'number' ? data.log._g : 20
  );
  const [goalNew, setGoalNew] = useState(
    typeof data.log._nw === 'number' ? data.log._nw : 10
  );

  const [sheetInput, setSheetInput] = useState(getSheetUrl);
  const [savedSheetUrl, setSavedSheetUrl] = useState(getSheetUrl);
  const [sheetLoading, setSheetLoading] = useState(false);
  const initialSync = getSyncConfig();
  const [sbUrl, setSbUrl] = useState(initialSync.u || '');
  const [sbKey, setSbKey] = useState(initialSync.k || '');
  const [sbCode, setSbCode] = useState(initialSync.c || '');

  const [statusMsg, setStatusMsg] = useState('');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Compute Stats
  const stats = useMemo(() => {
    const now = Date.now();
    const statusCounts = { Mới: 0, 'Đang học': 0, Thuộc: 0, 'Chưa nhớ': 0 };
    let dueCount = 0;

    data.w.forEach((w) => {
      const p = getWordProgress(data.p, w);
      const st = wordStatus(p);
      statusCounts[st] += 1;
      if (p.n && p.due <= now) dueCount += 1;
    });

    const todayKey = td();
    const todayLog = (data.log[todayKey] as DayLog | undefined) || { n: 0, ok: 0 };

    const days: { key: string; label: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const k = dk(i);
      const l = (data.log[k] as DayLog | undefined) || { n: 0, ok: 0 };
      days.push({ key: k, label: k.slice(8), n: l.n || 0 });
    }
    const maxDay = Math.max(1, ...days.map((d) => d.n));

    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const l = data.log[dk(i)] as DayLog | undefined;
      if (l && l.n > 0) streak += 1;
      else if (i > 0) break;
    }

    const dailyGoal = typeof data.log._g === 'number' ? data.log._g : 20;
    const goalPct = Math.min(100, Math.round((100 * todayLog.n) / Math.max(1, dailyGoal)));
    const accuracy = todayLog.n ? Math.round((100 * todayLog.ok) / todayLog.n) : 0;

    return {
      statusCounts,
      dueCount,
      todayLog,
      days,
      maxDay,
      streak,
      dailyGoal,
      goalPct,
      accuracy,
    };
  }, [data]);

  // AI Autofill handler
  const handleAiAutofill = async () => {
    const tokens = aiWordsInput
      .split(/[\n,，;；\t]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!tokens.length) {
      setStatusMsg('Vui lòng nhập ít nhất 1 chữ Hán để AI tự động điền thông tin.');
      return;
    }

    setAiLoading(true);
    setStatusMsg('AI đang phân tích Pinyin, Hán Việt, chiết tự và tạo câu ví dụ...');

    try {
      const items = await aiAutofillWords(tokens, aiDefaultLesson);
      if (!items.length) {
        throw new Error('AI không trả về dữ liệu từ vựng.');
      }

      const tsvLines = items.map((it) =>
        [
          it.lesson || aiDefaultLesson || '5',
          it.hanzi,
          it.pinyin,
          it.pos,
          it.hanViet,
          it.english,
          it.vietnamese,
          it.radical,
          it.mnemonic,
          it.exampleZhSpaced,
          it.exampleVi,
        ]
          .map((cell) => String(cell || '').replace(/[\r\n\t]+/g, ' ').trim())
          .join('\t')
      );

      setPasteText((prev) =>
        prev.trim() ? `${prev.trim()}\n${tsvLines.join('\n')}` : tsvLines.join('\n')
      );
      setStatusMsg(
        `Đã tự động điền ${items.length} từ vào ô bên dưới. Kiểm tra lại rồi bấm "Thêm vào kho từ".`
      );
    } catch (err: unknown) {
      setStatusMsg(
        `Lỗi AI tự động điền: ${err instanceof Error ? err.message : 'Không xác định'}`
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddPasted = () => {
    const parsed = parseWords(pasteText);
    if (!parsed.length) {
      setStatusMsg('Không đọc được dòng nào. Kiểm tra lại dấu phân cách Tab hoặc |.');
      return;
    }
    const count = onImportWords(parsed);
    setPasteText('');
    setStatusMsg(`Đã thêm hoặc cập nhật ${count} từ vào kho Boya.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = new TextDecoder('utf-8').decode(reader.result as ArrayBuffer);
          const rows = parseCsv(text);
          const parsed = parseWordRows(rows);
          if (!parsed.length) {
            setStatusMsg('File CSV không có dòng từ vựng hợp lệ.');
            return;
          }
          const count = onImportWords(parsed);
          setStatusMsg(`Đã nhập ${count} từ từ file ${file.name}.`);
          return;
        }

        const wb = XLSX.read(reader.result, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json<unknown[]>(
          wb.Sheets[wb.SheetNames[0]],
          { header: 1, defval: '' }
        );
        const parsed = parseWordRows(rows);
        if (!parsed.length) {
          setStatusMsg('File Excel không có dòng từ vựng hợp lệ.');
          return;
        }
        const count = onImportWords(parsed);
        setStatusMsg(`Đã nhập ${count} từ từ file ${file.name}.`);
      } catch {
        setStatusMsg('Không đọc được file này. Hãy kiểm tra định dạng .xlsx, .xls hoặc .csv.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExportJson = () => {
    const json = JSON.stringify({
      w: data.w,
      p: data.p,
      log: data.log,
      tests: data.tests,
    });
    setPasteText(json);
    setStatusMsg('Đã xuất toàn bộ dữ liệu ra ô văn bản. Bạn có thể copy để lưu trữ.');
  };

  const handleCopy11ColTable = async () => {
    const cleanCell = (v: string | undefined) =>
      String(v || '')
        .replace(/[\r\n\t]+/g, ' ')
        .trim();

    const header = [
      'Bài',
      'Chữ Hán',
      'Pinyin',
      'Từ loại',
      'Hán Việt',
      'Tiếng Anh',
      'Nghĩa Việt',
      'Chiết tự',
      'Mẹo nhớ',
      'Câu ví dụ',
      'Dịch câu',
    ].join('\t');

    const rows = data.w.map((w) => {
      const primaryEx = w.ex || w.exs?.[0]?.[0] || '';
      const primaryExVi = w.exvi || w.exs?.[0]?.[1] || '';
      return [
        w.l,
        w.h,
        w.py,
        w.pos,
        w.hv,
        w.en,
        w.vi,
        w.rad,
        w.mn,
        primaryEx,
        primaryExVi,
      ]
        .map(cleanCell)
        .join('\t');
    });

    const tsv = [header, ...rows].join('\n');

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(tsv);
        setStatusMsg(
          `Đã copy bảng 11 cột (${data.w.length} từ) vào bộ nhớ tạm. Bạn có thể Ctrl+V / dán thẳng vào Excel hoặc Google Sheet.`
        );
        return;
      }
    } catch {
      // Fallback below
    }
    setPasteText(tsv);
    setStatusMsg(
      `Đã xuất bảng 11 cột (${data.w.length} từ) ra ô văn bản phía trên để bạn copy dán vào Google Sheet.`
    );
  };

  const handleRestoreJson = () => {
    try {
      const parsed = JSON.parse(pasteText) as PersistedData;
      if (!Array.isArray(parsed.w)) {
        throw new Error('Invalid format');
      }
      onRestoreBackup(parsed);
      setStatusMsg(`Đã khôi phục thành công ${parsed.w.length} từ vựng và tiến độ.`);
    } catch {
      setStatusMsg('Dữ liệu sao lưu JSON không hợp lệ.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Toast Banner */}
      {statusMsg && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#1f7a63]/30 bg-[#e3f1ec] px-4 py-3 text-sm text-[#145443]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg('')}
            className="text-xs font-semibold underline shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Gemini API Key Card (Top of Settings for Netlify Static Hosting) */}
      <div className="rounded-2xl border border-[#d96b43]/35 bg-white p-5 md:p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#d96b43]" />
            <h3 className="font-display text-base font-semibold text-[#1c2421]">
              Gemini API Key (AIza...)
            </h3>
          </div>
          {geminiApiKey.trim() ? (
            <span className="rounded-lg bg-[#e3f1ec] px-2.5 py-0.5 text-[11px] font-semibold text-[#145443]">
              Đã lưu tự động
            </span>
          ) : (
            <span className="rounded-lg bg-[#fbece6] px-2.5 py-0.5 text-[11px] font-semibold text-[#b84c27]">
              Chưa nhập key
            </span>
          )}
        </div>

        <p className="text-xs text-[#616b66] leading-relaxed">
          Nhập mã Gemini API Key cá nhân (bắt đầu bằng <span className="font-mono font-medium text-[#1c2421]">AIza...</span>) để toàn bộ tính năng AI (Tự động điền từ, Chiết tự chuyên sâu, Gia sư AI, Hội thoại, Ngữ pháp, Tạo câu Collocations) gọi trực tiếp tới Google Gemini REST API từ trình duyệt — hoạt động mượt mà trên Netlify static hosting. Key được lưu tự động trên máy của bạn (<span className="font-mono">localStorage</span>).
        </p>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={geminiApiKey}
              onChange={(e) => {
                const nextVal = e.target.value;
                setGeminiApiKey(nextVal);
                saveGeminiApiKey(nextVal);
              }}
              placeholder="AIzaSy..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] pl-3.5 pr-11 py-2.5 font-mono text-sm text-[#1c2421] focus:border-[#d96b43] focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              aria-label={showApiKey ? 'Ẩn Gemini API Key' : 'Hiện Gemini API Key'}
              title={showApiKey ? 'Ẩn key' : 'Hiện key'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#616b66] hover:bg-[#f3f0eb] hover:text-[#1c2421]"
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {geminiApiKey && (
            <button
              type="button"
              onClick={() => {
                setGeminiApiKey('');
                saveGeminiApiKey('');
                setStatusMsg('Đã xóa Gemini API Key khỏi thiết bị.');
              }}
              className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2.5 text-xs font-semibold text-[#616b66] hover:bg-[#f3f0eb] hover:text-[#b8352b] min-h-[42px]"
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* PWA Install Card (shown when installable or on iOS Safari) */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-[#1c2421]">
            Cài đặt ứng dụng về điện thoại / máy tính (PWA)
          </h3>
          <p className="text-xs text-[#616b66] mt-0.5">
            Mở toàn màn hình không thanh địa chỉ và hỗ trợ ôn tập mượt mà khi mất mạng.
          </p>
        </div>
        <PWAInstallButton />
      </div>

      {/* Voice Source Selection & Speech Test Panel */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-[#1c2421]">
              Nguồn phát âm & Giọng đọc chuẩn (zh-CN)
            </h3>
            <p className="text-xs text-[#616b66] mt-0.5">
              Ưu tiên âm thanh trực tuyến chuẩn bản xứ (Youdao / Google TTS) và tự động chuyển mượt sang nguồn dự phòng nếu mất mạng.
            </p>
          </div>
          <div className="inline-flex items-center rounded-xl border border-[#e6e2da] bg-[#f3f0eb] p-0.5">
            <button
              type="button"
              onClick={() => onChangeSpeed(0.7)}
              className={`rounded-lg px-2.5 py-1 font-mono-num text-xs font-medium ${
                speed === 0.7 ? 'bg-white text-[#d96b43] shadow-xs' : 'text-[#616b66]'
              }`}
            >
              Chậm 0.7x
            </button>
            <button
              type="button"
              onClick={() => onChangeSpeed(1.0)}
              className={`rounded-lg px-2.5 py-1 font-mono-num text-xs font-medium ${
                speed === 1.0 ? 'bg-white text-[#1f7a63] shadow-xs' : 'text-[#616b66]'
              }`}
            >
              Chuẩn 1.0x
            </button>
          </div>
        </div>

        {/* Nguồn phát âm (Youdao / Google / Browser Offline) */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#1c2421]">Nguồn phát âm</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {SPEECH_SOURCE_OPTIONS.map((opt) => {
              const active = speechSource === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSpeechSource(opt.id);
                    saveSpeechSource(opt.id);
                    setStatusMsg(`Đã chọn ${opt.label}.`);
                  }}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-[#1f7a63] bg-[#e3f1ec]/60'
                      : 'border-[#e6e2da] bg-[#faf9f7] hover:bg-[#f3f0eb]'
                  }`}
                >
                  <p
                    className={`text-xs font-semibold ${
                      active ? 'text-[#145443]' : 'text-[#1c2421]'
                    }`}
                  >
                    {opt.label}
                  </p>
                  <p className="text-[11px] text-[#616b66] mt-0.5 leading-snug">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <div className="flex-1 space-y-1">
            <label className="block text-[11px] font-medium text-[#616b66]">
              {speechSource === 'browser'
                ? 'Chọn giọng trình duyệt cài sẵn trên máy'
                : 'Giọng trình duyệt dự phòng khi mất mạng (Offline)'}
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => {
                const uri = e.target.value;
                setSelectedVoice(uri);
                saveVoiceUri(uri);
              }}
              className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2.5 text-sm text-[#1c2421] focus:border-[#1f7a63] focus:outline-none"
            >
              <option value="">
                Tự động chọn giọng zh-CN tự nhiên nhất ({voices[0]?.name || 'Mặc định trình duyệt'})
              </option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => speakZh('请问，图书馆在哪儿？', speed)}
            className="sm:self-end inline-flex items-center justify-center gap-2 rounded-xl bg-[#1f7a63] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#186250] whitespace-nowrap min-h-[42px]"
          >
            <Volume2 className="h-4 w-4" />
            Nghe thử giọng đọc ({speed}x)
          </button>
        </div>
      </div>

      {/* Section 1: Statistics Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-[#e6e2da] bg-white p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#1c2421]">
                Tiến độ học tập hôm nay
              </h2>
              <p className="text-xs text-[#616b66] mt-0.5">
                Đã ôn{' '}
                <span className="font-mono-num font-semibold text-[#1c2421]">
                  {stats.todayLog.n}
                </span>
                /{stats.dailyGoal} lượt · Đúng {stats.accuracy}% · Chuỗi{' '}
                <span className="font-mono-num font-semibold text-[#d96b43]">
                  {stats.streak} ngày
                </span>{' '}
                · {stats.dueCount} từ đến hạn
              </p>
            </div>
            <span className="font-mono-num text-xl font-bold text-[#1f7a63]">
              {stats.goalPct}%
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#e6e2da]">
            <div
              className="h-full rounded-full bg-[#1f7a63] transition-all"
              style={{ width: `${stats.goalPct}%` }}
            />
          </div>

          {/* 7-day chart */}
          <div>
            <p className="text-xs font-medium text-[#616b66] mb-3">
              Hoạt động 7 ngày gần đây
            </p>
            <div className="flex items-end gap-2.5 h-28 pt-4">
              {stats.days.map((d) => {
                const hPx = Math.max(4, Math.round((d.n / stats.maxDay) * 68));
                return (
                  <div
                    key={d.key}
                    className="flex-1 flex flex-col items-center justify-end gap-1.5"
                  >
                    <span className="font-mono-num text-[11px] text-[#616b66]">
                      {d.n}
                    </span>
                    <div
                      className="w-full max-w-[36px] rounded-t-md bg-[#1f7a63]/85 transition-all"
                      style={{ height: `${hPx}px` }}
                    />
                    <span className="font-mono-num text-[11px] text-[#616b66]">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mastery Summary & Daily Goals */}
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <h3 className="font-display text-base font-semibold text-[#1c2421]">
              Tổng quan kho từ ({data.w.length} từ)
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <div className="rounded-xl bg-[#faf9f7] border border-[#e6e2da] p-3">
                <p className="text-xs text-[#616b66]">Thuộc</p>
                <p className="font-mono-num text-xl font-bold text-[#1f7a63]">
                  {stats.statusCounts['Thuộc']}
                </p>
              </div>
              <div className="rounded-xl bg-[#faf9f7] border border-[#e6e2da] p-3">
                <p className="text-xs text-[#616b66]">Đang học</p>
                <p className="font-mono-num text-xl font-bold text-[#8a5d0e]">
                  {stats.statusCounts['Đang học']}
                </p>
              </div>
              <div className="rounded-xl bg-[#faf9f7] border border-[#e6e2da] p-3">
                <p className="text-xs text-[#616b66]">Mới</p>
                <p className="font-mono-num text-xl font-bold text-[#1c2421]">
                  {stats.statusCounts['Mới']}
                </p>
              </div>
              <div className="rounded-xl bg-[#faf9f7] border border-[#e6e2da] p-3">
                <p className="text-xs text-[#616b66]">Hay sai</p>
                <p className="font-mono-num text-xl font-bold text-[#b8352b]">
                  {stats.statusCounts['Chưa nhớ']}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-[#f0ede6]">
            <p className="text-xs font-semibold text-[#1c2421]">Mục tiêu mỗi ngày</p>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="text-xs text-[#616b66] space-y-1">
                <span>Lượt ôn / ngày</span>
                <input
                  type="number"
                  min={1}
                  value={goalReviews}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 20);
                    setGoalReviews(val);
                    onUpdateGoals(val, goalNew);
                  }}
                  className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2 font-mono-num text-sm text-[#1c2421]"
                />
              </label>
              <label className="text-xs text-[#616b66] space-y-1">
                <span>Từ mới / ngày</span>
                <input
                  type="number"
                  min={1}
                  value={goalNew}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 10);
                    setGoalNew(val);
                    onUpdateGoals(goalReviews, val);
                  }}
                  className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2 font-mono-num text-sm text-[#1c2421]"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Add Words with AI Autofill & Excel/CSV Import */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 space-y-5">
        <div>
          <h3 className="font-display text-lg font-semibold text-[#1c2421]">
            Thêm từ mới & Nhập từ Excel
          </h3>
          <p className="text-xs text-[#616b66] mt-1">
            Chỉ cần nhập danh sách chữ Hán để AI tự điền đầy đủ cột theo chuẩn Boya, hoặc dán trực tiếp từ Excel / tải file .xlsx, .csv.
          </p>
        </div>

        {/* AI Autofill Box */}
        <div className="rounded-xl border border-[#d96b43]/30 bg-[#fbece6]/35 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#d96b43]">
              <Sparkles className="h-4 w-4" />
              AI tự động điền thông tin từ vựng
            </span>
            <label className="inline-flex items-center gap-2 text-xs text-[#616b66]">
              <span>Bài mặc định:</span>
              <input
                type="text"
                value={aiDefaultLesson}
                onChange={(e) => setAiDefaultLesson(e.target.value)}
                className="w-16 rounded-lg border border-[#e6e2da] bg-white px-2.5 py-1 text-xs font-medium text-[#1c2421]"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              lang="zh-CN"
              value={aiWordsInput}
              onChange={(e) => setAiWordsInput(e.target.value)}
              placeholder="Nhập danh sách chữ Hán (ví dụ: 老师, 朋友, 喝茶, 食堂)"
              className="flex-1 rounded-xl border border-[#e6e2da] bg-white px-3.5 py-2.5 font-zh text-base text-[#1c2421] focus:border-[#d96b43] focus:outline-none"
            />
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleAiAutofill}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d96b43] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c25b36] disabled:opacity-60 whitespace-nowrap shrink-0 min-h-[42px]"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI tự động điền thông tin
            </button>
          </div>
        </div>

        {/* Raw Paste Area */}
        <div className="space-y-2">
          <p className="text-xs text-[#616b66]">
            Thứ tự cột (Tab hoặc |): Bài, Chữ Hán, Pinyin, Từ loại, Hán Việt, Tiếng Anh, Nghĩa Việt, Chiết tự, Mẹo nhớ, Câu ví dụ (tách từ bằng dấu cách), Dịch câu.
          </p>
          <textarea
            rows={5}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="5	老师	lǎoshī	n.	lão sư	teacher	giáo viên	..."
            className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-3.5 font-mono text-xs text-[#1c2421] focus:border-[#1f7a63] focus:bg-white focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAddPasted}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1f7a63] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#186250] min-h-[42px]"
            >
              <Plus className="h-4 w-4" />
              Thêm vào kho từ
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-4 py-2.5 text-sm font-medium text-[#1c2421] hover:bg-[#f3f0eb] min-h-[42px]">
              <Upload className="h-4 w-4 text-[#1f7a63]" />
              <span>Nhập file .xlsx / .xls / .csv</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Section 3: Google Sheet & Supabase Sync + Backup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Google Sheet */}
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-[#1f7a63]" />
              <h3 className="font-display text-base font-semibold text-[#1c2421]">
                Đồng bộ Google Sheet (CSV)
              </h3>
            </div>
            {savedSheetUrl && (
              <span className="rounded-lg bg-[#e3f1ec] px-2 py-0.5 text-[11px] font-medium text-[#145443]">
                Đã lưu tự động đồng bộ
              </span>
            )}
          </div>
          <p className="text-xs text-[#616b66] leading-relaxed">
            Dán link Google Sheet đã{' '}
            <span className="font-medium text-[#1c2421]">Publish to web (CSV)</span>. Khi lưu
            link, mỗi lần mở ứng dụng sẽ tự động tải CSV, bỏ qua dòng tiêu đề, cập nhật từ trùng
            ID và thêm từ mới. Hỗ trợ đủ 11 cột chuẩn (A–K) và các cặp câu ví dụ mở rộng (L–M,
            N–O, P–Q).
          </p>
          <input
            type="url"
            value={sheetInput}
            onChange={(e) => setSheetInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
            className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2.5 text-sm text-[#1c2421] focus:border-[#1f7a63] focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sheetLoading}
              onClick={async () => {
                const clean = sheetInput.trim();
                setSheetUrl(clean);
                setSavedSheetUrl(clean);
                setSheetLoading(true);
                try {
                  await onSyncGoogleSheet(clean, setStatusMsg);
                } finally {
                  setSheetLoading(false);
                }
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1f7a63] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#186250] disabled:opacity-60 min-h-[42px]"
            >
              {sheetLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Cập nhật từ Sheet
            </button>
            <button
              type="button"
              disabled={sheetLoading}
              onClick={() => {
                const clean = sheetInput.trim();
                setSheetUrl(clean);
                setSavedSheetUrl(clean);
                setStatusMsg(
                  clean
                    ? 'Đã lưu link Google Sheet vào localStorage. Ứng dụng sẽ tự động đồng bộ mỗi lần mở.'
                    : 'Đã xóa link Google Sheet đã lưu.'
                );
              }}
              className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2.5 text-xs font-semibold text-[#1c2421] hover:bg-[#f3f0eb] min-h-[42px]"
            >
              Lưu link
            </button>
          </div>
          {lastSheetSyncMsg && (
            <p className="rounded-xl bg-[#faf9f7] border border-[#e6e2da] px-3 py-2 text-xs text-[#616b66]">
              {lastSheetSyncMsg}
            </p>
          )}
        </div>

        {/* Supabase Sync */}
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-[#1f7a63]" />
            <h3 className="font-display text-base font-semibold text-[#1c2421]">
              Đồng bộ giữa các thiết bị (Supabase)
            </h3>
          </div>
          <p className="text-xs text-[#616b66]">
            Nhập cùng một bộ URL, anon key và mã đồng bộ trên các thiết bị để hợp nhất tiến độ học tập.
          </p>
          <input
            type="url"
            value={sbUrl}
            onChange={(e) => setSbUrl(e.target.value)}
            placeholder="Supabase URL"
            className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2 text-sm text-[#1c2421]"
          />
          <input
            type="password"
            value={sbKey}
            onChange={(e) => setSbKey(e.target.value)}
            placeholder="Supabase anon key"
            className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2 text-sm text-[#1c2421]"
          />
          <input
            type="text"
            value={sbCode}
            onChange={(e) => setSbCode(e.target.value)}
            placeholder="Mã đồng bộ (chuỗi tự đặt)"
            className="w-full rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2 text-sm text-[#1c2421]"
          />
          <button
            type="button"
            onClick={() => {
              const cfg = {
                u: sbUrl.trim(),
                k: sbKey.trim(),
                c: sbCode.trim(),
              };
              setSyncConfig(cfg);
              onSyncSupabase(cfg, setStatusMsg);
            }}
            className="w-full rounded-xl bg-[#1f7a63] py-2.5 text-sm font-semibold text-white hover:bg-[#186250] min-h-[42px]"
          >
            Đồng bộ ngay
          </button>
        </div>
      </div>

      {/* Section 4: Backup & Reset */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold text-[#1c2421]">
            Sao lưu & Khôi phục dữ liệu (hv1)
          </h3>
          <p className="text-xs text-[#616b66] mt-0.5">
            Xuất JSON ra ô nhập liệu phía trên hoặc dán bản sao lưu để khôi phục.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-4 py-2 text-xs font-semibold text-[#1c2421] hover:bg-[#f3f0eb] min-h-[38px]"
          >
            <Download className="h-3.5 w-3.5" />
            Xuất JSON
          </button>
          <button
            type="button"
            onClick={handleCopy11ColTable}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#1f7a63]/35 bg-[#e3f1ec]/65 px-4 py-2 text-xs font-semibold text-[#145443] hover:bg-[#e3f1ec] min-h-[38px]"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy dạng bảng 11 cột (Excel/Sheet)
          </button>
          <button
            type="button"
            onClick={handleRestoreJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-4 py-2 text-xs font-semibold text-[#1c2421] hover:bg-[#f3f0eb] min-h-[38px]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục từ ô văn bản
          </button>
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e8c5c1] bg-[#fdf2f1] px-4 py-2 text-xs font-semibold text-[#b8352b] hover:bg-[#fae2df] min-h-[38px]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa tiến độ
          </button>
        </div>
      </div>

      {/* In-app Reset Confirmation Modal (no window.confirm) */}
      {confirmResetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => setConfirmResetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#e6e2da] bg-white p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-[#1c2421]">
              Xác nhận xóa tiến độ ôn tập?
            </h3>
            <p className="text-sm text-[#616b66]">
              Toàn bộ lịch sử ôn tập SRS, chuỗi ngày học và kết quả thi thử sẽ bị đặt lại. Kho từ vựng vẫn được giữ nguyên.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="rounded-xl border border-[#e6e2da] bg-white px-4 py-2 text-sm font-medium text-[#1c2421] hover:bg-[#f3f0eb]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setConfirmResetOpen(false);
                  setStatusMsg('Đã xóa toàn bộ tiến độ ôn tập.');
                }}
                className="rounded-xl bg-[#b8352b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9b2a22]"
              >
                Xóa tiến độ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
