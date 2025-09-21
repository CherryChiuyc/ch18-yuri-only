import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const csvUrl = import.meta.env.PUBLIC_CSV_URL;
  if (!csvUrl) return new Response("Missing PUBLIC_CSV_URL", { status: 500 });

  const res = await fetch(csvUrl, { redirect: "follow" });
  if (!res.ok) return new Response(`Upstream ${res.status}`, { status: res.status });

  const text = await res.text();
  return new Response(text, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
};
