import { useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  Lightbulb,
  Loader2,
  Eye,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { Word } from '../types';
import {
  aiRoleplaySuggestions,
  aiRoleplayTurn,
} from '../utils/geminiClient';
import { speakZh, type SpeechSpeed } from '../utils/speech';

interface RoleplayViewProps {
  words: Word[];
  lessonFilter: string;
  speed: SpeechSpeed;
  onChangeSpeed: (s: SpeechSpeed) => void;
}

interface RoleplayCorrection {
  hasIssue: boolean;
  gentleTip: string;
  betterZh: string;
  betterPinyin: string;
}

interface RoleplayMessage {
  id: string;
  role: 'user' | 'assistant';
  zh: string;
  pinyin?: string;
  vi?: string;
  revealed?: boolean;
  correction?: RoleplayCorrection;
}

interface ReplySuggestion {
  zh: string;
  py: string;
  vi: string;
}

const SCENARIOS = [
  {
    id: 'campus',
    label: 'Hỏi đường trong trường học',
    openingZh: '你好！请问，图书馆在哪儿？',
    openingPy: 'Nǐ hǎo! Qǐngwèn, túshūguǎn zài nǎr?',
    openingVi: 'Chào bạn! Xin hỏi, thư viện ở đâu vậy?',
  },
  {
    id: 'dorm',
    label: 'Tìm ký túc xá & tòa nhà văn phòng',
    openingZh: '请问，你知道宿舍在办公楼左边吗？',
    openingPy: 'Qǐngwèn, nǐ zhīdào sùshè zài bàngōnglóu zuǒbian ma?',
    openingVi: 'Xin hỏi, bạn có biết ký túc xá ở bên trái tòa nhà văn phòng không?',
  },
  {
    id: 'apology',
    label: 'Giao tiếp lịch sự & cảm ơn',
    openingZh: '对不起，我不知道教学楼在哪儿。',
    openingPy: 'Duìbuqǐ, wǒ bù zhīdào jiàoxuélóu zài nǎr.',
    openingVi: 'Xin lỗi, tôi không biết tòa nhà giảng dạy ở đâu.',
  },
];

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function RoleplayView({
  words,
  lessonFilter,
  speed,
  onChangeSpeed,
}: RoleplayViewProps) {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const activeScenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];

  const [messages, setMessages] = useState<RoleplayMessage[]>([
    {
      id: 'init_1',
      role: 'assistant',
      zh: activeScenario.openingZh,
      pinyin: activeScenario.openingPy,
      vi: activeScenario.openingVi,
      revealed: false,
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ReplySuggestion[]>([]);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const recRef = useRef<BrowserSpeechRecognition | null>(null);

  const resetConversation = (nextScenarioId?: string) => {
    const sc = SCENARIOS.find((s) => s.id === (nextScenarioId || scenarioId)) || SCENARIOS[0];
    if (nextScenarioId) setScenarioId(nextScenarioId);
    setMessages([
      {
        id: `init_${Date.now()}`,
        role: 'assistant',
        zh: sc.openingZh,
        pinyin: sc.openingPy,
        vi: sc.openingVi,
        revealed: false,
      },
    ]);
    setSuggestions([]);
    setChatError(null);
    setVoiceError(null);
  };

  const toggleReveal = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, revealed: !m.revealed } : m))
    );
  };

  const sendReply = async (textOverride?: string) => {
    const content = (textOverride ?? inputText).trim();
    if (!content || loading) return;

    const userMsg: RoleplayMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      zh: content,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!textOverride) setInputText('');
    setSuggestions([]);
    setLoading(true);
    setChatError(null);

    try {
      const lessonLabel =
        lessonFilter === 'all'
          ? 'Tất cả bài Boya'
          : lessonFilter === 'wrong'
            ? 'Nhóm từ hay sai'
            : `Bài ${lessonFilter}`;

      const data = await aiRoleplayTurn({
        scenario: activeScenario.label,
        lessonLabel,
        vocab: words.slice(0, 45).map((w) => ({ h: w.h, py: w.py, vi: w.vi })),
        history: nextMessages.map((m) => ({ role: m.role, zh: m.zh })),
        userMessage: content,
      });

      const aiMsg: RoleplayMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        zh: data.replyZh || '好！',
        pinyin: data.replyPinyin,
        vi: data.replyVi,
        revealed: false,
      };

      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === userMsg.id && data.correction ? { ...m, correction: data.correction } : m
        );
        return [...updated, aiMsg];
      });

      if (data.replyZh) {
        speakZh(data.replyZh, speed);
      }
    } catch (err: unknown) {
      setChatError(
        err instanceof Error ? err.message : 'Không thể kết nối hội thoại AI.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGetSuggestions = async () => {
    if (suggestLoading) return;
    setSuggestLoading(true);
    setChatError(null);
    const lastAi = [...messages].reverse().find((m) => m.role === 'assistant');

    try {
      const list = await aiRoleplaySuggestions({
        scenario: activeScenario.label,
        vocab: words.slice(0, 40).map((w) => ({ h: w.h, py: w.py, vi: w.vi })),
        lastAiZh: lastAi?.zh || activeScenario.openingZh,
      });
      setSuggestions(list || []);
    } catch (err: unknown) {
      setChatError(
        err instanceof Error ? err.message : 'Không tạo được gợi ý câu trả lời.'
      );
    } finally {
      setSuggestLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    setVoiceError(null);
    if (listening && recRef.current) {
      recRef.current.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceError(
        'Trình duyệt này chưa hỗ trợ nhận diện giọng nói zh-CN. Hãy thử Chrome/Safari hoặc gõ chữ trực tiếp.'
      );
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'zh-CN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      rec.onerror = (event) => {
        setListening(false);
        if (event.error !== 'aborted') {
          setVoiceError('Không thu được giọng nói. Kiểm tra quyền Micro và thử lại.');
        }
      };

      rec.onend = () => {
        setListening(false);
      };

      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setVoiceError('Không khởi động được Micro nhận diện tiếng Trung.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-3 h-[calc(100vh-170px)] md:h-[calc(100vh-120px)] min-h-[520px]">
      {/* Header Controls */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scenarioId}
            onChange={(e) => resetConversation(e.target.value)}
            className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2 text-xs md:text-sm font-medium text-[#1c2421] focus:border-[#1f7a63] focus:outline-none"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <span className="text-xs text-[#616b66] font-mono-num">
            {lessonFilter === 'all' ? 'Tất cả bài' : `Bài ${lessonFilter}`} · {words.length} từ
          </span>
        </div>

        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={() => resetConversation()}
            className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] p-2 text-[#616b66] hover:text-[#1c2421]"
            title="Bắt đầu lại hội thoại"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-[#e6e2da] bg-white p-4 space-y-4">
        <p className="text-center text-xs text-[#616b66]">
          Tin nhắn AI mặc định chỉ hiện Chữ Hán để luyện đọc phản xạ · Chạm vào tin nhắn để xem Pinyin, nghĩa Việt và nghe loa
        </p>

        {messages.map((m) => {
          const isUser = m.role === 'user';

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              {isUser ? (
                <div className="max-w-[85%] space-y-1.5 flex flex-col items-end">
                  <div className="rounded-2xl bg-[#1f7a63] px-4 py-3 text-white">
                    <p className="font-zh text-lg">{m.zh}</p>
                  </div>

                  {m.correction?.hasIssue && (
                    <div className="rounded-xl border border-[#ead9b7] bg-[#fbf5e8] px-3.5 py-2.5 text-xs text-[#7a5410] space-y-1">
                      <p className="font-semibold flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-[#d96b43]" />
                        Góp ý nhẹ: {m.correction.gentleTip}
                      </p>
                      {m.correction.betterZh && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="font-zh text-sm font-semibold text-[#1c2421]">
                            {m.correction.betterZh}
                          </span>
                          <span className="text-[#616b66]">
                            ({m.correction.betterPinyin})
                          </span>
                          <button
                            type="button"
                            onClick={() => speakZh(m.correction!.betterZh, speed)}
                            className="rounded-md bg-white p-1 text-[#1f7a63] border border-[#e6e2da]"
                            title="Nghe câu gợi ý"
                          >
                            <Volume2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-[88%] space-y-2">
                  <div
                    onClick={() => toggleReveal(m.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleReveal(m.id);
                      }
                    }}
                    className="cursor-pointer rounded-2xl border border-[#e6e2da] bg-[#faf9f7] px-4 py-3 transition-colors hover:border-[#1f7a63]/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-zh text-xl text-[#1c2421] leading-relaxed">
                        {m.zh}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakZh(m.zh, speed);
                        }}
                        className="shrink-0 rounded-xl border border-[#e6e2da] bg-white p-2 text-[#1f7a63] hover:bg-[#e3f1ec]"
                        title={`Nghe (${speed}x)`}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>

                    {m.revealed ? (
                      <div className="mt-2.5 pt-2.5 border-t border-[#e6e2da] space-y-0.5 text-sm">
                        {m.pinyin && (
                          <p className="font-medium text-[#d96b43]">{m.pinyin}</p>
                        )}
                        {m.vi && <p className="text-[#616b66]">{m.vi}</p>}
                      </div>
                    ) : (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#616b66]">
                        <Eye className="h-3 w-3" />
                        Chạm để xem Pinyin & nghĩa Việt
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[#616b66]">
            <Loader2 className="h-4 w-4 animate-spin text-[#1f7a63]" />
            <span>Bạn học AI đang trả lời...</span>
          </div>
        )}

        {chatError && (
          <div className="rounded-xl border border-[#e8c5c1] bg-[#fdf2f1] p-3 text-xs text-[#b8352b]">
            {chatError}
          </div>
        )}

        {voiceError && (
          <div className="rounded-xl border border-[#ead9b7] bg-[#fbf5e8] p-3 text-xs text-[#7a5410]">
            {voiceError}
          </div>
        )}
      </div>

      {/* Reply Suggestions Drawer */}
      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-[#e6e2da] bg-white p-3 space-y-2">
          <p className="text-xs font-semibold text-[#616b66]">
            Gợi ý câu trả lời (chạm để điền hoặc bấm loa để nghe mẫu)
          </p>
          <div className="grid grid-cols-1 gap-2">
            {suggestions.map((sg, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => setInputText(sg.zh)}
                  className="flex-1 text-left"
                >
                  <p className="font-zh text-base font-medium text-[#1c2421]">
                    {sg.zh}
                  </p>
                  <p className="text-xs text-[#616b66]">
                    <span className="text-[#d96b43]">{sg.py}</span> · {sg.vi}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => speakZh(sg.zh, speed)}
                  className="shrink-0 rounded-lg border border-[#e6e2da] bg-white p-2 text-[#1f7a63]"
                  title="Nghe mẫu"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* One-Handed Bottom Composer */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={suggestLoading}
            onClick={handleGetSuggestions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3 py-2 text-xs font-medium text-[#1c2421] hover:bg-[#f3f0eb] min-h-[38px]"
          >
            {suggestLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d96b43]" />
            ) : (
              <Lightbulb className="h-3.5 w-3.5 text-[#d96b43]" />
            )}
            Gợi ý câu trả lời
          </button>

          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors min-h-[38px] ${
              listening
                ? 'bg-[#b8352b] text-white'
                : 'border border-[#1f7a63]/30 bg-[#e3f1ec] text-[#1f7a63]'
            }`}
          >
            {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {listening ? 'Đang nghe... (Chạm để dừng)' : 'Nói tiếng Trung (zh-CN)'}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendReply();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            lang="zh-CN"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhập câu trả lời bằng chữ Hán..."
            className="flex-1 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-3.5 py-2.5 font-zh text-base text-[#1c2421] focus:border-[#1f7a63] focus:bg-white focus:outline-none min-h-[46px]"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1f7a63] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#186250] disabled:opacity-50 min-h-[46px] min-w-[76px]"
          >
            <Send className="h-4 w-4" />
            <span>Gửi</span>
          </button>
        </form>
      </div>
    </div>
  );
}
