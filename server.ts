import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 700 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

function formatAiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : fallback;
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return 'Hệ thống AI đang quá tải tạm thời (503). Vui lòng bấm thử lại sau vài giây.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Đã chạm giới hạn lượt gọi AI tạm thời (429). Vui lòng đợi giây lát rồi thử lại.';
  }
  return raw || fallback;
}

interface ChatMessageInput {
  role: 'user' | 'assistant';
  text: string;
}

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, mode, vocabContext } = req.body as {
      messages?: ChatMessageInput[];
      mode?: string;
      vocabContext?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Thiếu nội dung hội thoại.' });
      return;
    }

    const ai = getAiClient();

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
      mode && modeInstructionMap[mode] ? modeInstructionMap[mode] : '',
      vocabContext ? `Ngữ cảnh từ vựng hiện tại của học viên: ${vocabContext}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents,
      config: {
        systemInstruction,
      },
    });

    res.json({ reply: response.text ?? 'Không nhận được phản hồi từ trợ lý AI.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi kết nối Gemini API';
    console.error('/api/ai/chat error:', err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/autofill', async (req, res) => {
  try {
    const { words, defaultLesson } = req.body as {
      words?: string[];
      defaultLesson?: string;
    };

    if (!Array.isArray(words) || words.length === 0) {
      res.status(400).json({ error: 'Vui lòng nhập ít nhất 1 từ chữ Hán.' });
      return;
    }

    const cleaned = words
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 30);

    if (cleaned.length === 0) {
      res.status(400).json({ error: 'Danh sách từ không hợp lệ.' });
      return;
    }

    const ai = getAiClient();
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

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Bạn là chuyên gia biên soạn từ điển tiếng Trung Boya cho người Việt. Luôn trả về JSON chính xác theo schema, đảm bảo exampleZhSpaced tách các từ và dấu câu bằng khoảng trắng đơn.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              lesson: { type: Type.STRING },
              hanzi: { type: Type.STRING },
              pinyin: { type: Type.STRING },
              pos: { type: Type.STRING },
              hanViet: { type: Type.STRING },
              english: { type: Type.STRING },
              vietnamese: { type: Type.STRING },
              radical: { type: Type.STRING },
              mnemonic: { type: Type.STRING },
              exampleZhSpaced: { type: Type.STRING },
              exampleVi: { type: Type.STRING },
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
      },
    });

    const jsonText = (response.text ?? '[]').trim();
    const items = JSON.parse(jsonText);
    res.json({ items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi tự động điền bằng AI';
    console.error('/api/ai/autofill error:', err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/word-detail', async (req, res) => {
  try {
    const { hanzi, knownMeaning, knownPinyin } = req.body as {
      hanzi?: string;
      knownMeaning?: string;
      knownPinyin?: string;
    };

    const cleanHanzi = (hanzi || '').trim();
    if (!cleanHanzi) {
      res.status(400).json({ error: 'Vui lòng cung cấp chữ Hán cần phân tích.' });
      return;
    }

    const ai = getAiClient();
    const contextHint = [
      knownPinyin ? `Pinyin tham khảo: ${knownPinyin}` : '',
      knownMeaning ? `Nghĩa tham khảo: ${knownMeaning}` : '',
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
      type: Type.OBJECT,
      properties: {
        zh: { type: Type.STRING },
        py: { type: Type.STRING },
        hv: { type: Type.STRING },
        vi: { type: Type.STRING },
      },
      required: ['zh', 'py', 'hv', 'vi'],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Bạn là chuyên gia văn tự học Hán ngữ và giảng viên tiếng Trung cho người Việt. Phân tích chính xác bộ thủ Khang Hi, kết cấu hình thái, Lục thư và đối chiếu từ dễ nhầm. Mọi trường zh chỉ chứa chữ Hán giản thể thuần túy (không lẫn pinyin). Trả về JSON đúng schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hanzi: { type: Type.STRING },
            pinyin: { type: Type.STRING },
            pos: { type: Type.STRING },
            hanViet: { type: Type.STRING },
            english: { type: Type.STRING },
            vietnamese: { type: Type.STRING },
            totalStrokes: { type: Type.INTEGER },
            tonesSummary: { type: Type.STRING },
            decompositionFormula: { type: Type.STRING },
            chars: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  char: { type: Type.STRING },
                  pinyin: { type: Type.STRING },
                  hanViet: { type: Type.STRING },
                  radical: { type: Type.STRING },
                  radicalMeaning: { type: Type.STRING },
                  strokeCount: { type: Type.INTEGER },
                  structure: { type: Type.STRING },
                  liuShu: { type: Type.STRING },
                  components: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        part: { type: Type.STRING },
                        name: { type: Type.STRING },
                        meaning: { type: Type.STRING },
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
            mnemonicStory: { type: Type.STRING },
            exampleZhSpaced: { type: Type.STRING },
            exampleVi: { type: Type.STRING },
            collocations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  zh: { type: Type.STRING },
                  py: { type: Type.STRING },
                  vi: { type: Type.STRING },
                },
                required: ['zh', 'py', 'vi'],
              },
            },
            compounds: { type: Type.ARRAY, items: relatedWordSchema },
            synonyms: { type: Type.ARRAY, items: relatedWordSchema },
            antonyms: { type: Type.ARRAY, items: relatedWordSchema },
            confusable: {
              type: Type.OBJECT,
              properties: {
                compareWord: { type: Type.STRING },
                comparePinyin: { type: Type.STRING },
                compareHanViet: { type: Type.STRING },
                compareMeaning: { type: Type.STRING },
                similarity: { type: Type.STRING },
                difference: { type: Type.STRING },
                exampleTargetZh: { type: Type.STRING },
                exampleTargetPy: { type: Type.STRING },
                exampleTargetVi: { type: Type.STRING },
                exampleCompareZh: { type: Type.STRING },
                exampleComparePy: { type: Type.STRING },
                exampleCompareVi: { type: Type.STRING },
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
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ analysis: parsed });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Lỗi khi phân tích chiết tự chuyên sâu';
    console.error('/api/ai/word-detail error:', err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/grammar-summary', async (req, res) => {
  try {
    const { lessonLabel, vocab } = req.body as {
      lessonLabel?: string;
      vocab?: { h: string; py: string; vi: string; pos?: string }[];
    };

    if (!Array.isArray(vocab) || vocab.length === 0) {
      res.status(400).json({ error: 'Chưa có từ vựng trong bài để tóm tắt ngữ pháp.' });
      return;
    }

    const ai = getAiClient();
    const vocabList = vocab
      .slice(0, 40)
      .map((v) => `${v.h} (${v.py}, ${v.pos || ''}): ${v.vi}`)
      .join('\n');

    const prompt = `Dựa trên danh sách từ vựng của "${lessonLabel || 'Bài học Boya'}" dưới đây:
${vocabList}

Hãy tóm tắt 3–4 điểm ngữ pháp cốt lõi xuất hiện từ nhóm từ vựng này theo giáo trình Boya Chinese, và tạo đúng 5 câu bài tập trắc nghiệm vận dụng nhanh.
Yêu cầu:
- Mỗi điểm ngữ pháp gồm: title (tiêu đề ngắn bằng tiếng Việt), formula (công thức cấu trúc chữ Hán ngắn gọn, ví dụ: 主语 + 在 + 处所), explanation (giải thích ngắn gọn bằng tiếng Việt), và đúng 3 examples (mỗi ví dụ gồm zh chỉ chứa chữ Hán & dấu câu tiếng Trung, py là Pinyin, vi là nghĩa tiếng Việt).
- 5 câu bài tập (exercises) mỗi câu gồm: question (câu hỏi tiếng Việt ngắn), promptZh (câu chữ Hán có chỗ trống ＿＿ hoặc câu mẫu), options (4 đáp án), correctIndex (0..3), explanation (giải thích ngắn bằng tiếng Việt).`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Bạn là giảng viên tiếng Trung giáo trình Boya. Trả về JSON đúng schema, câu ví dụ dùng từ vựng trong bài và chữ Hán giản thể chuẩn.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            grammarPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  formula: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  examples: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        zh: { type: Type.STRING },
                        py: { type: Type.STRING },
                        vi: { type: Type.STRING },
                      },
                      required: ['zh', 'py', 'vi'],
                    },
                  },
                },
                required: ['title', 'formula', 'explanation', 'examples'],
              },
            },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  promptZh: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: ['question', 'promptZh', 'options', 'correctIndex', 'explanation'],
              },
            },
          },
          required: ['grammarPoints', 'exercises'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi tóm tắt ngữ pháp';
    console.error('/api/ai/grammar-summary error:', err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/roleplay', async (req, res) => {
  try {
    const { scenario, lessonLabel, vocab, history, userMessage } = req.body as {
      scenario?: string;
      lessonLabel?: string;
      vocab?: { h: string; py: string; vi: string }[];
      history?: { role: 'user' | 'assistant'; zh: string }[];
      userMessage?: string;
    };

    if (!userMessage || !userMessage.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập hoặc nói câu trả lời.' });
      return;
    }

    const ai = getAiClient();
    const allowedWords = (vocab || [])
      .slice(0, 45)
      .map((v) => `${v.h} (${v.vi})`)
      .join(', ');

    const transcript = (history || [])
      .slice(-10)
      .map((m) => `${m.role === 'user' ? 'Học viên' : 'Bạn'}: ${m.zh}`)
      .join('\n');

    const prompt = `Tình huống nhập vai: ${scenario || 'Giao tiếp hàng ngày tại trường học'} (${lessonLabel || 'Boya'}).
Vốn từ vựng của bài học: ${allowedWords}

Lịch sử hội thoại gần nhất:
${transcript || '(Bắt đầu hội thoại)'}

Tin nhắn mới của học viên: "${userMessage}"

Hãy phản hồi theo vai diễn bằng câu ngắn tự nhiên (1-2 câu), BẮT BUỘC ưu tiên tối đa các từ trong vốn từ vựng bài học (cộng thêm đại từ/trợ từ cơ bản như 我, 你, 他, 她, 吗, 呢, 的, 是, 不, 很, 去, 来, 谢谢).
Đồng thời kiểm tra câu của học viên: nếu có lỗi ngữ pháp hoặc dùng từ chưa tự nhiên, hãy điền correction.hasIssue = true với gợi ý nhẹ nhàng bằng tiếng Việt; nếu câu ổn rồi thì hasIssue = false.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Bạn là bạn học người Trung Quốc thân thiện. replyZh CHỈ ĐƯỢC chứa chữ Hán giản thể và dấu câu tiếng Trung, tuyệt đối không chèn Pinyin hay tiếng Việt vào replyZh.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyZh: { type: Type.STRING },
            replyPinyin: { type: Type.STRING },
            replyVi: { type: Type.STRING },
            correction: {
              type: Type.OBJECT,
              properties: {
                hasIssue: { type: Type.BOOLEAN },
                gentleTip: { type: Type.STRING },
                betterZh: { type: Type.STRING },
                betterPinyin: { type: Type.STRING },
              },
              required: ['hasIssue', 'gentleTip', 'betterZh', 'betterPinyin'],
            },
          },
          required: ['replyZh', 'replyPinyin', 'replyVi', 'correction'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hội thoại AI';
    console.error('/api/ai/roleplay error:', err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/roleplay-suggest', async (req, res) => {
  try {
    const { scenario, vocab, lastAiZh } = req.body as {
      scenario?: string;
      vocab?: { h: string; py: string; vi: string }[];
      lastAiZh?: string;
    };

    const ai = getAiClient();
    const allowedWords = (vocab || [])
      .slice(0, 40)
      .map((v) => `${v.h} (${v.vi})`)
      .join(', ');

    const prompt = `Tình huống: ${scenario || 'Giao tiếp trong trường học'}.
Từ vựng cho phép: ${allowedWords}
Câu vừa rồi của đối phương: "${lastAiZh || '你好！请问你去哪儿？'}"

Hãy gợi ý 3 câu trả lời ngắn gọn, tự nhiên (dùng từ vựng trong bài) để học viên chọn hoặc đọc theo.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Trả về mảng 3 gợi ý JSON. Trường zh chỉ chứa chữ Hán giản thể và dấu câu tiếng Trung.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              zh: { type: Type.STRING },
              py: { type: Type.STRING },
              vi: { type: Type.STRING },
            },
            required: ['zh', 'py', 'vi'],
          },
        },
      },
    });

    const suggestions = JSON.parse((response.text ?? '[]').trim());
    res.json({ suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi tạo gợi ý trả lời';
    console.error('/api/ai/roleplay-suggest error:', err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/collocations', async (req, res) => {
  try {
    const { lessonLabel, vocab, existingPrompts } = req.body as {
      lessonLabel?: string;
      vocab?: { h: string; py: string; vi: string; pos?: string }[];
      existingPrompts?: string[];
    };

    if (!Array.isArray(vocab) || vocab.length === 0) {
      res.status(400).json({ error: 'Chưa có từ vựng trong phạm vi đang chọn để tạo câu hỏi.' });
      return;
    }

    const ai = getAiClient();
    const vocabList = vocab
      .slice(0, 45)
      .map((v) => `${v.h} (${v.py}, ${v.pos || ''}): ${v.vi}`)
      .join('\n');

    const skipList = (existingPrompts || []).slice(0, 50).join(' | ');

    const prompt = `Dựa trên danh sách từ vựng trong phạm vi "${lessonLabel || 'Boya Chinese'}" dưới đây:
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

    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
          'Bạn là giảng viên tiếng Trung Boya chuyên về lượng từ và kết hợp từ (Collocations). Luôn trả về JSON đúng schema, chữ Hán giản thể chuẩn xác, đảm bảo prompt chứa "＿＿" và distractors có 3 đáp án khác answer.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              prompt: { type: Type.STRING },
              answer: { type: Type.STRING },
              distractors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              zhFull: { type: Type.STRING },
              pinyin: { type: Type.STRING },
              viFull: { type: Type.STRING },
              explanation: { type: Type.STRING },
              relatedHanzi: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
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
      },
      })
    );

    const rawItems = JSON.parse((response.text ?? '[]').trim()) as Array<{
      category?: string;
      prompt?: string;
      answer?: string;
      distractors?: string[];
      zhFull?: string;
      pinyin?: string;
      viFull?: string;
      explanation?: string;
      relatedHanzi?: string[];
    }>;

    const existingSet = new Set(
      (existingPrompts || []).map((p) => p.replace(/\s+/g, ''))
    );

    const items = rawItems
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
        };
      })
      .filter((it) => !existingSet.has(it.zhFull.replace(/\s+/g, '')));

    res.json({ items });
  } catch (err: unknown) {
    const message = formatAiErrorMessage(err, 'Lỗi khi AI tạo câu ghép từ');
    console.error('/api/ai/collocations error:', err);
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Boya Chinese 3.0 Studio running on http://localhost:${port}`);
  });
}

startServer();
