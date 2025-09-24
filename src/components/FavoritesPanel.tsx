// src/components/FavoritesPanel.tsx
import React, { useEffect, useRef, useState } from "react";
import { useFavorites } from "../lib/useFavorites";
import { safeLocalGet, safeLocalSet } from "../lib/storage";

const COLLAPSE_KEY = "favorites:panel-collapsed:v1";
const POS_KEY = "favorites:panel-pos:v1";

type Pos = { left: number; top: number };

const MARGIN = 12;
const LONG_PRESS_MS = 350;
const MOVE_TOL = 8;

// 褐色系（Tailwind stone 對應的色值）
const PRESS_BG = "#e7e5e4";     // stone-200
const PRESS_BG_HEADER = "#fafaf9"; // stone-50（標題列微淺）
const PRESS_BORDER = "#a8a29e";  // stone-400
const PRESS_RING = "rgba(168,162,158,0.6)"; // stone-400 的透明外圈

function clampPos(p: Pos, el: HTMLElement): Pos {
  const rect = el.getBoundingClientRect();
  const maxL = window.innerWidth - rect.width - MARGIN;
  const maxT = window.innerHeight - rect.height - MARGIN;
  return {
    left: Math.max(MARGIN, Math.min(p.left, maxL)),
    top: Math.max(MARGIN, Math.min(p.top, maxT)),
  };
}

export default function FavoritesPanel({
  onJump,
  nameLookup,
  confirmOnRemove = true,
  confirmOnClear = true,
}: {
  onJump?: (id: string) => void;
  nameLookup?: (id: string) => string | undefined;
  confirmOnRemove?: boolean;
  confirmOnClear?: boolean;
}) {
  const { list, clear, remove, count } = useFavorites();

  // 收合狀態（記住）
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    safeLocalGet<boolean>(COLLAPSE_KEY, false)
  );
  useEffect(() => { safeLocalSet(COLLAPSE_KEY, collapsed); }, [collapsed]);

  // 位置（記住）
  const defaultPos: Pos | null = safeLocalGet<Pos | null>(POS_KEY, null);
  const [pos, setPos] = useState<Pos | null>(defaultPos);
  const rootRef = useRef<HTMLDivElement>(null);

  // 拖曳相關
  const draggingRef = useRef(false);
  const pressTimerRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const basePosRef = useRef<Pos | null>(null);
  const justDraggedRef = useRef(false);
  const armingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  // 長按/拖曳中的視覺反饋
  const [pressing, setPressing] = useState(false);

  // 鎖捲動
  const prevStylesRef = useRef<{
    overflow: string;
    touchActionBody: string;
    touchActionRoot: string;
    overscroll: string;
  } | null>(null);

  function setScrollLock(on: boolean) {
    const body = document.body;
    const root = rootRef.current;
    const html = document.documentElement as HTMLElement;

    if (on) {
      if (!prevStylesRef.current) {
        prevStylesRef.current = {
          overflow: body.style.overflow,
          touchActionBody: (body.style as any).touchAction || "",
          touchActionRoot: root?.style.touchAction || "",
          overscroll: (html.style as any).overscrollBehavior || "",
        };
      }
      body.style.overflow = "hidden";
      (body.style as any).touchAction = "none";
      if (root) (root.style as any).touchAction = "none";
      (html.style as any).overscrollBehavior = "none";
    } else {
      const prev = prevStylesRef.current;
      body.style.overflow = prev?.overflow ?? "";
      (body.style as any).touchAction = prev?.touchActionBody ?? "";
      if (root) (root.style as any).touchAction = prev?.touchActionRoot ?? "";
      (document.documentElement as any).style.overscrollBehavior = prev?.overscroll ?? "";
      prevStylesRef.current = null;
    }
  }

  // 位置變更：clamp + 存檔
  useEffect(() => {
    if (!rootRef.current || !pos) return;
    const fixed = clampPos(pos, rootRef.current);
    if (fixed.left !== pos.left || fixed.top !== pos.top) {
      setPos(fixed);
      safeLocalSet(POS_KEY, fixed);
    } else {
      safeLocalSet(POS_KEY, pos);
    }
  }, [pos]);

  // 視窗尺寸變更回正
  useEffect(() => {
    const onResize = () => {
      if (!rootRef.current) return;
      setPos(cur => (cur ? clampPos(cur, rootRef.current!) : cur));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 正式開始拖曳
  const beginDrag = (e: PointerEvent | React.PointerEvent) => {
    if (!rootRef.current) return;
    draggingRef.current = true;
    setPressing(true);
    document.body.style.userSelect = "none";

    try {
      pointerIdRef.current = (e as PointerEvent).pointerId ?? null;
      if (pointerIdRef.current != null) {
        (rootRef.current as any).setPointerCapture(pointerIdRef.current);
      }
    } catch {}

    setScrollLock(true);

    const el = rootRef.current;
    const rect = el.getBoundingClientRect();
    const base = pos ?? {
      left: window.innerWidth - rect.width - MARGIN - 4,
      top: window.innerHeight - rect.height - MARGIN - 4,
    };
    basePosRef.current = base;

    const start = startPointRef.current ?? {
      x: (e as PointerEvent).clientX,
      y: (e as PointerEvent).clientY,
    };

    const onMove = (ev: PointerEvent) => {
      const next = {
        left: base.left + (ev.clientX - start.x),
        top: base.top + (ev.clientY - start.y),
      };
      setPos(() => clampPos(next, el));
      if (typeof ev.preventDefault === "function") ev.preventDefault();
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      setScrollLock(false);

      if (draggingRef.current) {
        justDraggedRef.current = true;
        window.setTimeout(() => (justDraggedRef.current = false), 120);
      }
      draggingRef.current = false;
      setPressing(false);

      try {
        if (pointerIdRef.current != null) {
          (rootRef.current as any).releasePointerCapture(pointerIdRef.current);
        }
      } catch {}
      pointerIdRef.current = null;
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
  };

  // PointerDown：桌面靠移動門檻；手機靠長按
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!rootRef.current) return;

    const isTouch = e.pointerType === "touch";
    const start = { x: e.clientX, y: e.clientY };
    startPointRef.current = start;
    armingRef.current = true;

    if (isTouch) {
      setPressing(true);
      pressTimerRef.current = window.setTimeout(() => {
        if (!armingRef.current) return;
        window.removeEventListener("pointermove", onMove as any);
        window.removeEventListener("pointerup", onUp as any);
        armingRef.current = false;
        beginDrag(e);
      }, LONG_PRESS_MS);
    }

    const onMove = (ev: PointerEvent) => {
      if (!armingRef.current) return;
      const dx = Math.abs(ev.clientX - start.x);
      const dy = Math.abs(ev.clientY - start.y);
      if (dx > MOVE_TOL || dy > MOVE_TOL) {
        if (pressTimerRef.current) {
          clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }
        armingRef.current = false;
        setPressing(true);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        beginDrag(e);
      }
    };

    const onUp = () => {
      armingRef.current = false;
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
      setPressing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // 點擊：剛拖完吃掉 click
  const handleCollapsedClick = () => {
    if (justDraggedRef.current) return;
    setPressing(false);
    setCollapsed(false);
  };
  const handleCollapse = () => {
    if (justDraggedRef.current) return;
    setPressing(false);
    setCollapsed(true);
  };

  // 確認對話
  const handleRemove = (id: string) => {
    const nm = nameLookup?.(id) ?? "";
    const msg = `要取消收藏「${id}${nm ? `｜${nm}` : ""}」嗎？`;
    if (!confirmOnRemove || window.confirm(msg)) remove(id);
  };
  const handleClear = () => {
    const msg = `確定要清空 ${count} 個收藏嗎？`;
    if (!confirmOnClear || window.confirm(msg)) clear();
  };

  // 位置樣式
  const containerStyle: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" }
    : { right: 16, bottom: 16 };

  // 收合（膠囊可長按拖曳）
  if (collapsed) {
    return (
      <div ref={rootRef} className="fixed z-[60]" style={containerStyle}>
        <button
          onPointerDown={handlePointerDown}
          onClick={handleCollapsedClick}
          // 用 inline style 強制背景色，避免行動版 reset 成透明
          style={{
            backgroundColor: pressing ? PRESS_BG : "#ffffff",
            borderColor: pressing ? PRESS_BORDER : undefined,
            boxShadow: pressing ? `0 0 0 1px ${PRESS_RING}` : undefined,
            WebkitTapHighlightColor: "transparent",
            WebkitTouchCallout: "none",
          }}
          className="rounded-full border shadow px-3 py-1.5 text-sm active:cursor-grabbing cursor-grab"
          title="長按可拖曳；點一下展開"
        >
          我的最愛（{count}）
        </button>
      </div>
    );
  }

  // 展開（標題列可長按拖曳）
  return (
    <div
      ref={rootRef}
      className="fixed w-80 rounded-2xl shadow-lg bg-white border p-3 space-y-3 z-[60]"
      style={containerStyle}
    >
      <div
        onPointerDown={handlePointerDown}
        title="長按可拖曳；點『收合』縮起"
        // 同樣用 inline style 做保險（行動版）
        style={{
          backgroundColor: pressing ? PRESS_BG_HEADER : undefined,
          boxShadow: pressing ? `inset 0 0 0 1px ${PRESS_RING}` : undefined,
          borderRadius: pressing ? 12 : undefined,
          WebkitTapHighlightColor: "transparent",
          WebkitTouchCallout: "none",
        }}
        className="flex items-center justify-between select-none cursor-grab active:cursor-grabbing -mx-2 -my-1 px-2 py-1 rounded-xl"
      >
        <button
          className="text-left font-medium hover:opacity-80"
          onClick={handleCollapse}
          aria-label="縮起面板"
        >
          我的最愛（{count}）
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="text-xs text-stone-600 hover:underline disabled:opacity-40"
            disabled={count === 0}
          >
            清空
          </button>
          <button
            onClick={handleCollapse}
            className="text-xs text-stone-600 hover:underline"
          >
            收合
          </button>
        </div>
      </div>

      {count === 0 ? (
        <div className="text-sm text-stone-600 rounded-lg border border-dashed p-3 leading-relaxed">
          目前沒有收藏的攤位。<br />
          到地圖卡片按「☆ 收藏」即可加入清單。
          <hr className="my-2" />
          小技巧：手機<strong>長按</strong>「我的最愛」即可拖曳位置；點一下可展開／收合。
        </div>
      ) : (
        <ul className="max-h-72 overflow-auto space-y-1 pr-1">
          {list.map((id) => {
            const name = nameLookup?.(id) ?? "";
            return (
              <li key={id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-sm truncate">{id}</div>
                  {name && <div className="text-xs text-stone-600 truncate">{name}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="text-xs underline"
                    onClick={() => onJump?.(id)}
                    title="前往"
                  >
                    前往
                  </button>
                  <button
                    className="text-xs text-stone-600 hover:text-red-600"
                    onClick={() => handleRemove(id)}
                    title="取消收藏"
                  >
                    取消收藏
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
