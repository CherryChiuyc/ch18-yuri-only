// src/lib/useFavorites.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { safeLocalGet, safeLocalSet } from "./storage";

const KEY = "booth-favorites:v1";
const BUS_EVENT = "favorites:update";
const bus: (Window & typeof globalThis) | undefined =
  typeof window !== "undefined" ? window : undefined;

// 轉成排序過的穩定陣列，方便比較
function toStableArray(v: Iterable<string>): string[] {
  return Array.from(v).filter(Boolean).map(String).sort();
}
function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function useFavorites() {
  // 初始化：把舊資料的空值清掉，並排序，做為穩定基準
  const [favSet, setFavSet] = useState<Set<string>>(() =>
    new Set(toStableArray(safeLocalGet<string[]>(KEY, [])))
  );

  // 寫回 localStorage + 廣播（同頁同步）
  useEffect(() => {
    const arr = toStableArray(favSet);
    safeLocalSet(KEY, arr);
    bus?.dispatchEvent(new CustomEvent(BUS_EVENT, { detail: arr }));
  }, [favSet]);

  // 監聽同頁匯流排：**只有內容不同才 setState**
  useEffect(() => {
    const onBus = (e: Event) => {
      const detail = (e as CustomEvent<string[]>)?.detail ?? [];
      const next = toStableArray(detail);
      setFavSet(prev => {
        const prevArr = toStableArray(prev);
        if (arraysEqual(prevArr, next)) return prev; // ← 不變就不更新，避免回圈
        return new Set(next);
      });
    };
    bus?.addEventListener(BUS_EVENT, onBus as EventListener);
    return () => bus?.removeEventListener(BUS_EVENT, onBus as EventListener);
  }, []);

  // 監聽跨分頁 storage：**只有內容不同才 setState**
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      try {
        const parsed = e.newValue ? (JSON.parse(e.newValue) as string[]) : [];
        const next = toStableArray(parsed);
        setFavSet(prev => {
          const prevArr = toStableArray(prev);
          if (arraysEqual(prevArr, next)) return prev;
          return new Set(next);
        });
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isFav = useCallback((id: string) => favSet.has(id), [favSet]);

  const toggle = useCallback((id: string) => {
    const norm = (id ?? "").trim();
    if (!norm) return;
    setFavSet(prev => {
      const next = new Set(prev);
      next.has(norm) ? next.delete(norm) : next.add(norm);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    const norm = (id ?? "").trim();
    if (!norm) return;
    setFavSet(prev => {
      if (!prev.has(norm)) return prev;
      const next = new Set(prev);
      next.delete(norm);
      return next;
    });
  }, []);

  const clear = useCallback(() => setFavSet(new Set()), []);

  const list = useMemo(() => toStableArray(favSet), [favSet]);
  const count = list.length;

  return { isFav, toggle, remove, clear, list, count };
}
