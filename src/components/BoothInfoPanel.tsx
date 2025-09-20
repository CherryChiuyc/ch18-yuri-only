// src/components/BoothInfoPanel.tsx
import type { BoothRow } from "../lib/loadStalls";

type Props = {
  booth: BoothRow | null;
  error?: string | null;
  onClose?: () => void;   // 手機彈窗用
  variant?: "desktop" | "mobile";
};

export default function BoothInfoPanel({
  booth,
  error,
  onClose,
  variant = "desktop",
}: Props) {
  const Body = (
    <>
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : booth ? (
        <div className="space-y-3">
          {/* 社團名稱：大標題（可點） */}
          {booth.name && (
            booth.url ? (
              <a
                href={booth.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block font-bold text-2xl md:text-3xl text-gray-900 leading-tight underline underline-offset-4 hover:text-blue-700"
                title={booth.name}
              >
                {booth.name}
              </a>
            ) : (
              <h2 className="font-bold text-2xl md:text-3xl text-gray-900 leading-tight">
                {booth.name}
              </h2>
            )
          )}

          {/* 攤位編號：次要資訊 */}
          <div className="text-base md:text-lg text-gray-700">
            攤位編號：<span className="font-mono">{booth.rawId || booth.id}</span>
          </div>
          <div className="mt-3">
            <img
                src={`/event_pics/${(booth.rawId || booth.id).toUpperCase()}.jpg`}
                alt={booth.name || booth.rawId}
                className="rounded-lg w-full max-h-[500px] object-contain"
                onError={(e) => {
                // 如果找不到 jpg，可以試 png
                (e.currentTarget as HTMLImageElement).src =
                    `/event_pics/${(booth.rawId || booth.id).toUpperCase()}.png`;
                }}
            />
          </div>
        </div>
      ) : (
        <p className="text-gray-500">請點地圖上的攤位查看資訊。</p>
      )}
    </>
  );

  if (variant === "mobile") {
    // 手機：彈窗卡片
    return (
      <div className="relative bg-white rounded-2xl shadow-lg w-11/12 max-h-[80vh] overflow-auto p-4 z-10">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
          aria-label="關閉"
        >
          ✕
        </button>
        {Body}
      </div>
    );
  }

  // 桌面：右側固定側欄
  return (
    <aside className="bg-white rounded-2xl shadow p-4 sticky top-4 max-h-[calc(100dvh-2rem)] overflow-auto">
      {Body}
    </aside>
  );
}
