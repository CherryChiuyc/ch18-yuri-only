import { useFavorites } from "../lib/useFavorites";

export default function FavoriteButton({ boothId }: { boothId?: string }) {
  const { isFav, toggle } = useFavorites();

  const id = (boothId ?? "").trim();
  const disabled = !id;
  const active = !disabled && isFav(id);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) toggle(id); }}
      aria-pressed={active}
      disabled={disabled}
      className={`rounded-full px-2 py-1 text-sm border transition
        ${disabled
          ? "opacity-50 cursor-not-allowed"
          : active
            ? "bg-amber-100 border-amber-400"
            : "bg-white border-slate-300 hover:bg-slate-50"}`}
      title={disabled ? "沒有有效的攤位 ID" : active ? "移出我的最愛" : "加入我的最愛"}
    >
      {active ? "★ 已收藏" : "☆ 收藏"}
    </button>
  );
}
