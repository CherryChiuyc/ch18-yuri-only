import { useFavorites } from "../lib/useFavorites";

export default function FavoritesPanel({ onJump }: { onJump?: (id: string) => void }) {
  const { list, clear } = useFavorites();
  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-72 rounded-2xl shadow-lg bg-white border p-3 space-y-2 z-[60]">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">我的最愛（{list.length}）</h3>
        <button onClick={clear} className="text-xs text-slate-500 hover:underline">清空</button>
      </div>
      <ul className="max-h-60 overflow-auto space-y-1">
        {list.map(id => (
          <li key={id} className="flex items-center justify-between">
            <span className="font-mono">{id}</span>
            <button className="text-xs underline" onClick={() => onJump?.(id)}>前往</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
