import { useFavorites } from "../lib/useFavorites";

export default function FavoritesPanel({
  onJump,
  nameLookup,
}: {
  onJump?: (id: string) => void;
  nameLookup?: (id: string) => string | undefined; // 由父層傳入
}) {
  const { list, clear, remove, count } = useFavorites();

  return (
    <div className="fixed bottom-4 right-4 w-80 rounded-2xl shadow-lg bg-white border p-3 space-y-3 z-[60]">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">我的最愛（{count}）</h3>
        <button
          onClick={clear}
          className="text-xs text-slate-500 hover:underline disabled:opacity-40"
          disabled={count === 0}
        >
          清空
        </button>
      </div>

      {count === 0 ? (
        <div className="text-sm text-slate-500 rounded-lg border border-dashed p-3">
          目前沒有收藏的攤位。<br />
          到地圖卡片按「☆ 收藏」即可加入清單。
        </div>
      ) : (
        <ul className="max-h-72 overflow-auto space-y-1 pr-1">
          {list.map((id) => {
            const name = nameLookup?.(id) ?? "";
            return (
              <li key={id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-sm truncate">{id}</div>
                  {name && <div className="text-xs text-slate-600 truncate">{name}</div>}
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
                    className="text-xs text-slate-500 hover:text-red-600"
                    onClick={() => remove(id)}
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
