// src/components/Map.tsx
import { useEffect, useRef, useState } from "react";

export default function Map() {
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 讀取 SVG 並把互動樣式注入到 <svg> 內部
  useEffect(() => {
    fetch("/map/venue.svg", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("SVG 載入失敗");
        return r.text();
      })
      .then((raw) => setSvgHtml(injectStyle(raw)))
      .catch(() => setError("無法載入場地地圖（SVG）。"));
  }, []);

  function injectStyle(src: string) {
    const m = src.match(/<svg[\s\S]*?>/i);
    if (!m || m.index == null) return src;
    const head = m[0];
    const insertAt = (m.index as number) + head.length;

    const style = `
      <style>
        /* 只讓攤位可點，避免透明覆蓋攔截 */
        svg *:not(rect) { pointer-events: none; }
        rect[id] { pointer-events: auto; cursor: pointer; transition: fill 120ms ease; }

        /* 文字不攔事件、不可被選取 */
        text { pointer-events: none; user-select: none; }

        /* 若無填色/是 none，給白底避免 hover 看不到 */
        rect[id][fill="none"], rect[id]:not([fill]) { fill: #ffffff; }

        /* hover：淺黃（提示） */
        rect[id]:hover { fill: #ffeb99 !important; }

        /* 選取：深黃；且已選取時 hover 不覆蓋 */
        rect[id][data-selected="true"],
        rect[id][data-selected="true"]:hover { fill: #fdd835 !important; }
      </style>
    `;
    return src.slice(0, insertAt) + style + src.slice(insertAt);
  }

  // 一次性掛載 SVG，之後不 re-render SVG DOM；事件代理只改 data-selected，不動 inline style
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    host.innerHTML =
      svgHtml ||
      (error
        ? `<div style="padding:1rem;color:#c00;">${error}</div>`
        : `<div style="padding:1rem;color:#888;">載入場地圖中…</div>`);

    if (!svgHtml) return;

    const handleClick = (e: MouseEvent) => {
      const rectEl = (e.target as Element)?.closest("rect[id]") as SVGRectElement | null;
      if (!rectEl?.id) return;

      const already = rectEl.getAttribute("data-selected") === "true";

      // 清掉所有舊選取（⚠️ 不改 style，只移除 data-selected）
      host
        .querySelectorAll<SVGRectElement>("rect[id][data-selected='true']")
        .forEach((el) => el.removeAttribute("data-selected"));

      if (already) {
        setActiveSpot(null); // 再點同一格 → 取消選取
      } else {
        rectEl.setAttribute("data-selected", "true"); // 單點擊立即深黃（由 CSS 控制）
        setActiveSpot(rectEl.id);
      }
    };

    host.addEventListener("click", handleClick);
    return () => host.removeEventListener("click", handleClick);
  }, [svgHtml, error]); // 重要：不要把 activeSpot 加進依賴，避免重寫 SVG

  return (
    <div className="grid md:grid-cols-[1fr_360px] gap-4">
      {/* 左側：地圖（SVG 由上面的 effect 寫入，不用 dangerouslySetInnerHTML） */}
      <div ref={containerRef} className="bg-white rounded-2xl shadow p-2 min-h-[300px]" />

      {/* 右側：資訊區 */}
      <aside className="bg-white rounded-2xl shadow p-4">
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : activeSpot ? (
          <p className="text-gray-900">
            你選取的攤位是：<strong>{activeSpot}</strong>
          </p>
        ) : (
          <p className="text-gray-500">請點地圖上的攤位查看資訊。</p>
        )}
      </aside>
    </div>
  );
}
