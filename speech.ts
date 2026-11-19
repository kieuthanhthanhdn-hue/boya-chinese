export type SpeechSpeed = 0.7 | 1.0;
export type SpeechSource = 'youdao' | 'google' | 'browser';

declare global {
  interface Window {
    __currentUtterance?: SpeechSynthesisUtterance | null;
  }
}

const SPEED_KEY = 'hvspeed';
const VOICE_KEY = 'hvvoice';
const SOURCE_KEY = 'hvvoice_src';
const ONLINE_TTS_TIMEOUT_MS = 2000;
const SYNTH_SPEAK_DELAY_MS = 60;
const HIDDEN_AUDIO_ID = 'boya-tts-audio';

export const SPEECH_SOURCE_OPTIONS: {
  id: SpeechSource;
  label: string;
  description: string;
}[] = [
  {
    id: 'youdao',
    label: 'Nguồn 1 (Mặc định) · Youdao TTS',
    description: 'Giọng nữ phổ thông Bắc Kinh chuẩn bản xứ, tự nhiên (Online)',
  },
  {
    id: 'google',
    label: 'Nguồn 2 (Dự phòng) · Google TTS',
    description: 'Giọng đọc trực tuyến Google zh-CN (Online)',
  },
  {
    id: 'browser',
    label: 'Nguồn 3 (Offline) · Giọng trình duyệt',
    description: 'Dùng giọng cài sẵn trên máy khi mất mạng hoặc tự chọn giọng',
  },
];

let cachedVoices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

let sharedAudioEl: HTMLAudioElement | null = null;
let activeFallbackTimer: number | null = null;
let activeSynthTimer: number | null = null;
let playbackGen = 0;

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const next = window.speechSynthesis.getVoices();
  if (next.length > 0) {
    cachedVoices = next;
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  const handleVoicesChanged = () => {
    refreshVoices();
    listeners.forEach((cb) => cb());
  };
  window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
  window.speechSynthesis.addEventListener?.('voiceschanged', handleVoicesChanged);
}

export function subscribeVoicesChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSharedAudioElement(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null;

  if (sharedAudioEl && document.body?.contains(sharedAudioEl)) {
    return sharedAudioEl;
  }

  const existing = document.getElementById(HIDDEN_AUDIO_ID);
  if (existing instanceof HTMLAudioElement) {
    sharedAudioEl = existing;
    return sharedAudioEl;
  }

  const audio = document.createElement('audio');
  audio.id = HIDDEN_AUDIO_ID;
  audio.style.display = 'none';
  audio.setAttribute('aria-hidden', 'true');
  audio.setAttribute('playsinline', 'true');
  audio.setAttribute('webkit-playsinline', 'true');
  audio.setAttribute('referrerpolicy', 'no-referrer');
  (audio as HTMLAudioElement & { referrerPolicy?: string }).referrerPolicy =
    'no-referrer';
  audio.preload = 'auto';

  if (document.body) {
    document.body.appendChild(audio);
  }
  sharedAudioEl = audio;
  return sharedAudioEl;
}

function detachAudioHandlers(audio: HTMLAudioElement): void {
  audio.onloadeddata = null;
  audio.onloadedmetadata = null;
  audio.onplaying = null;
  audio.ontimeupdate = null;
  audio.onended = null;
  audio.onerror = null;
}

function normalizeChineseInput(raw: string): string {
  return (raw || '')
    // Convert elliptical grammar patterns like 太……了 / 太...了 / 太＿＿了 -> 太好了
    .replace(/太\s*(?:…+|\.{2,}|＿+|_+|～+|~+)\s*了/g, '太好了')
    // Remove remaining ellipses, blanks, underscores, tildes so TTS never reads them aloud
    .replace(/(?:…+|\.{2,}|＿+|_+|～+|~+)/g, '')
    // Keep strictly Chinese Hanzi and standard Chinese punctuation, removing all spaces
    .replace(/[^\u4e00-\u9fff，。？！、；：]/g, '')
    // Collapse duplicate punctuation and strip stray leading punctuation
    .replace(/([，。？！、；：])\1+/g, '$1')
    .replace(/^[，。？！、；：]+/, '')
    .trim();
}

/**
 * Clean Chinese text strictly before TTS:
 * - Converts patterns like 太……了 -> 太好了
 * - Strips parenthetical Pinyin/Vietnamese notes
 * - Keeps ONLY [\u4e00-\u9fff，。？！、；：] and removes all spaces between words
 */
export function extractPureChinese(text: string): string {
  const withoutParens = (text || '').replace(/\([^)]*\)|（[^）]*）/g, '');
  const cleaned = normalizeChineseInput(withoutParens);
  if (cleaned) return cleaned;
  return normalizeChineseInput(text || '');
}

export function getSavedSpeechSource(): SpeechSource {
  try {
    const val = localStorage.getItem(SOURCE_KEY);
    if (val === 'youdao' || val === 'google' || val === 'browser') {
      return val;
    }
  } catch {
    // ignore
  }
  return 'youdao';
}

export function saveSpeechSource(source: SpeechSource): void {
  try {
    localStorage.setItem(SOURCE_KEY, source);
  } catch {
    // ignore
  }
}

export function getSavedVoiceUri(): string {
  try {
    return localStorage.getItem(VOICE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveVoiceUri(uri: string): void {
  try {
    if (!uri) localStorage.removeItem(VOICE_KEY);
    else localStorage.setItem(VOICE_KEY, uri);
  } catch {
    // ignore
  }
}

const PREFERRED_VOICE_KEYWORDS = [
  'tingting',
  'ting-ting',
  'google 普通话',
  'microsoft xiaoxiao',
  'microsoft yunxi',
  'microsoft huihui',
  'meijia',
  'yushu',
  'sinji',
];

function voicePriorityScore(v: SpeechSynthesisVoice): number {
  const name = (v.name || '').toLowerCase();
  const lang = (v.lang || '').toLowerCase().replace('_', '-');

  let score = 0;
  if (lang === 'zh-cn' || lang === 'zh-hans-cn' || lang === 'cmn-hans-cn') {
    score += 100;
  } else if (lang.startsWith('zh') || lang.includes('cmn')) {
    score += 40;
  }

  for (let i = 0; i < PREFERRED_VOICE_KEYWORDS.length; i++) {
    if (name.includes(PREFERRED_VOICE_KEYWORDS[i])) {
      score += 50 - i * 3;
      break;
    }
  }

  if (v.localService) score += 5;
  return score;
}

export function getAvailableChineseVoices(): SpeechSynthesisVoice[] {
  const voices = refreshVoices();
  return voices
    .filter((v) => {
      const lang = (v.lang || '').toLowerCase();
      return lang.startsWith('zh') || lang.includes('cmn');
    })
    .sort((a, b) => voicePriorityScore(b) - voicePriorityScore(a));
}

export function pickBestChineseVoice(): SpeechSynthesisVoice | null {
  const zhVoices = getAvailableChineseVoices();
  if (!zhVoices.length) return null;

  const savedUri = getSavedVoiceUri();
  if (savedUri) {
    const chosen = zhVoices.find(
      (v) => v.voiceURI === savedUri || v.name === savedUri
    );
    if (chosen) return chosen;
  }

  return zhVoices[0];
}

export function getSavedSpeechSpeed(): SpeechSpeed {
  try {
    const v = localStorage.getItem(SPEED_KEY);
    return v === '0.7' ? 0.7 : 1.0;
  } catch {
    return 1.0;
  }
}

export function saveSpeechSpeed(speed: SpeechSpeed): void {
  try {
    localStorage.setItem(SPEED_KEY, String(speed));
  } catch {
    // ignore
  }
}

function clearFallbackTimer(): void {
  if (activeFallbackTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(activeFallbackTimer);
    activeFallbackTimer = null;
  }
}

function clearSynthTimer(): void {
  if (activeSynthTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(activeSynthTimer);
    activeSynthTimer = null;
  }
}

function pauseSharedAudio(): void {
  clearFallbackTimer();
  if (sharedAudioEl) {
    try {
      detachAudioHandlers(sharedAudioEl);
      sharedAudioEl.pause();
    } catch {
      // ignore pause errors
    }
  }
}

export function stopSpeech(): void {
  playbackGen += 1;
  pauseSharedAudio();
  clearSynthTimer();
  try {
    if (typeof window !== 'undefined') {
      window.__currentUtterance = null;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Browser speechSynthesis fallback with Chrome/Safari anti-hang & anti-GC fixes:
 * - Calls cancel() + resume(), then waits 60ms via setTimeout before speak()
 * - Keeps utterance referenced on window.__currentUtterance to prevent premature GC
 */
function speakWithBrowser(
  pureChinese: string,
  speed: SpeechSpeed,
  gen: number
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (gen !== playbackGen) return;

  try {
    const synth = window.speechSynthesis;
    clearSynthTimer();
    synth.cancel();
    synth.resume();

    activeSynthTimer = window.setTimeout(() => {
      activeSynthTimer = null;
      if (gen !== playbackGen) return;
      try {
        synth.resume();
        const utter = new SpeechSynthesisUtterance(pureChinese);
        utter.lang = 'zh-CN';

        const voice = pickBestChineseVoice();
        if (voice) {
          utter.voice = voice;
          utter.lang = voice.lang || 'zh-CN';
        }

        utter.rate = speed === 0.7 ? 0.7 : 1.0;
        utter.pitch = 1.0;

        utter.onend = () => {
          if (window.__currentUtterance === utter) {
            window.__currentUtterance = null;
          }
        };
        utter.onerror = () => {
          if (window.__currentUtterance === utter) {
            window.__currentUtterance = null;
          }
        };

        // Keep global reference to prevent browser Garbage Collection mid-speech
        window.__currentUtterance = utter;
        synth.speak(utter);
      } catch {
        // ignore synthesis errors
      }
    }, SYNTH_SPEAK_DELAY_MS);
  } catch {
    // ignore unsupported environments
  }
}

function buildOnlineTtsUrl(
  source: 'youdao' | 'google',
  cleanHanzi: string
): string {
  const encoded = encodeURIComponent(cleanHanzi);
  if (source === 'youdao') {
    return `https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`;
  }
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=${encoded}`;
}

function getFallbackChain(primary: SpeechSource): SpeechSource[] {
  const isOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  if (isOffline || primary === 'browser') {
    return ['browser'];
  }
  if (primary === 'youdao') {
    return ['youdao', 'google', 'browser'];
  }
  return ['google', 'browser'];
}

function playFromChain(
  chain: SpeechSource[],
  index: number,
  cleanHanzi: string,
  speed: SpeechSpeed,
  gen: number
): void {
  if (gen !== playbackGen || index >= chain.length) return;

  const currentSource = chain[index];
  if (currentSource === 'browser') {
    pauseSharedAudio();
    speakWithBrowser(cleanHanzi, speed, gen);
    return;
  }

  const audio = getSharedAudioElement();
  if (!audio) {
    speakWithBrowser(cleanHanzi, speed, gen);
    return;
  }

  pauseSharedAudio();

  let settled = false;
  let hasStartedPlaying = false;

  const applySpeed = () => {
    if (gen !== playbackGen) return;
    try {
      audio.defaultPlaybackRate = speed;
      audio.playbackRate = speed;
    } catch {
      // ignore
    }
  };

  const triggerFallback = () => {
    if (settled || gen !== playbackGen) return;
    settled = true;
    pauseSharedAudio();
    playFromChain(chain, index + 1, cleanHanzi, speed, gen);
  };

  // Ensure no-referrer policy on the single persistent hidden <audio> element
  audio.setAttribute('referrerpolicy', 'no-referrer');
  (audio as HTMLAudioElement & { referrerPolicy?: string }).referrerPolicy =
    'no-referrer';

  // Preserve playbackRate at init, loadeddata, loadedmetadata, and playing
  applySpeed();

  audio.onloadeddata = () => {
    applySpeed();
  };

  audio.onloadedmetadata = () => {
    applySpeed();
  };

  audio.onplaying = () => {
    if (gen !== playbackGen) return;
    hasStartedPlaying = true;
    clearFallbackTimer();
    applySpeed();
  };

  audio.ontimeupdate = () => {
    if (gen !== playbackGen) return;
    if (audio.currentTime > 0 && !hasStartedPlaying) {
      hasStartedPlaying = true;
      clearFallbackTimer();
    }
  };

  audio.onended = () => {
    if (gen !== playbackGen) return;
    // Catch silent/empty audio responses returned by online TTS
    if (
      !hasStartedPlaying ||
      (Number.isFinite(audio.duration) && audio.duration < 0.05)
    ) {
      triggerFallback();
      return;
    }
    settled = true;
    clearFallbackTimer();
    detachAudioHandlers(audio);
  };

  // Protection layer 1: audio.onerror
  audio.onerror = () => {
    triggerFallback();
  };

  // Protection layer 3: 2s max wait before auto-fallback
  if (typeof window !== 'undefined') {
    activeFallbackTimer = window.setTimeout(() => {
      if (!settled && !hasStartedPlaying && gen === playbackGen) {
        triggerFallback();
      }
    }, ONLINE_TTS_TIMEOUT_MS);
  }

  // Assign new URL on the single hidden <audio> DOM element and play
  const url = buildOnlineTtsUrl(currentSource, cleanHanzi);
  audio.src = url;
  applySpeed();

  // Protection layer 2: audio.play().catch(...)
  try {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        triggerFallback();
      });
    }
  } catch {
    triggerFallback();
  }
}

/**
 * Single unified Chinese TTS entry point across the entire application.
 */
export function speakZh(text: string, speed: SpeechSpeed = 1.0): void {
  const cleanHanzi = extractPureChinese(text);
  if (!cleanHanzi) return;

  stopSpeech();
  const gen = playbackGen;
  const preferred = getSavedSpeechSource();
  const chain = getFallbackChain(preferred);
  playFromChain(chain, 0, cleanHanzi, speed, gen);
}

export const say = speakZh;
