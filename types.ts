export type MainTab =
  | 'dash'
  | 'fc'
  | 'vocab'
  | 'practice'
  | 'roleplay'
  | 'grammar'
  | 'hs'
  | 'ai'
  | 'ad';

export type PracticeMode =
  | 'quiz'
  | 'listen'
  | 'ime'
  | 'colloc'
  | 'ro'
  | 'cz'
  | 'tn'
  | 'cf'
  | 'dc'
  | 'wr';

export type TranslateSubMode = 'vt' | 'tv' | 'ty' | 'pn' | 'sc' | 'dg' | 'dt';

export interface CollocationItem {
  id: string;
  category?: 'mw_noun' | 'verb_obj';
  prompt: string;
  answer: string;
  distractors: string[];
  zhFull: string;
  pinyin?: string;
  viFull: string;
  explanation: string;
  relatedHanzi: string[];
  isAi?: boolean;
}

export interface Word {
  id: string;
  l: string; // lesson
  h: string; // hanzi
  py: string; // pinyin
  pos: string; // part of speech
  hv: string; // Sino-Vietnamese
  en: string; // English
  vi: string; // Vietnamese
  rad: string; // radical breakdown
  mn: string; // mnemonic
  ex: string; // primary example (space separated)
  exvi: string; // primary example Vietnamese
  exs: [string, string][]; // list of examples
}

export interface WordProgress {
  box: number;
  due: number;
  wrong: number;
  n?: number;
  first?: string;
  last?: string;
  fav?: boolean;
}

export interface DayLog {
  n: number;
  ok: number;
}

export interface LogMap {
  _g?: number;
  _nw?: number;
  [date: string]: DayLog | number | undefined;
}

export interface TestRecord {
  d: string;
  pct: number;
  n: number;
}

export interface PersistedData {
  w: Word[];
  p: Record<string, WordProgress>;
  log: LogMap;
  tests: TestRecord[];
}

export interface SyncConfig {
  u?: string;
  k?: string;
  c?: string;
}

export type WordMasteryStatus = 'Mới' | 'Đang học' | 'Thuộc' | 'Chưa nhớ';

export interface HskQuestion {
  w: Word;
  sec: string;
  qHtml?: string;
  promptTitle: string;
  promptSub?: string;
  promptZh?: string;
  say?: string;
  zhOpts?: boolean;
  opts: string[];
  a: number;
  exp: string;
}

export interface AiAutofillItem {
  lesson: string;
  hanzi: string;
  pinyin: string;
  pos: string;
  hanViet: string;
  english: string;
  vietnamese: string;
  radical: string;
  mnemonic: string;
  exampleZhSpaced: string;
  exampleVi: string;
}

export interface GrammarExample {
  zh: string;
  py: string;
  vi: string;
}

export interface GrammarPoint {
  title: string;
  formula: string;
  explanation: string;
  examples: GrammarExample[];
}

export interface GrammarExercise {
  question: string;
  promptZh: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GrammarLessonSummary {
  grammarPoints: GrammarPoint[];
  exercises: GrammarExercise[];
}

export interface DeepRadicalPart {
  part: string;
  name: string;
  meaning: string;
}

export interface DeepCharAnalysis {
  char: string;
  pinyin: string;
  hanViet: string;
  radical: string;
  radicalMeaning: string;
  strokeCount: number;
  structure: string;
  liuShu: string;
  components: DeepRadicalPart[];
}

export interface DeepCollocation {
  zh: string;
  py: string;
  vi: string;
}

export interface DeepRelatedWord {
  zh: string;
  py: string;
  hv: string;
  vi: string;
}

export interface DeepConfusableComparison {
  compareWord: string;
  comparePinyin: string;
  compareHanViet: string;
  compareMeaning: string;
  similarity: string;
  difference: string;
  exampleTargetZh: string;
  exampleTargetPy: string;
  exampleTargetVi: string;
  exampleCompareZh: string;
  exampleComparePy: string;
  exampleCompareVi: string;
}

export interface DeepWordAnalysis {
  hanzi: string;
  pinyin: string;
  pos: string;
  hanViet: string;
  english: string;
  vietnamese: string;
  totalStrokes: number;
  tonesSummary: string;
  decompositionFormula: string;
  chars: DeepCharAnalysis[];
  mnemonicStory: string;
  exampleZhSpaced: string;
  exampleVi: string;
  collocations: DeepCollocation[];
  compounds: DeepRelatedWord[];
  synonyms: DeepRelatedWord[];
  antonyms: DeepRelatedWord[];
  confusable?: DeepConfusableComparison;
  updatedAt?: number;
}

