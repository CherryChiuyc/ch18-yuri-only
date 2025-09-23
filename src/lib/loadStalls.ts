// src/lib/loadStalls.ts  —— 覆蓋版：同時支援 JSON & CSV
export type WorkItem = {
  creationTheme?: string;
  themeTags?: string[];
  cpChars?: string;
  bookTitle?: string;
  isR18?: boolean;
  author?: string;
  productType?: string;
  isNewOrOld?: string;
  priceRaw?: string;
  priceNum?: number | null;
  actionType?: string;
  actionUrl?: string;
  _raw?: Record<string, string>;
};

export type BoothEntry = {
  id: string;
  rawId: string;
  name?: string;
  url?: string;
  keywords?: string[];
  items: WorkItem[];
  _rawRows?: Record<string, string>[];
};

export type BoothMap = Map<string, BoothEntry>;
type LoadResult = { byId: BoothMap; all: BoothEntry[] };

// 只用直立線家族當分隔
const SEP = /[|｜│]+/g;

// ── 輕量 CSV parser（支援引號/換行/雙引號轉義） ──
function csvToRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\r") { /* noop */ }
      else if (ch === "\n") { row.push(cell); cell = ""; rows.push(row); row = []; }
      else cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
function parseCSV(text: string): Record<string, string>[] {
  const rows = csvToRows(text);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((c) => !c || !c.trim())) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    out.push(obj);
  }
  return out;
}

// 容錯抓欄位
function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const hit = Object.keys(row).find((x) => x.trim() === k.trim());
    const v = hit ? row[hit] : undefined;
    if (v != null && v.toString().trim() !== "") return v.toString().trim();
  }
  return undefined;
}

// 把 CSV 轉成你原本的結構（保留原邏輯） :contentReference[oaicite:9]{index=9} :contentReference[oaicite:10]{index=10}
function fromCsvText(text: string): LoadResult {
  const rows = parseCSV(text);
  const byId: BoothMap = new Map();
  const all: BoothEntry[] = [];
  let lastRawId: string | null = null;

  rows.forEach((r) => {
    const rawIdFromRow = pick(r, ["攤位編號"]);
    const rawId = (rawIdFromRow && rawIdFromRow.trim()) || lastRawId || "";
    if (!rawId) return;
    lastRawId = rawIdFromRow && rawIdFromRow.trim() ? rawIdFromRow.trim() : lastRawId;

    const id = rawId.toUpperCase();
    let booth = byId.get(id);
    if (!booth) {
      booth = {
        id,
        rawId,
        name: pick(r, ["社團名稱"]),
        url: pick(r, ["連結"]),
        keywords: (() => {
          const k = pick(r, ["Default攤位商品關鍵字(檢索用途)", "預設攤位商品關鍵字(檢索用途)", "關鍵字"]);
          return k ? k.split(SEP).map(s => s.trim()).filter(Boolean) : undefined;
        })(),
        items: [],
        _rawRows: [],
      };
      byId.set(id, booth);
      all.push(booth);
    } else {
      booth.name ||= pick(r, ["社團名稱"]);
      booth.url  ||= pick(r, ["連結"]);
      if (!booth.keywords) {
        const k = pick(r, ["Default攤位商品關鍵字(檢索用途)", "預設攤位商品關鍵字(檢索用途)", "關鍵字"]);
        if (k) booth.keywords = k.split(SEP).map(s => s.trim()).filter(Boolean);
      }
    }

    // 作品層級欄位
    const creationTheme = pick(r, ["創作主題"]);
    const themeRaw   = pick(r, ["主題標籤", "主題TAG"]);
    const themeTags  = themeRaw ? themeRaw.split(SEP).map(s => s.trim()).filter(Boolean) : undefined;

    const cpChars    = pick(r, ["主要CP / 角色(自填)", "主要CP/角色(自填)", "主要CP / 角色", "主要CP/角色"]);
    const bookTitle  = pick(r, ["品名(自填)", "品名"]);
    const isR18Str   = pick(r, ["是否為R18"]);
    const isR18      = isR18Str ? /r-?18|^18$|是|yes|true/i.test(isR18Str) : undefined;

    const author      = pick(r, ["作者(自填)", "作者"]);
    const productType = pick(r, ["商品類別"]);
    const isNewOrOld  = pick(r, ["新品/既品"]);

    const priceRaw = pick(r, ["售價(自填數字)", "售價"]);
    const priceNum = priceRaw ? Number((priceRaw.match(/\d+(?:[.,]\d+)?/g) || [])[0]?.replace(",", "")) || null : null;

    const actionType = pick(r, ["預定表單 / 宣傳資訊", "預定表單/宣傳資訊"]);
    const actionUrl  = pick(r, ["關聯連結(填一筆)", "關聯連結"]);

    // 是否這一列真的有作品內容
    const hasContent =
      creationTheme || (themeTags && themeTags.length) || cpChars || bookTitle || isR18 != null ||
      author || productType || isNewOrOld || priceRaw || actionType || actionUrl;

    if (hasContent) {
      booth.items.push({
        creationTheme,
        themeTags,
        cpChars,
        bookTitle,
        isR18,
        author,
        productType,
        isNewOrOld,
        priceRaw,
        priceNum,
        actionType,
        actionUrl,
        _raw: r,
      });
    }

    booth._rawRows?.push(r);
  });

  return { byId, all };
}

// === 新：同時支援 JSON & CSV ===
export async function loadStalls(url: string): Promise<LoadResult> {
  if (!url) throw new Error("CSV/JSON URL 未設定");

  const res = await fetch(url);
  if (!res.ok) throw new Error("資料載入失敗");

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  // 伺服器若已轉成 JSON（functions 版）
  if (ct.includes("application/json")) {
    const data = await res.json();
    // byId 若是 Array<[id, BoothEntry]>，可直接 new Map()
    if (Array.isArray(data?.byId)) {
      return { byId: new Map<string, BoothEntry>(data.byId), all: data.all || [] };
    }
    // 若是物件，也相容處理
    if (data?.byId && typeof data.byId === "object") {
      return { byId: new Map(Object.entries<BoothEntry>(data.byId)), all: data.all || [] };
    }
    throw new Error("JSON 結構不符：缺少 byId/all");
  }

  // 否則視為 CSV / 純文字（相容你現有流程）
  const text = await res.text();
  return fromCsvText(text);
}
