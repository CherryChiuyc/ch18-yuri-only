// import type { APIRoute } from "astro";

// export const GET: APIRoute = async () => {
//   const csvUrl = import.meta.env.PUBLIC_CSV_URL;
//   if (!csvUrl) return new Response("Missing PUBLIC_CSV_URL", { status: 500 });

//   const res = await fetch(csvUrl, { redirect: "follow" });
//   if (!res.ok) return new Response(`Upstream ${res.status}`, { status: res.status });

//   const text = await res.text();
//   return new Response(text, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
// };
import type { APIRoute } from "astro";

function normalizePubToCsv(raw: string): string {
  try {
    const u = new URL(raw);
    // /pubhtml → /pub 並補上 output=csv
    if (u.pathname.endsWith("/pubhtml")) {
      u.pathname = u.pathname.replace(/\/pubhtml$/, "/pub");
      u.searchParams.set("output", "csv");
      // 常用參數補齊
      if (!u.searchParams.has("single")) u.searchParams.set("single", "true");
      if (!u.searchParams.has("gid")) u.searchParams.set("gid", "0");
      return u.toString();
    }
    // 如果本來就是 /pub，但沒帶 output=csv，就補上
    if (u.pathname.endsWith("/pub") && !u.searchParams.has("output")) {
      u.searchParams.set("output", "csv");
      if (!u.searchParams.has("single")) u.searchParams.set("single", "true");
      if (!u.searchParams.has("gid")) u.searchParams.set("gid", "0");
      return u.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

function buildGvizCsvUrl(editUrl: string, gid = "0") {
  try {
    const u = new URL(editUrl);
    // 只吃 /d/<SID>/... 這類格式
    const m = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!m) return null;
    const sid = m[1];
    const out = new URL(`https://docs.google.com/spreadsheets/d/${sid}/gviz/tq`);
    out.searchParams.set("tqx", "out:csv");
    out.searchParams.set("gid", gid);
    return out.toString();
  } catch {
    return null;
  }
}

async function fetchTextNoCache(url: string) {
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  const text = await res.text();
  return { res, text };
}

function looksLikeHtml(s: string) {
  const head = s.slice(0, 200).toLowerCase().trim();
  return !s.trim() || head.startsWith("<!doctype") || head.startsWith("<html");
}

export const GET: APIRoute = async ({ url }) => {
  const raw = import.meta.env.PUBLIC_CSV_URL;
  const edit = import.meta.env.PUBLIC_SHEET_EDIT_URL || ""; // 可選
  const gid = url.searchParams.get("gid") || "0";

  if (!raw) {
    return new Response("Missing PUBLIC_CSV_URL", { status: 500 });
  }

  // 候選清單：先嘗試 pub→csv，再 fallback 到 gviz
  const candidates: string[] = [];
  const norm = normalizePubToCsv(raw);
  if (norm) candidates.push(norm);
  if (raw !== norm) candidates.push(raw); // 原始也嘗試一下（萬一你已經是 output=csv）
  const gvizFromEdit = edit ? buildGvizCsvUrl(edit, gid) : null;
  if (gvizFromEdit) candidates.push(gvizFromEdit);

  let finalBody = "";
  let finalUrl = "";
  let upstreamType = "";
  let upstreamStatus = 0;

  for (const cand of candidates) {
    try {
      const { res, text } = await fetchTextNoCache(cand);
      upstreamStatus = res.status;
      upstreamType = res.headers.get("content-type") || "";
      // 僅接受「不是 HTML」且有內容
      if (res.ok && !looksLikeHtml(text)) {
        finalBody = text;
        finalUrl = res.url || cand;
        break;
      }
    } catch {
      // ignore 并試下一個
    }
  }

  if (!finalBody) {
    return new Response(
      [
        "CSV 取得失敗：候選來源都是 HTML 或空內容。",
        `請檢查：`,
        `1) Google 試算表是否「發佈到網路」`,
        `2) PUBLIC_CSV_URL 是否為 /pub?...&output=csv（不是 pubhtml）`,
        `3)（建議）提供 PUBLIC_SHEET_EDIT_URL 以便使用 gviz CSV 端點`,
      ].join("\n"),
      {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Candidates": candidates.join(" | "),
          "X-Upstream-Status": String(upstreamStatus),
          "X-Upstream-Type": upstreamType,
        },
      }
    );
  }

  return new Response(finalBody, {
    headers: {
      // 用 text/plain 方便你在瀏覽器直接檢視
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Source-Url": finalUrl,
      "X-Upstream-Type": upstreamType,
    },
  });
};
