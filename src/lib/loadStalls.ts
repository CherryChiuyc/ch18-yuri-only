// src/lib/loadStalls.ts

export type BoothRow = {
  id: string;     // 標準化後的攤位編號 (大寫、去空白)
  rawId: string;  // 原始攤位編號
  name?: string;  // 社團名稱
  url?: string;   // 社團連結
};

export type BoothMap = Map<string, BoothRow>;

const DEFAULT_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRXBnQBv361Wkj-LE8Bdwsx5_VtlQkEdFEqLPsgkE7ear9HRtxRvme5bx8WBqqAfF7nZbo7pRWqSH9d/pub?gid=0&single=true&output=csv";

// 解析 CSV 成為陣列
function parseCSV(text: string): string[][] {
  return text
    .split("\n")
    .map((line) => line.split(",").map((c) => c.trim()));
}

const norm = (s: any) => (s ?? "").toString().trim().toUpperCase();

export async function loadStalls(csvUrl?: string): Promise<BoothMap> {
  const url = csvUrl || DEFAULT_CSV;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("CSV 載入失敗");

  const text = await res.text();
  const rows = parseCSV(text);
  if (!rows.length) return new Map();

  const header = rows[0];
  const idxId = header.findIndex((h) => h === "攤位編號");
  const idxName = header.findIndex((h) => h === "社團名稱");
  const idxLink = header.findIndex((h) => h === "連結");

  const map: BoothMap = new Map();

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const rawId = cols[idxId] || "";
    if (!rawId) continue;

    map.set(norm(rawId), {
      id: norm(rawId),
      rawId,
      name: cols[idxName] || undefined,
      url: cols[idxLink] || undefined,
    });
  }

  return map;
}
