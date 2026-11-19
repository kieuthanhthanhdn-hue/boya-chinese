import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-1.5 rounded-xl bg-[#1f7a63] font-semibold text-white transition-colors hover:bg-[#186250] whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        <Download className="h-3.5 w-3.5" />
        <span>Cài App (PWA)</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-[#e6e2da] bg-white font-medium text-[#1c2421] transition-colors hover:bg-[#f3f0eb] whitespace-nowrap shrink-0 ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
          }`}
        >
          <Share className="h-3.5 w-3.5 text-[#1f7a63]" />
          <span>Ghim ra màn hình</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-[#e6e2da] bg-white p-6 shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-[#1c2421]">
                  Ghim Boya 3.0 ra màn hình chính
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1 text-[#616b66] hover:bg-[#f3f0eb]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="space-y-2 text-sm text-[#616b66] list-decimal pl-4">
                <li>
                  Chạm nút <strong className="text-[#1c2421]">Chia sẻ (Share)</strong> ở thanh công cụ Safari.
                </li>
                <li>
                  Cuộn xuống và chọn{' '}
                  <strong className="text-[#1c2421]">Thêm vào MH chính (Add to Home Screen)</strong>.
                </li>
                <li>
                  Ứng dụng sẽ mở ở chế độ toàn màn hình không thanh địa chỉ.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-[#1f7a63] py-2.5 text-sm font-semibold text-white hover:bg-[#186250]"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
