// src/components/Map.tsx
import { useEffect, useRef, useState } from "react";
import { loadStalls, type BoothMap } from "../lib/loadStalls";
import BoothInfoPanel from "./BoothInfoPanel";

export default function VenueMap() {
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<string | null>(null);
  const [boothMap, setBoothMap] = useState<BoothMap>(new Map<string,string>());
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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

  // 讀 CSV → 建立攤位對照表
  useEffect(() => {
    loadStalls()
      .then((m) => setBoothMap(m))
      .catch((err) => {
        console.warn(err);
      });
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

    // 讓 <svg> 在容器內自適應，不要把右欄頂住
    const svgEl = host.querySelector("svg") as SVGSVGElement | null;
    if (svgEl) {
      svgEl.removeAttribute("width");
      svgEl.removeAttribute("height");
      svgEl.style.width = "100%";
      svgEl.style.height = "auto";
      svgEl.style.display = "block";
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    const norm = (s: string | number | null | undefined) =>
      (s ?? "").toString().trim().toUpperCase();

    const getRectEl = (t: EventTarget | null) =>
      (t as Element | null)?.closest("rect[id]") as SVGRectElement | null;

    // ------- 點擊：維持你原本的選取行為 -------
    const handleClick = (e: MouseEvent) => {
      const rectEl = getRectEl(e.target);
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

    // ------- hover：顯示 tooltip（游標旁） -------
    const tt = tooltipRef.current!;
    const pad = 8;
    const offset = 12;

    function showTooltip(text: string) {
      tt.textContent = text;
      tt.style.opacity = "1";
      tt.setAttribute("aria-hidden", "false");
    }
    function hideTooltip() {
      tt.style.opacity = "0";
      tt.setAttribute("aria-hidden", "true");
    }
    function place(x: number, y: number) {
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;

      // 先臨時顯示拿尺寸
      tt.style.left = "0px";
      tt.style.top = "0px";
      tt.style.opacity = tt.style.opacity || "1";
      const r = tt.getBoundingClientRect();

      let left = x + offset;
      let top = y + offset;
      if (left + r.width + pad > vpW) left = x - r.width - offset;
      if (top + r.height + pad > vpH) top = y - r.height - offset;
      left = Math.max(pad, Math.min(left, vpW - r.width - pad));
      top = Math.max(pad, Math.min(top, vpH - r.height - pad));

      tt.style.left = `${left}px`;
      tt.style.top = `${top}px`;
    }

    // 用 mouseover / mouseout（事件代理）確保性能
    const handleOver = (e: MouseEvent) => {
      const rectEl = getRectEl(e.target);
      if (!rectEl?.id) return;
      const key = norm(rectEl.id);
      const name = boothMap.get(key) || `攤位：${key}`;
      showTooltip(name);
      place(e.clientX, e.clientY);
    };
    const handleMove = (e: MouseEvent) => {
      if (tt.getAttribute("aria-hidden") === "true") return;
      place(e.clientX, e.clientY);
    };
    const handleOut = (e: MouseEvent) => {
      const rectEl = getRectEl(e.target);
      if (!rectEl) return;
      hideTooltip();
    };

    host.addEventListener("click", handleClick);
    host.addEventListener("mouseover", handleOver);
    host.addEventListener("mousemove", handleMove);
    host.addEventListener("mouseout", handleOut);

    return () => {
      host.removeEventListener("click", handleClick);
      host.removeEventListener("mouseover", handleOver);
      host.removeEventListener("mousemove", handleMove);
      host.removeEventListener("mouseout", handleOut);
    };
  }, [svgHtml, error, boothMap]); // 注意：不把 activeSpot 放入依賴，避免重寫 SVG

  return (
    <div className="
      grid grid-cols-1
      md:grid-cols-[minmax(0,7fr)_minmax(380px,3fr)]
      xl:grid-cols-[minmax(0,8fr)_minmax(400px,3fr)]
      2xl:grid-cols-[minmax(0,9fr)_minmax(420px,3fr)]
      md:gap-x-5 gap-y-4
    ">
      {/* 左：地圖（加 overflow-hidden） */}
      <div
        ref={containerRef}
        className="bg-white rounded-2xl shadow p-2 min-h-[300px] overflow-hidden"
      />

      {/* 固定定位 tooltip（照舊） */}
      <div ref={tooltipRef} className="fixed z-[9999] pointer-events-none px-2.5 py-1.5 rounded-lg shadow text-sm text-white"
        style={{ background:"rgba(0,0,0,0.8)", opacity:0, transition:"opacity 120ms ease",
                left:0, top:0, maxWidth:"min(60vw,24rem)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}
        role="tooltip" aria-hidden="true" />

      {/* 桌面：右側固定資訊欄 */}
      <aside className="hidden md:block">
        <BoothInfoPanel spotId={activeSpot} error={error} />
      </aside>

      {/* 手機：有選取時才顯示彈窗 + 背景可點關閉 */}
      {activeSpot && (
        <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setActiveSpot(null)}
          />
          <BoothInfoPanel
            spotId={activeSpot}
            error={error}
            onClose={() => setActiveSpot(null)}
            variant="mobile"
          />
        </div>
      )}
    </div>
  );
}
