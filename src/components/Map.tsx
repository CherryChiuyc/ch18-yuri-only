// src/components/Map.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { loadStalls, type BoothMap, type BoothEntry } from "../lib/loadStalls";
import BoothInfoPanel from "./BoothInfoPanel";

// ✅ 新增：搜尋與我的最愛面板
import SearchBar from "./SearchBar";
import FavoritesPanel from "./FavoritesPanel";

type SearchBooth = {
  id: string;               // 攤位編號 row-level
  name?: string;            // 社團名稱 row-level
  creationTheme?: string;   // 創作主題 item-level 合併為字串
  cpChars?: string;         // 主要CP / 角色 item-level 合併為字串
  author?: string;          // 作者 item-level 合併為字串
  productType?: string;     // 商品類別 item-level 合併為字串
  keywords?: string[];      // 預設攤位商品關鍵字(檢索用途) row-level 陣列
  themeTags?: string[];     // 主題標籤 item-level 陣列
};

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

  // ✅ 新增：抓到實際的 <svg> 節點（給高亮與跳轉用）
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ✅ 新增：搜尋用資料、結果、高亮
  const [data, setData] = useState<SearchBooth[]>([]);
  const [matchIds, setMatchIds] = useState<string[]>([]);

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

  // 讀 CSV（初始化 byId）
  useEffect(() => {
    const url = import.meta.env.PROD ? `/api/stalls?_=${Date.now()}` : import.meta.env.PUBLIC_CSV_URL;
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

  // --- 自動刷新（能見度感知 + 指數回退） ---
  useEffect(() => {
    const baseMs = 10_000;
    const maxMs = 120_000;
    let curMs = baseMs;

    let timer: number | null = null;
    let stopped = false;
    let lastHash = "";

    const visible = () => document.visibilityState === "visible";
    const djb2 = (s: string) => {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
      return String(h >>> 0);
    };

    const tick = async () => {
      if (stopped) return;
      if (!visible()) {
        schedule();
        return;
      }

      try {
        const url = `/api/stalls?_=${Date.now()}`;
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        const h = djb2(text);
        if (h !== lastHash) {
          lastHash = h;
          const data = JSON.parse(text);
          if (data?.byId) setBoothMap(new Map(data.byId));
        }
        curMs = baseMs;
      } catch (e) {
        curMs = Math.min(Math.floor(curMs * 1.8), maxMs);
        console.warn("auto refresh failed; backoff to", curMs, "ms", e);
      } finally {
        schedule();
      }
    };

    const schedule = () => {
      if (stopped) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(tick, curMs);
    };

    const onVis = () => {
      if (!visible()) return;
      curMs = baseMs;
      if (timer) window.clearTimeout(timer);
      tick();
    };

    const onOnline = () => {
      curMs = baseMs;
      if (timer) window.clearTimeout(timer);
      tick();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    schedule();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // 共用分隔解析
  const SEP = /[,，|｜│]+/g;
  const toArr = (v: any): string[] =>
    v == null ? [] : Array.isArray(v) ? v.map(String).filter(Boolean)
    : String(v).split(SEP).map(s => s.trim()).filter(Boolean);

  useEffect(() => {
    const list: SearchBooth[] = Array.from(boothMap.values()).map((row: BoothEntry) => {
      const anyRow = row as any;
      const items: any[] = anyRow.items ?? [];

      // ---------- row-level ----------
      const id = String(anyRow.rawId || anyRow.id || "");
      const name = String(anyRow.name ?? anyRow["社團名稱"] ?? "");
      const keywords = toArr(
        anyRow.keywords ??
        anyRow.defaultKeywords ??
        anyRow["預設攤位商品關鍵字(檢索用途)"] ??
        anyRow["預設攤位商品關鍵字"]
      ); // ✅ 陣列

      // ---------- item-level：收集後合併為字串；themeTags 保持陣列 ----------
      const creationThemes: string[] = [];
      const cpList: string[] = [];
      const authorList: string[] = [];
      const productList: string[] = [];
      const tagList: string[] = []; // ✅ themeTags 陣列

      items.forEach((it) => {
        creationThemes.push(...toArr(it.creationTheme ?? it["創作主題"]));
        cpList.push(...toArr(it.cpChars ?? it["主要CP / 角色"]));
        authorList.push(...toArr(it.author ?? it["作者"]));
        productList.push(...toArr(it.productType ?? it["商品類別"]));
        tagList.push(...toArr(it.themeTags ?? it["主題標籤"])); // ✅ 陣列，不去重
      });

      const joiner = "、"; // 顯示用；想用空白或逗號可改
      return {
        id,
        name,
        keywords,                         // ✅ array
        themeTags: tagList,               // ✅ array
        creationTheme: creationThemes.join(joiner),
        cpChars: cpList.join(joiner),
        author: authorList.join(joiner),
        productType: productList.join(joiner),
      };
    });

    setData(list);
  }, [boothMap]);

  // ✅ 新增：搜尋結果 → 高亮 SVG rect（以 data-highlight 控制）
  useEffect(() => {
    const svg =
      svgRef.current ??
      (containerRef.current?.querySelector("svg") as SVGSVGElement | null);
    if (!svg) return;

    svg.querySelectorAll<SVGRectElement>("rect[id][data-highlight='true']").forEach((el) =>
      el.removeAttribute("data-highlight")
    );
    matchIds.forEach((id) => {
      const el = svg.querySelector<SVGRectElement>(`#${CSS.escape(id)}`);
      if (el) el.setAttribute("data-highlight", "true");
    });
  }, [matchIds, svgHtml]);

  function injectStyle(src: string) {
    const m = src.match(/<svg[\s\S]*?>/i);
    if (!m || m.index == null) return src;
    const insertAt = (m.index as number) + m[0].length;
    const style = `
      <style>
        svg *:not(rect) { pointer-events: none; }
        /* ===== 基礎互動設定（保留你原本透明預設） ===== */
        rect[id][fill="none"], rect[id]:not([fill]) { fill: rgba(0,0,0,0); }
        rect[id] { pointer-events: auto; cursor: pointer; transition: fill 120ms ease; }
        rect[id]:hover { fill: #ffeb99 !important;}
        text { pointer-events: none; user-select: none; }

        /* ===== 命中（高亮）- 實心底色 ===== */
        rect[id][data-highlight="true"] {
          fill: #FFD34D !important;
          stroke: none !important;
          filter: none !important;
        }

        /* ===== 選取（你原本的黃底）===== */
        rect[id][data-selected="true"] {
          fill: #fdd835 !important;
        }

        /* ===== 搜尋中：預設把所有攤位塗成灰底（未命中）===== */
        svg[data-searching="true"] rect[id] {
          fill: #d6c8b6ff !important;   /* 灰色，可改其他 16 進位色 */
          stroke: none !important;
        }

        /* 搜尋中：命中覆蓋灰底 → 顯示高亮色 */
        svg[data-searching="true"] rect[id][data-highlight="true"] {
          fill: #cca36bff !important;  /* 你的高亮色 */
        }

        /* 搜尋中：選取優先於一切（保持選取色） */
        svg[data-searching="true"] rect[id][data-selected="true"] {
          fill: #fdd835 !important;
        }

        /* 搜尋中：未命中者 hover 時改成你的 hover 色 */
        svg[data-searching="true"] rect[id]:hover {
          fill: #ffeb99 !important;  /* 你的原 hover 色 */
        }

        /* 搜尋中：命中者 hover 仍維持高亮色 */
        svg[data-searching="true"] rect[id][data-highlight="true"]:hover {
          fill: #cb8c33ff !important;  /* 你的高亮色 */
        }

        /* 搜尋中：已選取者 hover 仍維持選取色 */
        svg[data-searching="true"] rect[id][data-selected="true"]:hover {
          fill: #fdd835 !important;  /* 你的選取色 */
        }
      </style>
    `;
    return src.slice(0, insertAt) + style + src.slice(insertAt);
  }

  useEffect(() => {
    const svg =
      svgRef.current ??
      (containerRef.current?.querySelector("svg") as SVGSVGElement | null);
    if (!svg) return;

    // 清掉舊高亮
    svg.querySelectorAll<SVGRectElement>("rect[id][data-highlight='true']")
      .forEach(el => el.removeAttribute("data-highlight"));

    // 套用新高亮
    matchIds.forEach(id => {
      const el = svg.querySelector<SVGRectElement>(`#${CSS.escape(id)}`);
      if (el) el.setAttribute("data-highlight", "true");
    });

    // ✅ 有命中就標記為「搜尋中」→ 未命中全部灰底；沒命中則還原
    if (matchIds.length > 0) svg.setAttribute("data-searching", "true");
    else svg.removeAttribute("data-searching");
  }, [matchIds, svgHtml]);

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

      // ✅ 設定給 highlight/jump 使用
      svgRef.current = svgEl;
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
    const pad = 8,
      offset = 12;
    const show = (txt: string) => {
      tt.textContent = txt;
      tt.style.opacity = "1";
      tt.setAttribute("aria-hidden", "false");
    };
    const hide = () => {
      tt.style.opacity = "0";
      tt.setAttribute("aria-hidden", "true");
    };
    const place = (x: number, y: number) => {
      tt.style.left = "0px";
      tt.style.top = "0px";
      const r = tt.getBoundingClientRect(),
        vpW = innerWidth,
        vpH = innerHeight;
      let L = x + offset,
        T = y + offset;
      if (L + r.width + pad > vpW) L = x - r.width - offset;
      if (T + r.height + pad > vpH) T = y - r.height - offset;
      L = Math.max(pad, Math.min(L, vpW - r.width - pad));
      T = Math.max(pad, Math.min(T, vpH - r.height - pad));
      tt.style.left = `${L}px`;
      tt.style.top = `${T}px`;
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
    () =>
      activeSpot
        ? boothMap.get(norm(activeSpot)) ?? { id: norm(activeSpot), rawId: activeSpot, items: [] }
        : null,
    [activeSpot, boothMap]
  );

  // 只有在手機尺寸且有彈窗時鎖住背景
  const isMobile =
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767.98px)").matches : false;
  useBodyScrollLock(Boolean(activeSpot && isMobile));

  // 用 visual viewport 盒來定位 overlay，並用「反向縮放」抵消頁面縮放
  const vv = useVisualViewportBox();

  // ✅ 新增：我的最愛跳轉（滾到目標並開啟資訊卡）
  const jumpTo = useCallback((id: string) => {
    setActiveSpot(id);

    const svg = svgRef.current ?? (containerRef.current?.querySelector("svg") as SVGSVGElement | null);
    const el = svg?.querySelector<SVGRectElement>(`#${CSS.escape(id)}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

    // 同步選取狀態（黃底）
    const host = containerRef.current;
    if (host) {
      host
        .querySelectorAll<SVGRectElement>("rect[id][data-selected='true']")
        .forEach((r) => r.removeAttribute("data-selected"));
      const target = host.querySelector<SVGRectElement>(`#${CSS.escape(id)}`);
      target?.setAttribute("data-selected", "true");
    }
  }, []);

  const nameLookup = useMemo(() => {
    const map: Record<string, string> = {};
    data.forEach(b => { if (b.id) map[b.id] = b.name ?? ""; });
    return (id: string) => map[id];
  }, [data]);

  return (
    <div>
      {/* ✅ 頂部搜尋列（sticky） */}
      <SearchBar data={data} onMatchIds={setMatchIds} accentColor="#5a9fffff" /> {/* 可覆蓋搜尋欄預設顏色 */}

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
        <div ref={containerRef} className="bg-white rounded-2xl shadow p-2 min-h-[300px] overflow-auto" />

        {/* tooltip */}
        <div
          ref={tooltipRef}
          className="fixed z-[9999] pointer-events-none px-2.5 py-1.5 rounded-lg shadow text-sm text-white"
          style={{
            background: "rgba(0,0,0,0.8)",
            opacity: 0,
            transition: "opacity 120ms ease",
            left: 0,
            top: 0,
            maxWidth: "min(60vw,24rem)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          role="tooltip"
          aria-hidden="true"
        />

        {/* 桌面：右側固定資訊欄 */}
        <aside className="hidden md:block">
          <BoothInfoPanel booth={booth} error={error} variant="desktop" />
        </aside>
      </div>

      {/* ✅ 我的最愛面板（固定定位，不佔版位） */}
      <FavoritesPanel onJump={jumpTo} nameLookup={nameLookup} />

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
