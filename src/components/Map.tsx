// import { useEffect, useMemo, useState } from 'react';
// import type { Stall } from '../lib/loadStalls';
// import { loadStalls } from '../lib/loadStalls';

// export default function Map({ svgUrl, csvUrl }: { svgUrl: string; csvUrl?: string }) {
//   const [svgHtml, setSvgHtml] = useState<string>('');
//   const [stalls, setStalls] = useState<Stall[]>([]);
//   const bySpot = useMemo(() => Object.fromEntries(stalls.map(s => [s.map.spotId, s])), [stalls]);
//   const [active, setActive] = useState<Stall | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     fetch(svgUrl).then(r => r.text()).then(setSvgHtml).catch(() => setError('無法載入場地地圖（SVG）。'));
//   }, [svgUrl]);

//   useEffect(() => {
//     if (!csvUrl) return;
//     loadStalls(csvUrl).then(setStalls).catch(() => setError('無法載入攤位資料（CSV）。'));
//   }, [csvUrl]);

//   useEffect(() => {
//     if (!svgHtml) return;
//     const host = document.getElementById('venue-svg-host');
//     const svg = host?.querySelector('svg');
//     if (!svg) return;

//     Object.keys(bySpot).forEach((spotId) => {
//       const el = svg.querySelector<SVGGraphicsElement>(`#${CSS.escape(spotId)}`);
//       if (!el) return;
//       el.style.cursor = 'pointer';
//       const onClick = () => setActive(bySpot[spotId]);
//       el.addEventListener('click', onClick);
//       // 清理
//       (el as any).__cleanup = onClick;
//     });

//     return () => {
//       Object.keys(bySpot).forEach((spotId) => {
//         const el = svg.querySelector<SVGGraphicsElement>(`#${CSS.escape(spotId)}`);
//         const fn = (el as any)?.__cleanup;
//         if (el && fn) el.removeEventListener('click', fn);
//       });
//     };
//   }, [svgHtml, bySpot]);

//   return (
//     <div className="grid md:grid-cols-[1fr_360px] gap-4">
//       <div id="venue-svg-host" className="bg-white rounded-2xl shadow p-2 min-h-[300px]" dangerouslySetInnerHTML={{ __html: svgHtml }} />
//       <aside className="bg-white rounded-2xl shadow p-4">
//         {!csvUrl ? (
//           <p className="text-gray-500">尚未設定資料來源，請在 Cloudflare Pages 的環境變數新增 <code>PUBLIC_CSV_URL</code>。</p>
//         ) : error ? (
//           <p className="text-red-600">{error}</p>
//         ) : active ? (
//           <StallCard stall={active} />
//         ) : (
//           <p className="text-gray-500">請點地圖上的攤位查看資訊。</p>
//         )}
//       </aside>
//     </div>
//   );
// }

// function StallCard({ stall }: { stall: Stall }) {
//   return (
//     <div>
//       <h2 className="text-xl font-bold">{stall.name || stall.id}</h2>
//       {stall.desc && <p className="mt-2 whitespace-pre-wrap">{stall.desc}</p>}
//       <div className="mt-3 flex gap-2 flex-wrap">
//         {stall.tags?.map((t) => (
//           <span key={t} className="px-2 py-0.5 text-sm rounded-full border">{t}</span>
//         ))}
//       </div>
//       <div className="mt-4 space-x-4">
//         {stall.links?.site && (
//           <a href={stall.links.site} target="_blank" rel="noreferrer" className="underline">官網</a>
//         )}
//         {stall.links?.instagram && (
//           <a href={stall.links.instagram} target="_blank" rel="noreferrer" className="underline">IG</a>
//         )}
//       </div>
//     </div>
//   );
// }
// src/components/Map.tsx
// src/components/Map.tsx
import { useEffect, useRef, useState } from "react";

export default function Map() {
  const [svg, setSvg] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/map/venue.svg", { cache: "no-cache" })
      .then((r) => r.text())
      .then((raw) => setSvg(injectStyle(raw))) // ← 把樣式注入到 SVG 內
      .catch((err) => console.error("載入 SVG 失敗：", err));
  }, []);

  // 把 <style> 插到 <svg ...> 的第一個閉合 '>' 之後
  function injectStyle(src: string) {
    const i = src.indexOf(">");
    if (i === -1) return src;
    const style = `
      <style>
        /* 讓所有有 id 的攤位方框可互動 */
        rect[id] {
          cursor: pointer;
          transition: fill 120ms ease, stroke 120ms ease;
        }
        /* 強制覆蓋 inline fill/style 的顏色（!important） */
        rect[id]:hover { fill: #ffeb99 !important; }
        rect[id]:active { fill: #ffd54f !important; } /* 手機按住反饋 */

        /* 如果某些 rect 沒有填色或設成 none，給預設白底，避免 hover 看不到 */
        rect[id][fill="none"],
        rect[id]:not([fill]) { fill: #ffffff; }

        /* 文字不要攔截滑鼠，也不要被選取 */
        text {
          pointer-events: none;
          user-select: none;
        }
      </style>
    `;
    return src.slice(0, i + 1) + style + src.slice(i + 1);
  }

  return (
    <div className="map-wrap">
      <div
        ref={containerRef}
        className="map-canvas"
        dangerouslySetInnerHTML={{
          __html: svg || `<div style="padding:1rem;color:#888;">載入場地圖中…</div>`,
        }}
      />
      <style jsx>{`
        .map-canvas {
          background: #fff;
          border-radius: 12px;
          padding: 8px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          overflow: auto;
        }
        .map-canvas svg { width: 100%; height: auto; display: block; }
      `}</style>
    </div>
  );
}

