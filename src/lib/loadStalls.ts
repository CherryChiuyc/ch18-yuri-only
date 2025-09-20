// src/lib/loadStalls.ts
// 輕量 CSV 解析 + 建立 { 攤位ID -> 攤位名稱 } 對照表
// 若你在 .env 設了 PUBLIC_CSV_URL，會優先使用

const DEFAULT_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRXBnQBv361Wkj-LE8Bdwsx5_VtlQkEdFEqLPsgkE7ear9HRtxRvme5bx8WBqqAfF7nZbo7pRWqSH9d/pub?gid=0&single=true&output=csv";

// 依你的試算表欄位名稱調整
const FIELD_ID = "攤位編號";
const FIELD_NAME = "社團名稱";

const norm = (s: string | number | null | undefined) =>
  (s ?? "").toString().trim().toUpperCase();

// 簡易 CSV 解析（支援引號包覆、逗號、跳行）
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // 連續兩個 " => 轉義 "
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        cell += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ",") {
        row.push(cell);
        cell = "";
        i++;
        continue;
      }
      if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        i++;
        continue;
      }
      if (ch === "\r") {
        // 處理 \r\n
        i++;
        continue;
      }
      cell += ch;
      i++;
    }
  }
  // 收尾
  row.push(cell);
  rows.push(row);
  return rows;
}

export type BoothMap = Map<string, string>;

export async function loadStalls(): Promise<BoothMap> {
  const CSV_URL = (import.meta as any).env?.PUBLIC_CSV_URL || DEFAULT_CSV;

  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("CSV 載入失敗");
  const text = await res.text();

  const rows = parseCSV(text);
  if (!rows.length) return new Map();

  const header = rows[0];
  const idxId = header.indexOf(FIELD_ID);
  const idxName = header.indexOf(FIELD_NAME);

  if (idxId === -1 || idxName === -1) {
    console.warn("CSV 欄位名找不到，請檢查 loadStalls.ts 中的 FIELD_ID/FIELD_NAME。");
    return new Map();
  }

  const map: BoothMap = new Map();
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const id = norm(cols[idxId]);
    const name = (cols[idxName] ?? "").toString().trim();
    if (!id) continue;
    map.set(id, name || "（未命名攤位）");
  }
  return map;
}
