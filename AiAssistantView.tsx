import { useState } from 'react';
import {
  Send,
  Volume2,
  Loader2,
  Trash2,
  BookMarked,
  GitCompare,
  SpellCheck,
  MessageSquarePlus,
} from 'lucide-react';
import type { Word } from '../types';
import { aiChatTutor } from '../utils/geminiClient';
import { speakZh, type SpeechSpeed } from '../utils/speech';

interface AiAssistantViewProps {
  words: Word[];
  speed: SpeechSpeed;
  onChangeSpeed: (s: SpeechSpeed) => void;
}

type AiMode = 'grammar' | 'synonyms' | 'correct' | 'sentence';

interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const AI_MODES: { id: AiMode; label: string; icon: typeof BookMarked; placeholder: string }[] = [
  {
    id: 'grammar',
    label: 'Hỏi ngữ pháp',
    icon: BookMarked,
    placeholder: 'Ví dụ: Cách dùng 在 như động từ và giới từ khác nhau thế nào?',
  },
  {
    id: 'synonyms',
    label: 'Phân biệt từ',
    icon: GitCompare,
    placeholder: 'Ví dụ: Phân biệt 哪儿 và 那儿, hoặc 不用 và 没关系...',
  },
  {
    id: 'correct',
    label: 'Chấm sửa câu',
    icon: SpellCheck,
    placeholder: 'Nhập câu tiếng Trung bạn tự viết để AI chấm và sửa lỗi...',
  },
  {
    id: 'sentence',
    label: 'Đặt câu mẫu',
    icon: MessageSquarePlus,
    placeholder: 'Ví dụ: Đặt 3 câu giao tiếp với 图书馆 và 左边...',
  },
];

const QUICK_PROMPTS: Record<AiMode, string[]> = {
  grammar: [
    'Cách hỏi vị trí với 在...哪儿？',
    'Khi nào dùng 吗 ở cuối câu?',
    'Cấu trúc phương vị từ 北边, 左边, 右边 đứng trước hay sau danh từ?',
  ],
  synonyms: [
    'Phân biệt 哪儿 (nǎr) và 那儿 (nàr)',
    'Phân biệt 不用 (búyòng) và 没关系 (méi guānxi)',
    'Phân biệt 知道 (zhīdào) và 认识 (rènshi)',
  ],
  correct: [
    'Chấm giúp mình câu: 我的宿舍在图书馆的北边。',
    'Kiểm tra câu: 请问，办公楼在哪儿吗？',
    'Sửa câu: 我去学校图书馆看书。',
  ],
  sentence: [
    'Đặt 3 câu hội thoại hỏi đường trong trường học',
    'Cho ví dụ dùng từ 教学楼 và 宿舍',
    'Đặt câu xin lỗi và đáp lại tự nhiên với 对不起 / 没关系',
  ],
};

function extractChineseSegments(text: string): string[] {
  const matches = text.match(/[\u4e00-\u9fff][\u4e00-\u9fff，。？！、\s]{0,30}[\u4e00-\u9fff？！。]?/g) || [];
  const uniq = Array.from(new Set(matches.map((s) => s.trim()).filter((s) => s.length >= 2)));
  return uniq.slice(0, 6);
}

export function AiAssistantView({
  words,
  speed,
  onChangeSpeed,
}: AiAssistantViewProps) {
  const [mode, setMode] = useState<AiMode>('grammar');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeModeMeta = AI_MODES.find((m) => m.id === mode) || AI_MODES[0];

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || loading) return;

    const userMsg: ChatItem = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: content,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textToSend) setInput('');
    setLoading(true);
    setErrorMsg(null);

    try {
      const sampleVocab = words
        .slice(0, 20)
        .map((w) => `${w.h} (${w.py}: ${w.vi})`)
        .join(', ');

      const reply = await aiChatTutor({
        mode,
        vocabContext: sampleVocab,
        messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: reply || '',
        },
      ]);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể kết nối trợ lý AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl flex flex-col gap-4 h-[calc(100vh-180px)] md:h-[calc(100vh-130px)] min-h-[500px]">
      {/* Mode Selector Bar */}
      <div className="rounded-2xl border border-[#e6e2da] bg-white p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {AI_MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1f7a63] text-white'
                    : 'text-[#616b66] hover:bg-[#f3f0eb] hover:text-[#1c2421]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </button>
            );
          })}
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
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-2.5 py-1.5 text-xs text-[#616b66] hover:text-[#b8352b]"
              title="Xóa cuộc trò chuyện"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Làm mới
            </button>
          )}
        </div>
      </div>

      {/* Chat Viewport */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-[#e6e2da] bg-white p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-5 py-6">
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold text-[#1c2421]">
                Gia sư tiếng Trung Boya
              </h2>
              <p className="text-sm text-[#616b66]">
                Hỏi đáp ngữ pháp, phân biệt từ gần nghĩa, đặt câu ví dụ hoặc gửi câu tiếng Trung bạn tự viết để được chấm và sửa lỗi chi tiết.
              </p>
            </div>

            <div className="w-full space-y-2 text-left">
              <p className="text-xs font-semibold text-[#616b66]">Gợi ý nhanh</p>
              <div className="grid grid-cols-1 gap-2">
                {QUICK_PROMPTS[mode].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="rounded-xl border border-[#e6e2da] bg-[#faf9f7] px-4 py-3 text-left text-sm text-[#1c2421] transition-colors hover:border-[#1f7a63]/50 hover:bg-[#e3f1ec]/40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';
            const zhPhrases = isUser ? [] : extractChineseSegments(m.text);

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-[#1f7a63] text-white'
                      : 'border border-[#e6e2da] bg-[#faf9f7] text-[#1c2421]'
                  }`}
                >
                  {m.text}
                </div>

                {!isUser && zhPhrases.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[90%]">
                    {zhPhrases.map((phrase, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => speakZh(phrase, speed)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#e6e2da] bg-white px-2.5 py-1 text-xs text-[#1f7a63] hover:bg-[#e3f1ec]/50"
                        title={`Nghe "${phrase}"`}
                      >
                        <Volume2 className="h-3 w-3" />
                        <span className="font-zh">{phrase}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[#616b66]">
            <Loader2 className="h-4 w-4 animate-spin text-[#1f7a63]" />
            <span>Gia sư AI đang phân tích và soạn câu trả lời...</span>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-[#e8c5c1] bg-[#fdf2f1] p-3 text-sm text-[#b8352b]">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex items-end gap-2 rounded-2xl border border-[#e6e2da] bg-white p-2.5"
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={activeModeMeta.placeholder}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[#1c2421] placeholder:text-[#8c948f] focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#d96b43] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c25b36] disabled:opacity-50 min-h-[42px]"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Gửi</span>
        </button>
      </form>
    </div>
  );
}
