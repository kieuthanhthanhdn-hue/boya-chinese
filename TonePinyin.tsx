import { splitPinyinTokens, TONE_STYLE } from '../utils/pinyin';

interface TonePinyinProps {
  pinyin: string;
  className?: string;
  showLegend?: boolean;
}

export function TonePinyin({
  pinyin,
  className = '',
  showLegend = false,
}: TonePinyinProps) {
  const tokens = splitPinyinTokens(pinyin);

  return (
    <div className="inline-flex flex-col gap-1">
      <span className={`inline-flex flex-wrap items-baseline ${className}`}>
        {tokens.map((tok, idx) => (
          <span
            key={idx}
            className={tok.isWord ? TONE_STYLE[tok.tone].text : 'text-[#616b66]'}
          >
            {tok.text}
          </span>
        ))}
      </span>
      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#616b66]">
          {([1, 2, 3, 4] as const).map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${TONE_STYLE[t].dot}`} />
              <span>Thanh {t}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
