import { useMemo, useState } from "react";
import type { BoothRow } from "../lib/loadStalls";

type Props = {
  booth: BoothRow | null;
  error?: string | null;
  onClose?: () => void;
  variant?: "desktop" | "mobile";
};

export default function BoothInfoPanel({ booth, error, onClose, variant = "desktop" }: Props) {
  const exts = [".jpg", ".png", ".jpeg"];
  const [imgIdx, setImgIdx] = useState(0);
  const imgPath = useMemo(() => {
    if (!booth) return "";
    const key = (booth.rawId || booth.id).toUpperCase();
    return `/event_pics/${key}${exts[Math.min(imgIdx, exts.length - 1)]}`;
  }, [booth, imgIdx]);

  const Body = (
    <>
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : booth ? (
        <div className="space-y-3">
          {booth.name && (
            booth.url ? (
              <a href={booth.url} target="_blank" rel="noopener noreferrer"
                 className="block font-bold text-2xl md:text-3xl text-gray-900 leading-tight underline underline-offset-4 hover:text-blue-700 cursor-pointer">
                {booth.name}
              </a>
            ) : (
              <h2 className="font-bold text-2xl md:text-3xl text-gray-900 leading-tight">{booth.name}</h2>
            )
          )}
          <div className="text-base md:text-lg text-gray-700">
            攤位編號：<span className="font-mono">{booth.rawId || booth.id}</span>
          </div>
          {imgPath && (
            <div className="mt-3">
              <img
                src={imgPath}
                alt={booth.name || booth.rawId}
                className="rounded-lg w-full max-h-[500px] object-contain"
                onError={() => setImgIdx((i) => Math.min(i + 1, exts.length - 1))}
              />
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500">請點地圖上的攤位查看資訊。</p>
      )}
    </>
  );

  if (variant === "mobile") {
    return (
      <div
        className="
          relative bg-white rounded-2xl shadow-lg
          w-full max-w-[640px] max-h-full
          overflow-y-auto overscroll-contain
          p-4
        "
      >
        <button
          onClick={onClose}
          className="sticky top-0 ml-auto block text-right text-gray-500 hover:text-gray-800 text-2xl"
          aria-label="關閉"
        >
          ✕
        </button>
        {Body}
      </div>
    );
  }

  return (
    <aside className="bg-white rounded-2xl shadow p-4 sticky top-4 max-h-[calc(100dvh-2rem)] overflow-auto">
      {Body}
    </aside>
  );
}
