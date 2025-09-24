// src/components/BoothInfoPanel.tsx
import { useMemo, useState } from "react";
import type { BoothEntry, WorkItem } from "../lib/loadStalls";
import FavoriteButton from "./FavoriteButton";

type Props = {
  booth: BoothEntry | null;
  error?: string | null;
  onClose?: () => void;
  variant?: "desktop" | "mobile";
};

// 小元件
function Tag({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "danger" | "success" | "info" }) {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-sm font-medium";
  const variants: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    danger: "bg-rose-100 text-rose-700",
    success: "bg-green-100 text-green-700",
    info: "bg-blue-100 text-blue-700",
  };
  return <span className={`${base} ${variants[variant]}`}>{children}</span>;
}

const TagList = ({ items }: { items?: string[] }) =>
  items && items.length ? (
    <ul className="flex flex-wrap gap-2">
      {items.map((t, i) => (
        <li
          key={i}
          className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-md"
        >
          {t}
        </li>
      ))}
    </ul>
  ) : null;

const Labeled = ({ label, children }: { label: string; children?: React.ReactNode }) =>
  children ? (
    <div className="text-sm md:text-base">
      <span className="text-slate-500">{label}：</span>
      <span className="text-slate-900 break-words">{children}</span>
    </div>
  ) : null;

const hasRenderableContent = (it: WorkItem) => {
  return Boolean(
    (it.themeTags && it.themeTags.length) ||
    it.cpChars ||
    it.bookTitle ||
    it.author ||
    it.productType ||
    it.isNewOrOld ||
    it.priceRaw ||
    it.priceNum != null ||
    it.actionUrl ||
    it.actionType ||
    it.isR18
  );
};

function WorkBlock({ item }: { item: WorkItem }) {
  if (!hasRenderableContent(item)) return null;
  return (
    <section className="rounded-xl border border-slate-200 p-3 md:p-4 space-y-2 bg-white">
      {/* R18 + 主題 TAGs */}
      <div className="flex flex-wrap gap-2">
        {item.isR18 && <Tag variant="danger">R18</Tag>}
        {item.themeTags?.map((t, i) => (
          <Tag key={i}>{t}</Tag>
        ))}
      </div>

      {/* 作品欄位（略） */}
      <div className="space-y-2">
        {item.creationTheme && <Labeled label="創作主題">{item.creationTheme}</Labeled>}
        <Labeled label="主要CP / 角色">{item.cpChars}</Labeled>
        <Labeled label="品名">{item.bookTitle}</Labeled>
        <Labeled label="作者">{item.author}</Labeled>
        <Labeled label="商品類別">{item.productType}</Labeled>
        <Labeled label="新品/既品">{item.isNewOrOld}</Labeled>
        <Labeled label="售價">
          {item.priceRaw || (item.priceNum != null ? `NT$${item.priceNum}` : undefined)}
        </Labeled>
      </div>

      {/* 合併後的一條連結：文字=actionType、href=actionUrl */}
      <div className="flex flex-col gap-1 pt-1">
        {item.actionUrl && (
          <a
            href={item.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline underline-offset-4 break-all cursor-pointer"
          >
            {item.actionType || "連結"}
          </a>
        )}
      </div>
    </section>
  );
}


export default function BoothInfoPanel({
  booth,
  error,
  onClose,
  variant = "desktop",
}: Props) {
  // 攤位主圖：/event_pics/{攤位編號}.[jpg|png|jpeg]
  const exts = [".jpg", ".png", ".jpeg"];
  const [imgIdx, setImgIdx] = useState(0);
  const imgPath = useMemo(() => {
    if (!booth) return "";
    const key = (booth.rawId || booth.id).toUpperCase();
    return `/event_pics/${key}${exts[Math.min(imgIdx, exts.length - 1)]}`;
  }, [booth, imgIdx]);

  const Header = booth ? (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        {booth.id && <FavoriteButton boothId={booth.id} />}
      </div>
      {/* 社團名稱（大標；可點連結） */}
      {booth.name ? (
        booth.url ? (
          <a
            href={booth.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-bold text-2xl md:text-3xl text-gray-900 leading-tight underline underline-offset-4 hover:text-blue-700 cursor-pointer"
            title={booth.name}
          >
            {booth.name}
          </a>
        ) : (
          <h2 className="font-bold text-2xl md:text-3xl text-gray-900 leading-tight">
            {booth.name}
          </h2>
        )
      ) : null}

      {/* 攤位編號 */}
      <div className="text-base md:text-lg text-gray-700">
        攤位編號：<span className="font-mono">{booth.rawId || booth.id}</span>
      </div>
    </div>
  ) : null;

  const Body = (
    <>
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : booth ? (
        <div className="space-y-4">
          {Header}

          {/* 攤位主圖 */}
          {imgPath && (
            <div className="mt-1">
              <img
                src={imgPath}
                alt={booth.name || booth.rawId}
                className="rounded-lg w-full max-h-[500px] object-contain"
                onError={() => setImgIdx((i) => Math.min(i + 1, exts.length - 1))}
              />
            </div>
          )}

          {/* 攤位層級：檢索關鍵字 */}
          {booth.keywords?.length ? (
            <div>
              <div className="text-slate-500 text-sm mb-1">關鍵字</div>
              <TagList items={booth.keywords} />
            </div>
          ) : null}

          {/* 多筆作品 */}
          {booth.items?.length ? (
            (() => {
              const items = booth.items.filter(hasRenderableContent);
              return items.length ? (
                <div className="space-y-3">
                  {items.map((it, i) => (
                    <WorkBlock key={i} item={it} />
                  ))}
                </div>
              ) : null;
            })()
          ) : null}
        </div>
      ) : (
        <p className="text-gray-500">請點地圖上的攤位查看資訊。</p>
      )}
    </>
  );

  if (variant === "mobile") {
    // 手機：固定尺寸卡片（大小由 Map.tsx 的 overlay 控制邊距與灰底）
    return (
      <div className="relative bg-white rounded-2xl shadow-lg w-full max-w-[640px] max-h-full overflow-y-auto overscroll-contain p-4">
        <button
          onClick={onClose}
          className="sticky top-0 ml-auto block text-right text-gray-500 hover:text-gray-800 text-2xl"
          aria-label="關閉"
        >
          ✕
        </button>
        {Body}
      </div>
    );
  }

  // 桌面：右側側欄
  return (
    <aside className="bg-white rounded-2xl shadow p-4 sticky top-4 max-h-[calc(100dvh-2rem)] overflow-auto">
      {Body}
    </aside>
  );
}
