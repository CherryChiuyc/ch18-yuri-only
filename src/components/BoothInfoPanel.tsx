// src/components/BoothInfoPanel.tsx
import React from "react";

type Props = {
  spotId: string | null;
  error?: string | null;
  onClose?: () => void;   // 手機彈窗用
  variant?: "desktop" | "mobile";
};

export default function BoothInfoPanel({
  spotId,
  error,
  onClose,
  variant = "desktop",
}: Props) {
  const Body = (
    <>
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : spotId ? (
        <p className="text-gray-900">
          你選取的攤位是：<strong>{spotId}</strong>
        </p>
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
