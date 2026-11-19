import { Volume2 } from 'lucide-react';
import { speakZh, type SpeechSpeed } from '../utils/speech';

interface SpeechControlProps {
  text: string;
  speed: SpeechSpeed;
  onChangeSpeed: (s: SpeechSpeed) => void;
  label?: string;
  compact?: boolean;
  onClickSpeak?: () => void;
}

export function SpeechControl({
  text,
  speed,
  onChangeSpeed,
  label = 'Nghe',
  compact = false,
  onClickSpeak,
}: SpeechControlProps) {
  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakZh(text, speed);
    onClickSpeak?.();
  };

  const toggleSpeed = (e: React.MouseEvent, next: SpeechSpeed) => {
    e.stopPropagation();
    onChangeSpeed(next);
    if (text) {
      speakZh(text, next);
    }
  };

  return (
    <div
      className="inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleSpeak}
        title="Phát âm (Phím R)"
        className={`inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-white font-medium text-[#1f7a63] transition-colors hover:border-[#1f7a63]/40 hover:bg-[#e3f1ec]/60 focus-visible:outline-2 focus-visible:outline-[#1f7a63] whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-xs min-h-[34px]' : 'px-3.5 py-2 text-sm min-h-[40px]'
        }`}
      >
        <Volume2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {!compact && <span>{label}</span>}
      </button>

      <div
        className="inline-flex items-center rounded-xl border border-[#e6e2da] bg-[#f3f0eb] p-0.5"
        role="group"
        aria-label="Tốc độ đọc"
      >
        <button
          type="button"
          onClick={(e) => toggleSpeed(e, 0.7)}
          className={`rounded-lg px-2 font-mono-num text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            compact ? 'py-1 min-h-[28px]' : 'py-1.5 min-h-[32px]'
          } ${
            speed === 0.7
              ? 'bg-white text-[#d96b43] shadow-xs'
              : 'text-[#616b66] hover:text-[#1c2421]'
          }`}
          title="Đọc chậm 0.7x"
        >
          0.7x
        </button>
        <button
          type="button"
          onClick={(e) => toggleSpeed(e, 1.0)}
          className={`rounded-lg px-2 font-mono-num text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            compact ? 'py-1 min-h-[28px]' : 'py-1.5 min-h-[32px]'
          } ${
            speed === 1.0
              ? 'bg-white text-[#1f7a63] shadow-xs'
              : 'text-[#616b66] hover:text-[#1c2421]'
          }`}
          title="Đọc chuẩn 1.0x"
        >
          1.0x
        </button>
      </div>
    </div>
  );
}
