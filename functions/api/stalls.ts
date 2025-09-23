// /functions/api/stalls.ts
import type { PagesFunction } from "@cloudflare/workers-types";

// ====== 依你現有 loadStalls.ts 的型別 ======
type WorkItem = {
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
type BoothEntry = {
  id: string;
  rawId: string;
  name?: string;
  url?: string;
  keywords?: string[];
  items: WorkItem[];
  _rawRows?: Record<string, string>[];
};

// ====== 你現有的 CSV 解析＋正規化（濃縮自 loadStalls.ts） ======
const SEP = /[|｜│]+/g; // 直立線家族分隔  :contentReference[oaicite:4]{index=4}

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
function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const hit = Object.keys(row).find((x) => x.trim() === k.trim());
    const v = hit ? row[hit] : undefined;
    if (v != null && v.toString().trim() !== "") return v.toString().trim();
  }
  return undefined;
}

function normalizeToShape(text: string): { byId: Array<[string, BoothEntry]>; all: BoothEntry[] } {
  const rows = parseCSV(text);
  const byId = new Map<string, BoothEntry>();
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
    const priceNum = priceRaw ? Number((priceRaw.match(/\d+(?:[.]\d+)?/g) || [])[0]?.replace(",", "")) || null : null;

    const actionType = pick(r, ["預定表單 / 宣傳資訊", "預定表單/宣傳資訊"]);
    const actionUrl  = pick(r, ["關聯連結(填一筆)", "關聯連結"]);

    const hasContent =
      creationTheme || (themeTags && themeTags.length) || cpChars || bookTitle || isR18 != null ||
      author || productType || isNewOrOld || priceRaw || actionType || actionUrl;

    if (hasContent) {
      byId.get(id)!.items.push({
        creationTheme, themeTags, cpChars, bookTitle, isR18,
        author, productType, isNewOrOld, priceRaw, priceNum, actionType, actionUrl, _raw: r,
      });
    }
    byId.get(id)!._rawRows?.push(r);
  });

  return { byId: Array.from(byId.entries()), all };
}

// ====== 上游來源挑選（優先 gviz，其次 publish-to-web CSV） ======
function normalizePubToCsv(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.pathname.endsWith("/pubhtml")) {
      u.pathname = u.pathname.replace(/\/pubhtml$/, "/pub");
      u.searchParams.set("output", "csv");
      if (!u.searchParams.has("single")) u.searchParams.set("single", "true");
      if (!u.searchParams.has("gid")) u.searchParams.set("gid", "0");
      return u.toString();
    }
    if (u.pathname.endsWith("/pub") && !u.searchParams.has("output")) {
      u.searchParams.set("output", "csv");
      if (!u.searchParams.has("single")) u.searchParams.set("single", "true");
      if (!u.searchParams.has("gid")) u.searchParams.set("gid", "0");
      return u.toString();
    }
    return raw;
  } catch { return raw; }
}
function buildGvizCsvUrl(editUrl: string, gid = "0") {
  try {
    const u = new URL(editUrl);
    const m = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!m) return null;
    const sid = m[1];
    const out = new URL(`https://docs.google.com/spreadsheets/d/${sid}/gviz/tq`);
    out.searchParams.set("tqx", "out:csv");
    out.searchParams.set("gid", gid);
    return out.toString();
  } catch { return null; }
}
async function fetchTextNoCache(url: string) {
  const res = await fetch(url, { redirect: "follow", cache: "no-store", cf: { cacheTtl: 0, cacheEverything: false } });
  const text = await res.text();
  return { res, text };
}
function looksLikeHtml(s: string) {
  const head = s.slice(0, 200).toLowerCase().trim();
  return !s.trim() || head.startsWith("<!doctype") || head.startsWith("<html");
}

// ====== 簡易伺服器端快取 + 請求合併，避免高併發羊群 ======
let cacheBody: string | null = null;
let cacheAt = 0;
const TTL_MS = 15_000;
let inflight: Promise<string> | null = null;

export const onRequestGet: PagesFunction = async (ctx) => {
  const { request, env } = ctx as unknown as { request: Request; env: { PUBLIC_CSV_URL?: string; PUBLIC_SHEET_EDIT_URL?: string } };
  const raw = env.PUBLIC_CSV_URL;
  const edit = env.PUBLIC_SHEET_EDIT_URL || "";
  if (!raw) return new Response(JSON.stringify({ error: "PUBLIC_CSV_URL missing" }), { status: 500 });

  const url = new URL(request.url);
  const gid = url.searchParams.get("gid") || "0";

  const now = Date.now();
  if (cacheBody && (now - cacheAt) < TTL_MS) {
    return new Response(cacheBody, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "access-control-allow-origin": "*",
        "x-debug-from": "functions-cache",
      },
    });
  }

  if (!inflight) {
    inflight = (async () => {
      const candidates: string[] = [];
      const norm = normalizePubToCsv(raw);
      if (norm) candidates.push(norm);
      if (raw !== norm) candidates.push(raw);
      const gviz = edit ? buildGvizCsvUrl(edit, gid) : null;
      if (gviz) candidates.unshift(gviz); // 優先 gviz（較新鮮）

      let finalCsv = "";
      for (const cand of candidates) {
        try {
          const { res, text } = await fetchTextNoCache(cand);
          const ct = res.headers.get("content-type") || "";
          if (res.ok && !looksLikeHtml(text) && /csv|plain|text/.test(ct)) { finalCsv = text; break; }
          if (res.ok && !looksLikeHtml(text) && !ct) { finalCsv = text; break; } // 有些 gviz 回 header 不齊
        } catch { /* try next */ }
      }
      if (!finalCsv) throw new Error("upstream not available");

      const shaped = normalizeToShape(finalCsv);
      const body = JSON.stringify(shaped);
      cacheBody = body;
      cacheAt = Date.now();
      return body;
    })().finally(() => { inflight = null; });
  }

  try {
    const body = await inflight;
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "access-control-allow-origin": "*",
        "x-debug-from": "functions-fresh",
      },
    });
  } catch (e: any) {
    if (cacheBody) {
      return new Response(cacheBody, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
          "x-debug-from": "functions-stale",
        },
      });
    }
    return new Response(JSON.stringify({ error: e?.message || "upstream failed" }), { status: 502 });
  }
};
