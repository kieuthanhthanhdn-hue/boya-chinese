import type {
  AiAutofillItem,
  CollocationItem,
  DeepWordAnalysis,
  GrammarLessonSummary,
} from '../types';

export const GEMINI_API_KEY_STORAGE = 'gemini_api_key';
const GEMINI_MODEL = 'gemini-2.5-flash';

export const MISSING_KEY_MESSAGE =
  'Chưa có Gemini API Key. Vui lòng vào mục Cài đặt và nhập mã Gemini API Key (AIza...) trước khi dùng tính năng AI.';

export function getGeminiApiKey(): string {
  try {
    return (localStorage.getItem(GEMINI_API_KEY_STORAGE) || '').trim();
  } catch {
    return '';
  }
}

export function saveGeminiApiKey(key: string): void {
  try {
    const clean = key.trim();
    if (!clean) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, clean);
    }
  } catch {
    // ignore storage errors
  }
}

export function hasGeminiApiKey(): boolean {
  return getGeminiApiKey().length > 0;
}

interface GeminiContentPart {
  text: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
}

interface GeminiCallOptions {
  contents: GeminiContent[];
  systemInstruction?: string;
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: Record<string, unknown>;
}

function stripJsonFence(raw: string): string {
  const trimmed = (raw || '').trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

async function callGeminiDirect(options: GeminiCallOptions): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(MISSING_KEY_MESSAGE);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload: Record<string, unknown> = {
    contents: options.contents,
  };

  if (options.systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  if (options.responseMimeType || options.responseSchema) {
    const generationConfig: Record<string, unknown> = {};
    if (options.responseMimeType) {
      generationConfig.responseMimeType = options.responseMimeType;
    }
    if (options.responseSchema) {
      generationConfig.responseSchema = options.responseSchema;
    }
    payload.generationConfig = generationConfig;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as {
        candidates?: {
          content?: {
            parts?: { text?: string }[];
          };
        }[];
        error?: {
          code?: number;
          message?: string;
          status?: string;
        };
      };

      if (!res.ok) {
        const apiMsg = data.error?.message || `HTTP ${res.status}`;
        if (res.status === 503 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        if (
          res.status === 400 &&
          (apiMsg.toLowerCase().includes('api key') ||
            apiMsg.toLowerCase().includes('api_key'))
        ) {
          throw new Error(
            'Gemini API Key không hợp lệ. Vui lòng kiểm tra lại mã AIza... trong mục Cài đặt.'
          );
        }
        if (res.status === 403) {
          throw new Error(
            'Gemini API Key bị từ chối quyền truy cập (403). Vui lòng kiểm tra lại key trong mục Cài đặt.'
          );
        }
        if (res.status === 429) {
          throw new Error(
            'Đã vượt giới hạn lượt gọi miễn phí của Gemini API (429). Vui lòng đợi một lát rồi thử lại.'
          );
        }
        if (res.status === 503) {
          throw new Error(
            'Máy chủ Gemini đang quá tải tạm thời (503). Vui lòng bấm thử lại sau vài giây.'
          );
        }
        throw new Error(`Lỗi Gemini API: ${apiMsg}`);
      }

      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || '')
        .join('')
        .trim();

      if (!text) {
        throw new Error('Gemini không trả về nội dung. Vui lòng thử lại.');
      }

      return text;
    } catch (err: unknown) {
      lastError =
        err instanceof Error ? err : new Error('Không thể kết nối tới Gemini API.');
      if (attempt === 1) break;
      if (!lastError.message.includes('503')) break;
    }
  }

  throw lastError || new Error('Không thể kết nối tới Gemini API.');
}

async function callGeminiJson<T>(options: GeminiCallOptions): Promise<T> {
  const raw = await callGeminiDirect({
    ...options,
    responseMimeType: 'application/json',
  });
  return JSON.parse(stripJsonFence(raw)) as T;
}

export async function aiAutofillWords(
  words: string[],
  defaultLesson = '5'
): Promise<AiAutofillItem[]> {
  const cleaned = words
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 30);

  if (!cleaned.length) {
    throw new Error('Vui lòng nhập ít nhất 1 từ chữ Hán.');
  }

  const lessonFallback = (defaultLesson || '5').trim() || '5';
  const prompt = `Hãy tạo dữ liệu từ vựng tiếng Trung chuẩn cho ứng dụng học tiếng Trung Boya dựa trên danh sách chữ Hán sau:
${cleaned.map((w, idx) => `${idx + 1}. ${w}`).join('\n')}

Yêu cầu QUAN TRỌNG cho từng trường:
- lesson: Nếu người dùng không chỉ định bài, đặt là "${lessonFallback}".
- hanzi: Chữ Hán giản thể chính xác.
- pinyin: Pinyin có dấu thanh điệu chuẩn (ví dụ: lǎoshī, péngyou).
- pos: Từ loại viết tắt chuẩn tiếng Anh (n., v., adj., adv., pron., mw., prep., conj., phr.).
- hanViet: Âm Hán Việt viết thường (ví dụ: lão sư, bằng hữu).
- english: Nghĩa tiếng Anh ngắn gọn.
- vietnamese: Nghĩa tiếng Việt tự nhiên, súc tích.
- radical: Phân tích chiết tự bộ thủ bằng tiếng Việt (ví dụ: "师 = 丨 + 巾 (khăn); 老 = bộ lão").
- mnemonic: Mẹo nhớ ngắn gọn, dễ hình dung dựa trên bộ thủ.
- exampleZhSpaced: Một câu ví dụ ngắn tự nhiên có chứa đúng từ hanzi đó, BẮT BUỘC tách từng từ và dấu câu bằng MỘT DẤU CÁCH (ví dụ: "我 的 老师 很 好 。" hoặc "他 去 图书馆 。").
- exampleVi: Dịch nghĩa tiếng Việt của câu ví dụ.`;

  return callGeminiJson<AiAutofillItem[]>({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction:
      'Bạn là chuyên gia biên soạn từ điển tiếng Trung Boya cho người Việt. Luôn trả về JSON chính xác theo schema, đảm bảo exampleZhSpaced tách các từ và dấu câu bằng khoảng trắng đơn.',
    responseSchema: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          lesson: { type: 'STRING' },
          hanzi: { type: 'STRING' },
          pinyin: { type: 'STRING' },
          pos: { type: 'STRING' },
          hanViet: { type: 'STRING' },
          english: { type: 'STRING' },
          vietnamese: { type: 'STRING' },
          radical: { type: 'STRING' },
          mnemonic: { type: 'STRING' },
          exampleZhSpaced: { type: 'STRING' },
          exampleVi: { type: 'STRING' },
        },
        required: [
          'lesson',
          'hanzi',
          'pinyin',
          'pos',
          'hanViet',
          'english',
          'vietnamese',
          'radical',
          'mnemonic',
          'exampleZhSpaced',
          'exampleVi',
        ],
      },
    },
  });
}

export async function aiAnalyzeWordDetail(params: {
  hanzi: string;
  knownMeaning?: string;
  knownPinyin?: string;
}): Promise<DeepWordAnalysis> {
  const cleanHanzi = (params.hanzi || '').trim();
  if (!cleanHanzi) {
    throw new Error('Vui lòng cung cấp chữ Hán cần phân tích.');
  }

  const contextHint = [
    params.knownPinyin ? `Pinyin tham khảo: ${params.knownPinyin}` : '',
    params.knownMeaning ? `Nghĩa tham khảo: ${params.knownMeaning}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  const prompt = `Hãy phân tích chuyên sâu từ tiếng Trung "${cleanHanzi}"${contextHint ? ` (${contextHint})` : ''} cho người Việt học tiếng Trung theo cấu trúc Từ điển Chiết tự chuyên sâu:
1. Tổng quan:
   - hanzi: chữ Hán giản thể chuẩn ("${cleanHanzi}").
   - pinyin: Pinyin đầy đủ có dấu thanh điệu chuẩn (tách các âm tiết bằng khoảng trắng nếu từ có nhiều chữ, ví dụ "zhī dào").
   - pos: từ loại viết tắt chuẩn (n., v., adj., adv., pron., mw., prep., conj., phr.).
   - hanViet: âm Hán Việt của cả từ viết thường (ví dụ: "tri đạo").
   - english: nghĩa tiếng Anh ngắn gọn.
   - vietnamese: nghĩa tiếng Việt súc tích, chuẩn xác.
   - totalStrokes: tổng số nét viết của tất cả chữ Hán trong từ (số nguyên).
   - tonesSummary: tóm tắt thanh điệu (ví dụ: "Thanh 1 + Thanh 4").
   - decompositionFormula: sơ đồ cấu tạo trực quan dạng: "知道 = 知 [Tri · bộ 矢] + 道 [Đạo · bộ 辶]".
2. chars: Phân tích từng chữ Hán đơn xuất hiện trong "${cleanHanzi}" (theo đúng thứ tự):
   - char, pinyin, hanViet (viết thường), radical (tên bộ thủ kèm Hán tự, ví dụ "矢 (Thỉ)"), radicalMeaning (nghĩa ngắn của bộ thủ, ví dụ "mũi tên"), strokeCount (số nguyên), structure (kết cấu hình thái: Trái - Phải, Trên - Dưới, Nửa bao quanh, Bao quanh, Độc thể...), liuShu (Lục thư: Tượng hình, Chỉ sự, Hội ý, Hình thanh, Chuyển chú, Giả tá), components (mỗi bộ phận cấu tạo chữ gồm part, name, meaning).
3. mnemonicStory: 1–2 câu mẹo nhớ logic, sinh động bằng tiếng Việt ghép từ nghĩa các bộ thủ thành phần giúp người học nhớ mặt chữ ngay lập tức.
4. exampleZhSpaced & exampleVi: 1 câu ví dụ tự nhiên chứa "${cleanHanzi}" (exampleZhSpaced tách các từ & dấu câu bằng 1 dấu cách, ví dụ "我 知道 他 在 图书馆 。").
5. collocations: Đúng 3–4 cụm từ / kết hợp thường gặp nhất của "${cleanHanzi}" (zh chỉ chứa chữ Hán thuần túy, py là pinyin có dấu, vi là nghĩa Việt).
6. Mạng lưới từ liên quan:
   - compounds: 3–4 từ ghép mở rộng chứa "${cleanHanzi}" (zh, py, hv, vi).
   - synonyms: 2–3 từ cận nghĩa (zh, py, hv, vi).
   - antonyms: 1–3 từ trái nghĩa (zh, py, hv, vi; nếu là danh từ cụ thể không có từ trái nghĩa trực tiếp vẫn đưa cụm/từ đối lập hoặc phủ định tự nhiên nhất).
7. confusable: So sánh với 1 từ cận nghĩa hoặc dễ dùng nhầm nhất (compareWord, comparePinyin, compareHanViet, compareMeaning, similarity, difference, exampleTargetZh, exampleTargetPy, exampleTargetVi, exampleCompareZh, exampleComparePy, exampleCompareVi).`;

  const relatedWordSchema = {
    type: 'OBJECT',
    properties: {
      zh: { type: 'STRING' },
      py: { type: 'STRING' },
      hv: { type: 'STRING' },
      vi: { type: 'STRING' },
    },
    required: ['zh', 'py', 'hv', 'vi'],
  };

  return callGeminiJson<DeepWordAnalysis>({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction:
      'Bạn là chuyên gia văn tự học Hán ngữ và giảng viên tiếng Trung cho người Việt. Phân tích chính xác bộ thủ Khang Hi, kết cấu hình thái, Lục thư và đối chiếu từ dễ nhầm. Mọi trường zh chỉ chứa chữ Hán giản thể thuần túy (không lẫn pinyin). Trả về JSON đúng schema.',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        hanzi: { type: 'STRING' },
        pinyin: { type: 'STRING' },
        pos: { type: 'STRING' },
        hanViet: { type: 'STRING' },
        english: { type: 'STRING' },
        vietnamese: { type: 'STRING' },
        totalStrokes: { type: 'INTEGER' },
        tonesSummary: { type: 'STRING' },
        decompositionFormula: { type: 'STRING' },
        chars: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              char: { type: 'STRING' },
              pinyin: { type: 'STRING' },
              hanViet: { type: 'STRING' },
              radical: { type: 'STRING' },
              radicalMeaning: { type: 'STRING' },
              strokeCount: { type: 'INTEGER' },
              structure: { type: 'STRING' },
              liuShu: { type: 'STRING' },
              components: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    part: { type: 'STRING' },
                    name: { type: 'STRING' },
                    meaning: { type: 'STRING' },
                  },
                  required: ['part', 'name', 'meaning'],
                },
              },
            },
            required: [
              'char',
              'pinyin',
              'hanViet',
              'radical',
              'radicalMeaning',
              'strokeCount',
              'structure',
              'liuShu',
              'components',
            ],
          },
        },
        mnemonicStory: { type: 'STRING' },
        exampleZhSpaced: { type: 'STRING' },
        exampleVi: { type: 'STRING' },
        collocations: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              zh: { type: 'STRING' },
              py: { type: 'STRING' },
              vi: { type: 'STRING' },
            },
            required: ['zh', 'py', 'vi'],
          },
        },
        compounds: { type: 'ARRAY', items: relatedWordSchema },
        synonyms: { type: 'ARRAY', items: relatedWordSchema },
        antonyms: { type: 'ARRAY', items: relatedWordSchema },
        confusable: {
          type: 'OBJECT',
          properties: {
            compareWord: { type: 'STRING' },
            comparePinyin: { type: 'STRING' },
            compareHanViet: { type: 'STRING' },
            compareMeaning: { type: 'STRING' },
            similarity: { type: 'STRING' },
            difference: { type: 'STRING' },
            exampleTargetZh: { type: 'STRING' },
            exampleTargetPy: { type: 'STRING' },
            exampleTargetVi: { type: 'STRING' },
            exampleCompareZh: { type: 'STRING' },
            exampleComparePy: { type: 'STRING' },
            exampleCompareVi: { type: 'STRING' },
          },
          required: [
            'compareWord',
            'comparePinyin',
            'compareHanViet',
            'compareMeaning',
            'similarity',
            'difference',
            'exampleTargetZh',
            'exampleTargetPy',
            'exampleTargetVi',
            'exampleCompareZh',
            'exampleComparePy',
            'exampleCompareVi',
          ],
        },
      },
      required: [
        'hanzi',
        'pinyin',
        'pos',
        'hanViet',
        'english',
        'vietnamese',
        'totalStrokes',
        'tonesSummary',
        'decompositionFormula',
        'chars',
        'mnemonicStory',
        'exampleZhSpaced',
        'exampleVi',
        'collocations',
        'compounds',
        'synonyms',
        'antonyms',
        'confusable',
      ],
    },
  });
}

export async function aiGrammarSummary(params: {
  lessonLabel: string;
  vocab: { h: string; py: string; vi: string; pos?: string }[];
}): Promise<GrammarLessonSummary> {
  if (!params.vocab.length) {
    throw new Error('Chưa có từ vựng trong bài để tóm tắt ngữ pháp.');
  }

  const vocabList = params.vocab
    .slice(0, 40)
    .map((v) => `${v.h} (${v.py}, ${v.pos || ''}): ${v.vi}`)
    .join('\n');

  const prompt = `Dựa trên danh sách từ vựng của "${params.lessonLabel || 'Bài học Boya'}" dưới đây:
${vocabList}

Hãy tóm tắt 3–4 điểm ngữ pháp cốt lõi xuất hiện từ nhóm từ vựng này theo giáo trình Boya Chinese, và tạo đúng 5 câu bài tập trắc nghiệm vận dụng nhanh.
Yêu cầu:
- Mỗi điểm ngữ pháp gồm: title (tiêu đề ngắn bằng tiếng Việt), formula (công thức cấu trúc chữ Hán ngắn gọn, ví dụ: 主语 + 在 + 处所), explanation (giải thích ngắn gọn bằng tiếng Việt), và đúng 3 examples (mỗi ví dụ gồm zh chỉ chứa chữ Hán & dấu câu tiếng Trung, py là Pinyin, vi là nghĩa tiếng Việt).
- 5 câu bài tập (exercises) mỗi câu gồm: question (câu hỏi tiếng Việt ngắn), promptZh (câu chữ Hán có chỗ trống ＿＿ hoặc câu mẫu), options (4 đáp án), correctIndex (0..3), explanation (giải thích ngắn bằng tiếng Việt).`;

  return callGeminiJson<GrammarLessonSummary>({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction:
      'Bạn là giảng viên tiếng Trung giáo trình Boya. Trả về JSON đúng schema, câu ví dụ dùng từ vựng trong bài và chữ Hán giản thể chuẩn.',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        grammarPoints: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              formula: { type: 'STRING' },
              explanation: { type: 'STRING' },
              examples: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    zh: { type: 'STRING' },
                    py: { type: 'STRING' },
                    vi: { type: 'STRING' },
                  },
                  required: ['zh', 'py', 'vi'],
                },
              },
            },
            required: ['title', 'formula', 'explanation', 'examples'],
          },
        },
        exercises: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              question: { type: 'STRING' },
              promptZh: { type: 'STRING' },
              options: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
              correctIndex: { type: 'INTEGER' },
              explanation: { type: 'STRING' },
            },
            required: ['question', 'promptZh', 'options', 'correctIndex', 'explanation'],
          },
        },
      },
      required: ['grammarPoints', 'exercises'],
    },
  });
}

export async function aiChatTutor(params: {
  messages: { role: 'user' | 'assistant'; text: string }[];
  mode?: string;
  vocabContext?: string;
}): Promise<string> {
  const modeInstructionMap: Record<string, string> = {
    grammar:
      'Người dùng đang hỏi về ngữ pháp tiếng Trung. Hãy giải thích ngắn gọn, rõ ràng bằng tiếng Việt, nêu công thức cấu trúc, kèm 2-3 câu ví dụ (Chữ Hán + Pinyin + Nghĩa Việt) và lưu ý lỗi thường gặp của người Việt.',
    synonyms:
      'Người dùng muốn phân biệt các từ gần nghĩa / dễ nhầm trong tiếng Trung. Hãy so sánh trực tiếp theo tiêu chí: Nghĩa cốt lõi, Cách dùng & Từ loại, Ngữ cảnh phù hợp, và cho ví dụ đối chiếu rõ ràng.',
    correct:
      'Người dùng gửi câu tiếng Trung để chấm và sửa. Hãy: 1) Đánh giá mức độ tự nhiên & chính xác, 2) Chỉ ra lỗi sai (từ vựng, trật tự từ, hư từ, lượng từ...), 3) Đưa ra câu đã sửa chuẩn xác (Chữ Hán + Pinyin + Nghĩa Việt), 4) Gợi ý thêm 1 cách nói tự nhiên hơn của người bản xứ nếu có.',
    sentence:
      'Người dùng muốn luyện đặt câu hoặc mở rộng mẫu câu. Hãy đưa ra các câu ví dụ thực tế gắn với trình độ Boya sơ-trung cấp, kèm Pinyin và giải thích ngắn.',
  };

  const systemInstruction = [
    'Bạn là gia sư tiếng Trung chuyên nghiệp đồng hành cùng học viên sử dụng giáo trình Boya Chinese.',
    'Trả lời bằng tiếng Việt rõ ràng, mạch lạc, có hệ thống. Mọi chữ Hán đều nên kèm Pinyin và nghĩa tiếng Việt.',
    'Nếu bạn viết câu ví dụ tiếng Trung, hãy bọc câu tiếng Trung rõ ràng để học viên dễ đọc.',
    params.mode && modeInstructionMap[params.mode]
      ? modeInstructionMap[params.mode]
      : '',
    params.vocabContext
      ? `Ngữ cảnh từ vựng hiện tại của học viên: ${params.vocabContext}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const contents: GeminiContent[] = params.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  return callGeminiDirect({
    contents,
    systemInstruction,
  });
}

export interface RoleplayTurnResponse {
  replyZh: string;
  replyPinyin: string;
  replyVi: string;
  correction: {
    hasIssue: boolean;
    gentleTip: string;
    betterZh: string;
    betterPinyin: string;
  };
}

export async function aiRoleplayTurn(params: {
  scenario: string;
  lessonLabel: string;
  vocab: { h: string; py: string; vi: string }[];
  history: { role: 'user' | 'assistant'; zh: string }[];
  userMessage: string;
}): Promise<RoleplayTurnResponse> {
  const allowedWords = (params.vocab || [])
    .slice(0, 45)
    .map((v) => `${v.h} (${v.vi})`)
    .join(', ');

  const transcript = (params.history || [])
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Học viên' : 'Bạn'}: ${m.zh}`)
    .join('\n');

  const prompt = `Tình huống nhập vai: ${params.scenario || 'Giao tiếp hàng ngày tại trường học'} (${params.lessonLabel || 'Boya'}).
Vốn từ vựng của bài học: ${allowedWords}

Lịch sử hội thoại gần nhất:
${transcript || '(Bắt đầu hội thoại)'}

Tin nhắn mới của học viên: "${params.userMessage}"

Hãy phản hồi theo vai diễn bằng câu ngắn tự nhiên (1-2 câu), BẮT BUỘC ưu tiên tối đa các từ trong vốn từ vựng bài học (cộng thêm đại từ/trợ từ cơ bản như 我, 你, 他, 她, 吗, 呢, 的, 是, 不, 很, 去, 来, 谢谢).
Đồng thời kiểm tra câu của học viên: nếu có lỗi ngữ pháp hoặc dùng từ chưa tự nhiên, hãy điền correction.hasIssue = true với gợi ý nhẹ nhàng bằng tiếng Việt; nếu câu ổn rồi thì hasIssue = false.`;

  return callGeminiJson<RoleplayTurnResponse>({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction:
      'Bạn là bạn học người Trung Quốc thân thiện. replyZh CHỈ ĐƯỢC chứa chữ Hán giản thể và dấu câu tiếng Trung, tuyệt đối không chèn Pinyin hay tiếng Việt vào replyZh.',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        replyZh: { type: 'STRING' },
        replyPinyin: { type: 'STRING' },
        replyVi: { type: 'STRING' },
        correction: {
          type: 'OBJECT',
          properties: {
            hasIssue: { type: 'BOOLEAN' },
            gentleTip: { type: 'STRING' },
            betterZh: { type: 'STRING' },
            betterPinyin: { type: 'STRING' },
          },
          required: ['hasIssue', 'gentleTip', 'betterZh', 'betterPinyin'],
        },
      },
      required: ['replyZh', 'replyPinyin', 'replyVi', 'correction'],
    },
  });
}

export async function aiRoleplaySuggestions(params: {
  scenario: string;
  vocab: { h: string; py: string; vi: string }[];
  lastAiZh: string;
}): Promise<{ zh: string; py: string; vi: string }[]> {
  const allowedWords = (params.vocab || [])
    .slice(0, 40)
    .map((v) => `${v.h} (${v.vi})`)
    .join(', ');

  const prompt = `Tình huống: ${params.scenario || 'Giao tiếp trong trường học'}.
Từ vựng cho phép: ${allowedWords}
Câu vừa rồi của đối phương: "${params.lastAiZh || '你好！请问你去哪儿？'}"

Hãy gợi ý 3 câu trả lời ngắn gọn, tự nhiên (dùng từ vựng trong bài) để học viên chọn hoặc đọc theo.`;

  return callGeminiJson<{ zh: string; py: string; vi: string }[]>({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction:
      'Trả về mảng 3 gợi ý JSON. Trường zh chỉ chứa chữ Hán giản thể và dấu câu tiếng Trung.',
    responseSchema: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          zh: { type: 'STRING' },
          py: { type: 'STRING' },
          vi: { type: 'STRING' },
        },
        required: ['zh', 'py', 'vi'],
      },
    },
  });
}

export async function aiGenerateCollocations(params: {
  lessonLabel: string;
  vocab: { h: string; py: string; vi: string; pos?: string }[];
  existingPrompts?: string[];
}): Promise<CollocationItem[]> {
  if (!params.vocab.length) {
    throw new Error('Chưa có từ vựng trong phạm vi đang chọn để tạo câu hỏi.');
  }

  const vocabList = params.vocab
    .slice(0, 45)
    .map((v) => `${v.h} (${v.py}, ${v.pos || ''}): ${v.vi}`)
    .join('\n');

  const skipList = (params.existingPrompts || []).slice(0, 50).join(' | ');

  const prompt = `Dựa trên danh sách từ vựng trong phạm vi "${params.lessonLabel || 'Boya Chinese'}" dưới đây:
${vocabList}

${skipList ? `KHÔNG ĐƯỢC trùng lặp với các câu/cụm đã có sau: ${skipList}` : ''}

Hãy tạo đúng 5 câu bài tập phản xạ Lượng từ & Cụm từ đi kèm (Collocations) mới, đa dạng, bám sát từ vựng ở trên (chia đều giữa "mw_noun" Lượng từ + Danh từ như "一 ＿＿ 图书馆" và "verb_obj" Động từ + Tân ngữ như "＿＿ 音乐" hoặc "＿＿ 图书馆").

Yêu cầu BẮT BUỘC cho mỗi câu:
- category: "mw_noun" hoặc "verb_obj"
- prompt: Câu/cụm điền khuyết chữ Hán giản thể, có đúng một chỗ trống "＿＿" tại vị trí lượng từ hoặc động từ (ví dụ: "一 ＿＿ 词典" hoặc "＿＿ 汉语").
- answer: 1 lượng từ hoặc động từ đúng (chữ Hán thuần túy).
- distractors: Đúng 3 đáp án nhiễu hợp lý (cùng loại lượng từ hoặc động từ, khác hoàn toàn answer và không trùng nhau).
- zhFull: Cụm/câu hoàn chỉnh chữ Hán thuần túy (ví dụ: "一本词典" hoặc "学汉语").
- pinyin: Pinyin đầy đủ có dấu thanh điệu của zhFull.
- viFull: Nghĩa tiếng Việt ngắn gọn của zhFull (dùng làm gợi ý bên dưới thẻ câu hỏi).
- explanation: Giải thích ngắn gọn 1–2 câu bằng tiếng Việt lý do dùng lượng từ hoặc động từ đó.
- relatedHanzi: Mảng 1–3 chữ Hán xuất hiện trong danh sách từ vựng đầu vào để liên kết tiến độ SRS.`;

  const rawItems = await callGeminiJson<
    Array<{
      category?: string;
      prompt?: string;
      answer?: string;
      distractors?: string[];
      zhFull?: string;
      pinyin?: string;
      viFull?: string;
      explanation?: string;
      relatedHanzi?: string[];
    }>
  >({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction:
      'Bạn là giảng viên tiếng Trung Boya chuyên về lượng từ và kết hợp từ (Collocations). Luôn trả về JSON đúng schema, chữ Hán giản thể chuẩn xác, đảm bảo prompt chứa "＿＿" và distractors có 3 đáp án khác answer.',
    responseSchema: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING' },
          prompt: { type: 'STRING' },
          answer: { type: 'STRING' },
          distractors: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          zhFull: { type: 'STRING' },
          pinyin: { type: 'STRING' },
          viFull: { type: 'STRING' },
          explanation: { type: 'STRING' },
          relatedHanzi: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
        required: [
          'category',
          'prompt',
          'answer',
          'distractors',
          'zhFull',
          'pinyin',
          'viFull',
          'explanation',
          'relatedHanzi',
        ],
      },
    },
  });

  const existingSet = new Set(
    (params.existingPrompts || []).map((p) => p.replace(/\s+/g, ''))
  );

  return rawItems
    .filter((it) => it.prompt && it.answer && it.zhFull)
    .map((it, idx) => {
      const cleanAns = (it.answer || '').trim();
      const uniqueDistractors = Array.from(
        new Set(
          (it.distractors || [])
            .map((d) => d.trim())
            .filter((d) => d && d !== cleanAns)
        )
      ).slice(0, 3);
      const fallbackPool =
        it.category === 'mw_noun'
          ? ['个', '本', '座', '位', '间', '张']
          : ['看', '听', '喝', '去', '问', '写'];
      for (const fb of fallbackPool) {
        if (uniqueDistractors.length >= 3) break;
        if (fb !== cleanAns && !uniqueDistractors.includes(fb)) {
          uniqueDistractors.push(fb);
        }
      }
      return {
        id: `ai_col_${Date.now()}_${idx}`,
        category: it.category === 'mw_noun' ? 'mw_noun' : 'verb_obj',
        prompt: it.prompt!.includes('＿＿') ? it.prompt! : `＿＿ ${it.zhFull}`,
        answer: cleanAns,
        distractors: uniqueDistractors,
        zhFull: (it.zhFull || '').trim(),
        pinyin: (it.pinyin || '').trim(),
        viFull: (it.viFull || '').trim(),
        explanation: (it.explanation || '').trim(),
        relatedHanzi: Array.isArray(it.relatedHanzi) ? it.relatedHanzi : [],
        isAi: true,
      } as CollocationItem;
    })
    .filter((it) => !existingSet.has(it.zhFull.replace(/\s+/g, '')));
}
