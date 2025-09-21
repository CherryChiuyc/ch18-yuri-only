// src/components/Map.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadStalls, type BoothMap, type BoothEntry } from "../lib/loadStalls";
import BoothInfoPanel from "./BoothInfoPanel";

type Props = { svgUrl: string; csvUrl?: string };

// 取得 visual viewport 並計算反向縮放比例，確保 overlay 不受頁面縮放影響
function useVisualViewportBox() {
  const [box, setBox] = useState({
    left: 0,
    top: 0,
    layoutW: typeof window !== "undefined" ? window.innerWidth : 0,
    layoutH: typeof window !== "undefined" ? window.innerHeight : 0,
    scale: 1, // = visualViewport.width / window.innerWidth
  });

  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const update = () => {
      const layoutW = window.innerWidth;
      const layoutH = window.innerHeight;
      if (vv) {
        const scale = vv.width / layoutW;
        setBox({ left: vv.offsetLeft, top: vv.offsetTop, layoutW, layoutH, scale });
      } else {
        setBox({ left: 0, top: 0, layoutW, layoutH, scale: 1 });
      }
    };
    update();
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      };
    } else {
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update);
      return () => {
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update);
      };
    }
  }, []);

  return box;
}

// 鎖住 body 捲動（手機彈窗開啟時）
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const { scrollY } = window;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

export default function VenueMap({ svgUrl, csvUrl }: Props) {
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<string | null>(null);
  const [boothMap, setBoothMap] = useState<BoothMap>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (meta) {
      meta.content = "width=device-width, initial-scale=1";
    }
  }, []);
  
  // 讀 SVG
  useEffect(() => {
    fetch(svgUrl, { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("SVG 載入失敗");
        return r.text();
      })
      .then((raw) => setSvgHtml(injectStyle(raw)))
      .catch(() => setError("無法載入場地地圖（SVG）。"));
  }, [svgUrl]);

  // 讀 CSV
  useEffect(() => {
    const url = `/api/stalls?_=${Date.now()}`; // 防快取
    loadStalls(url)
      .then(({ byId }) => {
        setBoothMap(byId);
        setError(null);
      })
      .catch((err) => {
        console.error("loadStalls error:", err);
        setError(err.message || "CSV/HTML 載入失敗");
      });
  }, [csvUrl]);

  // useEffect(() => {
  //   loadStalls("/api/stalls")
  //     .then(({ byId /*, all*/ }) => {
  //       setBoothMap(byId);
  //       // 之後要做搜尋，再把 all 存起來： setAllBooths(all)
  //     })
  //     .catch((err) => setError(err.message || "CSV/HTML 載入失敗"));
  // }, [csvUrl]);

  function injectStyle(src: string) {
    const m = src.match(/<svg[\s\S]*?>/i);
    if (!m || m.index == null) return src;
    const insertAt = (m.index as number) + m[0].length;
    const style = `
      <style>
        svg *:not(rect) { pointer-events: none; }
        rect[id] { pointer-events: auto; cursor: pointer; transition: fill 120ms ease; }
        text { pointer-events: none; user-select: none; }
        rect[id][fill="none"], rect[id]:not([fill]) { fill: #ffffff; }
        rect[id]:hover { fill: #ffeb99 !important; }
        rect[id][data-selected="true"],
        rect[id][data-selected="true"]:hover { fill: #fdd835 !important; }
      </style>
    `;
    return src.slice(0, insertAt) + style + src.slice(insertAt);
  }

  // 把 SVG 放進去、掛事件
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    host.innerHTML =
      svgHtml ||
      (error
        ? `<div style="padding:1rem;color:#c00;">${error}</div>`
        : `<div style="padding:1rem;color:#888;">載入場地圖中…</div>`);

    if (!svgHtml) return;

    const svgEl = host.querySelector("svg") as SVGSVGElement | null;
    if (svgEl) {
      svgEl.removeAttribute("width");
      svgEl.removeAttribute("height");
      svgEl.style.width = "100%";
      svgEl.style.height = "auto";
      svgEl.style.display = "block";
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    const norm = (s: any) => (s ?? "").toString().trim().toUpperCase();
    const getRectEl = (t: EventTarget | null) =>
      (t as Element | null)?.closest("rect[id]") as SVGRectElement | null;

    const handleClick = (e: MouseEvent) => {
      const rectEl = getRectEl(e.target);
      if (!rectEl?.id) return;

      const already = rectEl.getAttribute("data-selected") === "true";
      host
        .querySelectorAll<SVGRectElement>("rect[id][data-selected='true']")
        .forEach((el) => el.removeAttribute("data-selected"));

      if (already) setActiveSpot(null);
      else {
        rectEl.setAttribute("data-selected", "true");
        setActiveSpot(rectEl.id);
      }
    };

    // hover tooltip
    const tt = tooltipRef.current!;
    const pad = 8, offset = 12;
    const show = (txt: string) => { tt.textContent = txt; tt.style.opacity = "1"; tt.setAttribute("aria-hidden","false"); };
    const hide = () => { tt.style.opacity = "0"; tt.setAttribute("aria-hidden","true"); };
    const place = (x:number,y:number) => {
      tt.style.left = "0px"; tt.style.top = "0px";
      const r = tt.getBoundingClientRect(), vpW = innerWidth, vpH = innerHeight;
      let L = x + offset, T = y + offset;
      if (L + r.width + pad > vpW) L = x - r.width - offset;
      if (T + r.height + pad > vpH) T = y - r.height - offset;
      L = Math.max(pad, Math.min(L, vpW - r.width - pad));
      T = Math.max(pad, Math.min(T, vpH - r.height - pad));
      tt.style.left = `${L}px`; tt.style.top = `${T}px`;
    };
    const handleOver = (e: MouseEvent) => {
      const el = getRectEl(e.target);
      if (!el?.id) return;
      const row = boothMap.get(norm(el.id));
      show(row?.name || `攤位：${norm(el.id)}`);
      place(e.clientX, e.clientY);
    };
    const handleMove = (e: MouseEvent) => {
      if (tt.getAttribute("aria-hidden") === "true") return;
      place(e.clientX, e.clientY);
    };

    host.addEventListener("click", handleClick);
    host.addEventListener("mouseover", handleOver);
    host.addEventListener("mousemove", handleMove);
    host.addEventListener("mouseout", hide);
    return () => {
      host.removeEventListener("click", handleClick);
      host.removeEventListener("mouseover", handleOver);
      host.removeEventListener("mousemove", handleMove);
      host.removeEventListener("mouseout", hide);
    };
  }, [svgHtml, error, boothMap]);

  const norm = (s: any) => (s ?? "").toString().trim().toUpperCase();
  const booth: BoothEntry | null = useMemo(
    () => (activeSpot ? boothMap.get(norm(activeSpot)) ?? { id: norm(activeSpot), rawId: activeSpot, items: [] } : null),
    [activeSpot, boothMap]
  );

  // 只有在手機尺寸且有彈窗時鎖住背景
  const isMobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 767.98px)").matches : false;
  useBodyScrollLock(Boolean(activeSpot && isMobile));

  // 用 visual viewport 盒來定位 overlay，並用「反向縮放」抵消頁面縮放
  const vv = useVisualViewportBox();

  return (
    <div
      className="
        grid grid-cols-1
        md:grid-cols-[minmax(0,7fr)_minmax(380px,3fr)]
        xl:grid-cols-[minmax(0,8fr)_minmax(400px,3fr)]
        2xl:grid-cols-[minmax(0,9fr)_minmax(420px,3fr)]
        md:gap-x-5 gap-y-4
      "
    >
      {/* 左：地圖 */}
      <div ref={containerRef} className="bg-white rounded-2xl shadow p-2 min-h-[300px] overflow-hidden" />

      {/* tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] pointer-events-none px-2.5 py-1.5 rounded-lg shadow text-sm text-white"
        style={{ background:"rgba(0,0,0,0.8)", opacity:0, transition:"opacity 120ms ease", left:0, top:0, maxWidth:"min(60vw,24rem)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}
        role="tooltip" aria-hidden="true"
      />

      {/* 桌面：右側固定資訊欄 */}
      <aside className="hidden md:block">
        <BoothInfoPanel booth={booth} error={error} variant="desktop" />
      </aside>

      {/* 手機：body 層級彈窗（固定卡片尺寸；只捲卡片；點空白處可關閉） */}
      {activeSpot &&
        createPortal(
          <div
            className="md:hidden"
            style={{
              position: "fixed",
              zIndex: 10000,
              left: vv.left,
              top: vv.top,
              width: vv.layoutW,
              height: vv.layoutH,
              transform: `scale(${vv.scale})`,
              transformOrigin: "left top",
            }}
          >
            {/* 灰底（純視覺，不可點擊關閉） */}
            <div className="absolute inset-0 bg-black/60" />

            {/* 置中卡片 */}
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <BoothInfoPanel
                booth={booth}
                error={error}
                onClose={() => setActiveSpot(null)}
                variant="mobile"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
