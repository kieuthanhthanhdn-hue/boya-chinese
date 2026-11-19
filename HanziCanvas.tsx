import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { Eye, RotateCcw, CheckCircle2 } from 'lucide-react';

interface HanziCanvasProps {
  hanzi: string;
  size?: number;
  gridType?: 'tian' | 'mi';
  actionTrigger?: { type: 'animate' | 'quiz'; seq: number } | null;
  onComplete?: () => void;
}

export function HanziCanvas({
  hanzi,
  size = 148,
  gridType = 'tian',
  actionTrigger = null,
  onComplete,
}: HanziCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const writersRef = useRef<HanziWriter[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>('Vẽ từng nét theo hướng dẫn');
  const [completed, setCompleted] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const chars = [...hanzi].filter((c) => /[\u4e00-\u9fff]/.test(c));

  const startQuiz = (writers: HanziWriter[]) => {
    setCompleted(false);
    setStatusMsg('Vẽ từng nét theo thứ tự chuẩn');
    let doneCount = 0;
    writers.forEach((writer) => {
      writer.quiz({
        onComplete: () => {
          doneCount += 1;
          if (doneCount === writers.length) {
            setCompleted(true);
            setStatusMsg('Hoàn thành chính xác tất cả các nét.');
            onComplete?.();
          }
        },
      });
    });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';
    writersRef.current = [];
    setCompleted(false);
    setLoadError(false);

    if (chars.length === 0) {
      setStatusMsg('Từ này không có chữ Hán để tập viết.');
      return;
    }

    const diagLines =
      gridType === 'mi'
        ? `<line x1="0" y1="0" x2="100" y2="100" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="0.8"/><line x1="100" y1="0" x2="0" y2="100" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="0.8"/>`
        : '';

    const created: HanziWriter[] = chars.map((c) => {
      const box = document.createElement('div');
      box.className =
        'rounded-xl border border-[#d6d0c4] bg-[#faf9f7] shadow-inner overflow-hidden relative';
      box.style.width = `${size}px`;
      box.style.height = `${size}px`;
      // Điền tự (田) or Mễ tự (米) grid SVG lines
      box.innerHTML = `<svg width="${size}" height="${size}" class="pointer-events-none absolute inset-0 opacity-60" viewBox="0 0 100 100"><line x1="50" y1="0" x2="50" y2="100" stroke="#c8c0b4" stroke-dasharray="3,3" stroke-width="1"/><line x1="0" y1="50" x2="100" y2="50" stroke="#c8c0b4" stroke-dasharray="3,3" stroke-width="1"/>${diagLines}</svg>`;
      el.appendChild(box);

      return HanziWriter.create(box, c, {
        width: size,
        height: size,
        padding: 10,
        showOutline: true,
        strokeColor: '#1f7a63',
        radicalColor: '#d96b43',
        outlineColor: '#dcd7cd',
        drawingColor: '#1c2421',
        drawingWidth: 16,
        showHintAfterMisses: 2,
        onLoadCharDataError: () => {
          setLoadError(true);
          setStatusMsg('Không tải được dữ liệu nét chữ (cần kết nối Internet).');
        },
      });
    });

    writersRef.current = created;
    startQuiz(created);

    return () => {
      writersRef.current = [];
      if (el) el.innerHTML = '';
    };
  }, [hanzi, size, gridType]);

  const handleAnimate = () => {
    setStatusMsg('Đang chạy thứ tự nét viết (Bút thuận)...');
    writersRef.current.forEach((w) => w.animateCharacter());
  };

  const handleReset = () => {
    if (writersRef.current.length > 0) {
      startQuiz(writersRef.current);
    }
  };

  useEffect(() => {
    if (!actionTrigger || writersRef.current.length === 0) return;
    if (actionTrigger.type === 'animate') {
      handleAnimate();
    } else {
      handleReset();
    }
  }, [actionTrigger?.seq]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
        ref={containerRef}
        className="flex flex-wrap items-center justify-center gap-3"
      />
      <div className="flex items-center gap-2 text-xs text-[#616b66]">
        {completed && <CheckCircle2 className="h-4 w-4 text-[#1f7a63]" />}
        <span className={loadError ? 'text-[#b8352b]' : ''}>{statusMsg}</span>
      </div>
      {chars.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAnimate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-white px-3.5 py-2 text-xs font-medium text-[#1c2421] transition-colors hover:bg-[#f3f0eb] min-h-[36px] whitespace-nowrap"
          >
            <Eye className="h-3.5 w-3.5 text-[#1f7a63]" />
            Xem bút thuận
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-white px-3.5 py-2 text-xs font-medium text-[#1c2421] transition-colors hover:bg-[#f3f0eb] min-h-[36px] whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#d96b43]" />
            Luyện viết lại
          </button>
        </div>
      )}
    </div>
  );
}
