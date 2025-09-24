import { useCallback, useEffect, useMemo, useState } from "react";
import { safeLocalGet, safeLocalSet } from "./storage";

const KEY = "booth-favorites:v1";

export function useFavorites() {
  const [favSet, setFavSet] = useState<Set<string>>(
    () => new Set(safeLocalGet<string[]>(KEY, []))
  );

  useEffect(() => {
    safeLocalSet(KEY, Array.from(favSet));
  }, [favSet]);

  const isFav = useCallback((id: string) => favSet.has(id), [favSet]);

  const toggle = useCallback((id: string) => {
    setFavSet(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setFavSet(new Set()), []);
  const list = useMemo(() => Array.from(favSet), [favSet]);

  return { isFav, toggle, clear, list, count: list.length };
}
