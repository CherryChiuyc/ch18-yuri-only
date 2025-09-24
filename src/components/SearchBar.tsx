import { useEffect, useMemo, useState } from "react";

// ✅ 型別：只有 keywords / themeTags 是陣列
export type Booth = {
  id: string;               // 攤位編號
  name?: string;            // 社團名稱（string）
  creationTheme?: string;   // 創作主題（string）
  cpChars?: string;         // 主要CP / 角色（string）
  author?: string;          // 作者（string）
  productType?: string;     // 商品類別（string）
  keywords?: string[];      // 預設關鍵字（row-level, string[]）
  themeTags?: string[];     // 主題標籤（item-level, string[]）
};

export default function SearchBar({
    data,
    onMatchIds,
    accentColor = "#5a9fffff", // ⬅ 想要的外框顏色（hover / focus 同色）
    }: {
    data: Booth[];
    onMatchIds: (ids: string[]) => void;
    accentColor?: string;
    }) {
  const [q, setQ] = useState("");
  

  // ✅ 把字串欄位 + 陣列欄位（join）串成一條 haystack
  const haystackOf = (b: Booth) =>
    [
      b.id,
      b.name,
      b.creationTheme,
      b.cpChars,
      b.author,
      b.productType,
      ...(b.keywords ?? []),
      ...(b.themeTags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return [];
    return data.filter(b => haystackOf(b).includes(kw)).map(b => b.id);
  }, [q, data]);

  useEffect(() => { onMatchIds(results); }, [results, onMatchIds]);

  return (
    <div className="w-full sticky top-0 z-[55] bg-white/80 backdrop-blur border-b"
         style={{ ["--accent" as any]: accentColor }}>
      <div className="max-w-screen-md mx-auto p-3">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="搜尋：攤位編號／社團名稱／創作主題／主題標籤／主要CP／作者／商品類別／關鍵字"
          className="
            w-full rounded-xl border px-3 py-2
            outline-none transition
            ring-1 ring-transparent
            hover:ring-2 focus:ring-2
            hover:ring-[var(--accent)] focus:ring-[var(--accent)]
            hover:border-[var(--accent)] focus:border-[var(--accent)]
          "
        />
        {q && <div className="text-xs text-slate-500 mt-1">匹配 {results.length} 個攤位</div>}
      </div>
    </div>
  );
}

