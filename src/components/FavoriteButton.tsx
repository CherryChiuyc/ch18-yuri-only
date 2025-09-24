import { useFavorites } from "../lib/useFavorites";

export default function FavoriteButton({ boothId }: { boothId: string }) {
  const { isFav, toggle } = useFavorites();
  const active = isFav(boothId);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle(boothId); }}
      aria-pressed={active}
      className={`rounded-full px-2 py-1 text-sm border transition
        ${active ? "bg-amber-100 border-amber-400" : "bg-white border-slate-300 hover:bg-slate-50"}`}
      title={active ? "移出我的最愛" : "加入我的最愛"}
    >
      {active ? "★ 已收藏" : "☆ 收藏"}
    </button>
  );
}
