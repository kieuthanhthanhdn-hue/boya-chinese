import type { CollocationItem, Word } from '../types';
import { getCachedWordAnalysis } from './pinyin';

export const BOYA_COLLOCATIONS: CollocationItem[] = [
  // === Nhóm 1: Lượng từ + Danh từ ===
  {
    id: 'col_tushuguan',
    category: 'mw_noun',
    prompt: '一 ＿＿ 图书馆',
    answer: '座',
    distractors: ['本', '条', '张'],
    zhFull: '一座图书馆',
    pinyin: 'yí zuò túshūguǎn',
    viFull: 'một tòa thư viện',
    explanation:
      'Lượng từ 座 (zuò) dùng cho công trình kiến trúc cố định, quy mô lớn như 图书馆 (thư viện), 办公楼 (tòa nhà văn phòng), 山 (núi).',
    relatedHanzi: ['图书馆'],
  },
  {
    id: 'col_cidian',
    category: 'mw_noun',
    prompt: '一 ＿＿ 词典',
    answer: '本',
    distractors: ['座', '位', '张'],
    zhFull: '一本词典',
    pinyin: 'yì běn cídiǎn',
    viFull: 'một quyển từ điển',
    explanation:
      'Lượng từ 本 (běn) dùng cho sách vở, từ điển, vở ghi, tạp chí được đóng thành quyển.',
    relatedHanzi: ['词典', '书', '图书馆'],
  },
  {
    id: 'col_ke',
    category: 'mw_noun',
    prompt: '一 ＿＿ 课',
    answer: '节',
    distractors: ['本', '座', '位'],
    zhFull: '一节课',
    pinyin: 'yì jié kè',
    viFull: 'một tiết học',
    explanation:
      'Lượng từ 节 (jié) dùng để đếm tiết học, toa tàu hoặc các đoạn ngắn (一节课: một tiết học).',
    relatedHanzi: ['课', '教学', '上课'],
  },
  {
    id: 'col_laoshi',
    category: 'mw_noun',
    prompt: '一 ＿＿ 老师',
    answer: '位',
    distractors: ['本', '间', '条'],
    zhFull: '一位老师',
    pinyin: 'yí wèi lǎoshī',
    viFull: 'một vị giáo viên',
    explanation:
      'Lượng từ 位 (wèi) dùng khi chỉ người để bày tỏ sự lịch sự, kính trọng (thầy cô, khách mời, bác sĩ).',
    relatedHanzi: ['老师', '请问', '教学'],
  },
  {
    id: 'col_bangonglou',
    category: 'mw_noun',
    prompt: '一 ＿＿ 办公楼',
    answer: '栋',
    distractors: ['张', '杯', '位'],
    zhFull: '一栋办公楼',
    pinyin: 'yí dòng bàngōnglóu',
    viFull: 'một tòa nhà văn phòng',
    explanation:
      'Lượng từ 栋 (dòng) hoặc 座 (zuò) dùng để đếm các tòa nhà, dãy nhà cao tầng.',
    relatedHanzi: ['办公楼', '楼'],
  },
  {
    id: 'col_sushe',
    category: 'mw_noun',
    prompt: '一 ＿＿ 宿舍',
    answer: '间',
    distractors: ['座', '本', '支'],
    zhFull: '一间宿舍',
    pinyin: 'yì jiān sùshè',
    viFull: 'một phòng ký túc xá',
    explanation:
      'Lượng từ 间 (jiān) chuyên dùng cho các căn phòng: 宿舍 (ký túc xá), 教室 (phòng học), 房间 (căn phòng).',
    relatedHanzi: ['宿舍'],
  },
  {
    id: 'col_xuexiao',
    category: 'mw_noun',
    prompt: '一 ＿＿ 学校',
    answer: '所',
    distractors: ['张', '条', '本'],
    zhFull: '一所学校',
    pinyin: 'yì suǒ xuéxiào',
    viFull: 'một ngôi trường',
    explanation:
      'Lượng từ 所 (suǒ) thường dùng cho trường học (学校), bệnh viện (医院) hoặc cơ quan công cộng.',
    relatedHanzi: ['学校'],
  },
  {
    id: 'col_shu',
    category: 'mw_noun',
    prompt: '一 ＿＿ 中文书',
    answer: '本',
    distractors: ['张', '座', '间'],
    zhFull: '一本中文书',
    pinyin: 'yì běn Zhōngwén shū',
    viFull: 'một quyển sách tiếng Trung',
    explanation:
      'Lượng từ 本 (běn) dùng cho các ấn phẩm đóng tập như 书 (sách), 词典 (từ điển), 杂志 (tạp chí).',
    relatedHanzi: ['书', '图书馆', '教学'],
  },
  {
    id: 'col_pengyou',
    category: 'mw_noun',
    prompt: '一 ＿＿ 好朋友',
    answer: '个',
    distractors: ['座', '本', '间'],
    zhFull: '一个好朋友',
    pinyin: 'yí gè hǎo péngyou',
    viFull: 'một người bạn tốt',
    explanation:
      '个 (gè) là lượng từ phổ thông nhất, kết hợp tự nhiên với 朋友 (bạn bè), 人 (người), 问题 (câu hỏi).',
    relatedHanzi: ['朋友', '个'],
  },
  {
    id: 'col_ditu',
    category: 'mw_noun',
    prompt: '一 ＿＿ 地图',
    answer: '张',
    distractors: ['本', '座', '间'],
    zhFull: '一张地图',
    pinyin: 'yì zhāng dìtú',
    viFull: 'một tấm bản đồ',
    explanation:
      'Lượng từ 张 (zhāng) dùng cho vật có bề mặt phẳng mỏng như giấy (纸), ảnh (照片), bản đồ (地图), bàn (桌子).',
    relatedHanzi: ['地图', '北边', '左边', '右边'],
  },
  {
    id: 'col_cha',
    category: 'mw_noun',
    prompt: '一 ＿＿ 热茶',
    answer: '杯',
    distractors: ['本', '张', '位'],
    zhFull: '一杯热茶',
    pinyin: 'yì bēi rè chá',
    viFull: 'một cốc trà nóng',
    explanation:
      'Lượng từ 杯 (bēi) dùng cho đồ uống đựng trong cốc/ly như 茶 (trà), 水 (nước), 咖啡 (cà phê).',
    relatedHanzi: ['茶', '水', '咖啡'],
  },
  {
    id: 'col_wenti',
    category: 'mw_noun',
    prompt: '一 ＿＿ 问题',
    answer: '个',
    distractors: ['张', '条', '座'],
    zhFull: '一个问题',
    pinyin: 'yí gè wèntí',
    viFull: 'một câu hỏi / một vấn đề',
    explanation:
      'Danh từ trừu tượng hoặc câu hỏi như 问题 (vấn đề/câu hỏi) dùng lượng từ 个 (gè).',
    relatedHanzi: ['问题', '请问', '个'],
  },

  // === Nhóm 2: Động từ + Tân ngữ ===
  {
    id: 'col_shangke',
    category: 'verb_obj',
    prompt: '＿＿ 课 (bắt đầu tiết học)',
    answer: '上',
    distractors: ['听', '喝', '坐'],
    zhFull: '上课',
    pinyin: 'shàngkè',
    viFull: 'lên lớp / vào học',
    explanation:
      'Cụm động-tân cố định: 上课 (lên lớp, bắt đầu học) đối lập với 下课 (tan học).',
    relatedHanzi: ['课', '教学', '学校'],
  },
  {
    id: 'col_xiake',
    category: 'verb_obj',
    prompt: '＿＿ 课 (kết thúc tiết học)',
    answer: '下',
    distractors: ['看', '写', '问'],
    zhFull: '下课',
    pinyin: 'xiàkè',
    viFull: 'tan học / hết tiết',
    explanation:
      'Cặp đối lập với 上课: 下课 (xiàkè) nghĩa là kết thúc buổi học, tan học.',
    relatedHanzi: ['课', '教学', '学校'],
  },
  {
    id: 'col_ting_yinyue',
    category: 'verb_obj',
    prompt: '＿＿ 音乐',
    answer: '听',
    distractors: ['看', '喝', '打'],
    zhFull: '听音乐',
    pinyin: 'tīng yīnyuè',
    viFull: 'nghe nhạc',
    explanation:
      'Động từ 听 (tīng - nghe) kết hợp với 音乐 (âm nhạc) tạo thành cụm chuẩn 听音乐.',
    relatedHanzi: ['音乐', '听'],
  },
  {
    id: 'col_kan_shu',
    category: 'verb_obj',
    prompt: '＿＿ 书',
    answer: '看',
    distractors: ['喝', '听', '问'],
    zhFull: '看书',
    pinyin: 'kànshū',
    viFull: 'đọc sách',
    explanation:
      'Trong tiếng Trung, hành động đọc sách/báo dùng động từ 看 (kàn): 看书 (đọc sách), 看报 (đọc báo).',
    relatedHanzi: ['书', '图书馆', '在'],
  },
  {
    id: 'col_xue_hanyu',
    category: 'verb_obj',
    prompt: '＿＿ 汉语',
    answer: '学',
    distractors: ['吃', '喝', '坐'],
    zhFull: '学汉语',
    pinyin: 'xué Hànyǔ',
    viFull: 'học tiếng Hán',
    explanation:
      'Động từ 学 / 学习 kết hợp trực tiếp với tên ngôn ngữ hoặc môn học: 学汉语 (học tiếng Hán), 学中文.',
    relatedHanzi: ['汉语', '学校', '教学', '知道'],
  },
  {
    id: 'col_jieshao_pengyou',
    category: 'verb_obj',
    prompt: '＿＿ 朋友',
    answer: '介绍',
    distractors: ['喝', '坐', '写'],
    zhFull: '介绍朋友',
    pinyin: 'jièshào péngyou',
    viFull: 'giới thiệu bạn bè',
    explanation:
      'Động từ 介绍 (jièshào) đi với danh từ chỉ người hoặc sự vật để giới thiệu làm quen.',
    relatedHanzi: ['介绍', '朋友'],
  },
  {
    id: 'col_qu_tushuguan',
    category: 'verb_obj',
    prompt: '＿＿ 图书馆',
    answer: '去',
    distractors: ['喝', '穿', '写'],
    zhFull: '去图书馆',
    pinyin: 'qù túshūguǎn',
    viFull: 'đi thư viện',
    explanation:
      'Động từ 去 (qù - đi) kết hợp trực tiếp với danh từ chỉ địa điểm như 图书馆, 学校, 宿舍.',
    relatedHanzi: ['去', '图书馆'],
  },
  {
    id: 'col_hui_sushe',
    category: 'verb_obj',
    prompt: '＿＿ 宿舍',
    answer: '回',
    distractors: ['喝', '看', '问'],
    zhFull: '回宿舍',
    pinyin: 'huí sùshè',
    viFull: 'về ký túc xá',
    explanation:
      'Động từ 回 (huí - về/trở lại) đi với nơi chốn quen thuộc như 回宿舍, 回家, 回学校.',
    relatedHanzi: ['宿舍', '学校'],
  },
  {
    id: 'col_wen_wenti',
    category: 'verb_obj',
    prompt: '＿＿ 问题',
    answer: '问',
    distractors: ['喝', '坐', '去'],
    zhFull: '问问题',
    pinyin: 'wèn wèntí',
    viFull: 'hỏi câu hỏi',
    explanation:
      'Động từ 问 (wèn - hỏi) kết hợp với 问题 (câu hỏi) tạo thành cụm 问问题.',
    relatedHanzi: ['请问', '问题'],
  },
  {
    id: 'col_da_dianhua',
    category: 'verb_obj',
    prompt: '＿＿ 电话',
    answer: '打',
    distractors: ['看', '写', '喝'],
    zhFull: '打电话',
    pinyin: 'dǎ diànhuà',
    viFull: 'gọi điện thoại',
    explanation:
      'Hành động gọi điện thoại trong tiếng Trung luôn dùng động từ 打 (dǎ): 打电话.',
    relatedHanzi: ['电话', '打电话'],
  },
  {
    id: 'col_he_cha',
    category: 'verb_obj',
    prompt: '＿＿ 茶',
    answer: '喝',
    distractors: ['看', '问', '写'],
    zhFull: '喝茶',
    pinyin: 'hē chá',
    viFull: 'uống trà',
    explanation:
      'Đồ uống (茶, 水, 咖啡) luôn đi với động từ 喝 (hē - uống).',
    relatedHanzi: ['茶', '喝茶', '不用谢'],
  },
  {
    id: 'col_xie_hanzi',
    category: 'verb_obj',
    prompt: '＿＿ 汉字',
    answer: '写',
    distractors: ['喝', '听', '坐'],
    zhFull: '写汉字',
    pinyin: 'xiě Hànzì',
    viFull: 'viết chữ Hán',
    explanation:
      'Động từ 写 (xiě - viết) dùng với 汉字 (chữ Hán), 作业 (bài tập), 信 (thư).',
    relatedHanzi: ['汉字', '写'],
  },
];

const MW_HINTS: Record<string, string> = {
  个: 'Lượng từ phổ thông dùng cho người, đồ vật hoặc danh từ chung.',
  本: 'Lượng từ dùng cho sách vở, từ điển, tạp chí đóng quyển.',
  座: 'Lượng từ dùng cho tòa nhà, công trình kiến trúc lớn hoặc núi.',
  位: 'Lượng từ trang trọng dùng cho người (thầy cô, khách hàng).',
  间: 'Lượng từ dùng cho căn phòng (phòng học, ký túc xá).',
  所: 'Lượng từ dùng cho trường học, bệnh viện, cơ quan.',
  栋: 'Lượng từ dùng cho tòa nhà cao tầng.',
  张: 'Lượng từ dùng cho vật phẳng mỏng (giấy, ảnh, bàn, vé, bản đồ).',
  杯: 'Lượng từ dùng cho đồ uống đựng trong cốc, ly.',
  节: 'Lượng từ dùng cho tiết học hoặc đoạn ngắn.',
  件: 'Lượng từ dùng cho quần áo (áo), sự việc.',
  条: 'Lượng từ dùng cho vật dài mảnh (đường, sông, cá, quần).',
  支: 'Lượng từ dùng cho vật dài thẳng nhỏ (bút).',
  台: 'Lượng từ dùng cho máy móc, thiết bị (máy tính, TV).',
  辆: 'Lượng từ dùng cho xe cộ có bánh (xe đạp, ô tô).',
};

const ALL_MW_CANDIDATES = ['个', '本', '座', '位', '间', '所', '张', '杯', '节', '条'];

/**
 * Dynamically groups Boya collocations (Measure word + Noun, Verb + Object)
 * aligned to the current vocabulary pool & cached AI deep-dictionary entries.
 */
export function buildCollocationCatalog(
  allWords: Word[],
  scopedWords?: Word[]
): {
  mwNoun: (CollocationItem & { inScope: boolean })[];
  verbObj: (CollocationItem & { inScope: boolean })[];
} {
  const scopeSet = new Set((scopedWords && scopedWords.length ? scopedWords : allWords).map((w) => w.h));
  const allSet = new Set(allWords.map((w) => w.h));

  const seenZh = new Set<string>();
  const mwNoun: (CollocationItem & { inScope: boolean })[] = [];
  const verbObj: (CollocationItem & { inScope: boolean })[] = [];

  const pushItem = (item: CollocationItem, inScope: boolean) => {
    const key = item.zhFull.replace(/\s+/g, '');
    if (seenZh.has(key)) return;
    seenZh.add(key);
    const enriched = { ...item, inScope };
    if (item.category === 'mw_noun') {
      mwNoun.push(enriched);
    } else {
      verbObj.push(enriched);
    }
  };

  // 1. Curated Boya collocations matching active scope or full Boya bank
  for (const item of BOYA_COLLOCATIONS) {
    const matchesScope = item.relatedHanzi.some((h) => scopeSet.has(h));
    const matchesAll = item.relatedHanzi.some((h) => allSet.has(h));
    if (matchesScope || matchesAll) {
      pushItem(item, matchesScope);
    }
  }

  // 2. Auto-extract "一 + [量词] + [名词]" patterns from example sentences in vocabulary
  const wordsToScan = scopedWords && scopedWords.length ? scopedWords : allWords;
  for (const w of wordsToScan) {
    const sentences = [w.ex, ...(w.exs || []).map((e) => e[0])].filter(Boolean);
    for (const rawEx of sentences) {
      const clean = rawEx.replace(/\s+/g, '');
      const m = clean.match(/一([个本座位间所栋张杯节件条支台辆])([\u4e00-\u9fff]{1,4})/);
      if (m) {
        const mw = m[1];
        const noun = m[2];
        const zhFull = `一${mw}${noun}`;
        if (!seenZh.has(zhFull) && allSet.has(noun)) {
          const distractors = ALL_MW_CANDIDATES.filter((c) => c !== mw).slice(0, 3);
          pushItem(
            {
              id: `dyn_mw_${zhFull}`,
              category: 'mw_noun',
              prompt: `一 ＿＿ ${noun}`,
              answer: mw,
              distractors,
              zhFull,
              viFull: `một ${w.h === noun ? w.vi : noun}`,
              explanation:
                MW_HINTS[mw] || `Lượng từ ${mw} thường đi kèm với danh từ ${noun}.`,
              relatedHanzi: [noun, w.h],
            },
            scopeSet.has(noun) || scopeSet.has(w.h)
          );
        }
      }
    }

    // 3. Also pull collocations from cached Gemini Deep Analysis if user inspected this word
    const cached = getCachedWordAnalysis(w.h);
    if (cached?.collocations?.length) {
      for (const c of cached.collocations) {
        const zhClean = (c.zh || '').replace(/[，。？！、\s]/g, '');
        if (zhClean.length < 2 || zhClean.length > 7 || seenZh.has(zhClean)) continue;
        const isMw = /^一[个本座位间所栋张杯节件条支台辆]/.test(zhClean);
        if (isMw) {
          const mw = zhClean[1];
          const noun = zhClean.slice(2);
          pushItem(
            {
              id: `ai_cache_${zhClean}`,
              category: 'mw_noun',
              prompt: `一 ＿＿ ${noun}`,
              answer: mw,
              distractors: ALL_MW_CANDIDATES.filter((x) => x !== mw).slice(0, 3),
              zhFull: zhClean,
              pinyin: c.py,
              viFull: c.vi,
              explanation: MW_HINTS[mw] || `Lượng từ ${mw} đi cùng ${noun}.`,
              relatedHanzi: [w.h, noun],
            },
            scopeSet.has(w.h)
          );
        } else if (w.pos.includes('v') || w.pos.includes('n')) {
          const verb = zhClean[0];
          const obj = zhClean.slice(1);
          if (obj.length >= 1) {
            pushItem(
              {
                id: `ai_cache_${zhClean}`,
                category: 'verb_obj',
                prompt: `＿＿ ${obj}`,
                answer: verb,
                distractors: ['看', '喝', '去', '问'].filter((x) => x !== verb).slice(0, 3),
                zhFull: zhClean,
                pinyin: c.py,
                viFull: c.vi,
                explanation: `Cụm kết hợp tự nhiên "${zhClean}" (${c.vi}) gắn với từ ${w.h}.`,
                relatedHanzi: [w.h],
              },
              scopeSet.has(w.h)
            );
          }
        }
      }
    }
  }

  // Ensure benchmark signature Boya collocations remain available for lookup
  for (const item of BOYA_COLLOCATIONS) {
    if (!seenZh.has(item.zhFull.replace(/\s+/g, ''))) {
      pushItem(item, item.relatedHanzi.some((h) => scopeSet.has(h)));
    }
  }

  // Sort in-scope items first
  mwNoun.sort((a, b) => Number(b.inScope) - Number(a.inScope));
  verbObj.sort((a, b) => Number(b.inScope) - Number(a.inScope));

  return { mwNoun, verbObj };
}
