export type Stall = {
  id: string;
  name: string;
  creator_handle?: string;
  category?: string;
  desc?: string;
  links?: { site?: string; instagram?: string };
  map: { area?: string; spotId: string };
  tags?: string[];
};

export async function loadStalls(csvUrl: string): Promise<Stall[]> {
  if (!csvUrl) return [];
  const res = await fetch(csvUrl, { cache: 'no-store' });
  const text = await res.text();
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map((h) => h.trim());

  const rows = lines.map((line) => {
    const cols = splitCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (cols[i] ?? '').trim()))

    return {
      id: obj.id,
      name: obj.name,
      creator_handle: obj.creator_handle,
      category: obj.category,
      desc: obj.desc,
      links: { site: obj.site, instagram: obj.instagram },
      map: { area: obj.area, spotId: obj.spotId || obj.id },
      tags: obj.tags ? obj.tags.split(/[，,]/).map((t) => t.trim()).filter(Boolean) : []
    } as Stall;
  });

  return rows;
}

// 極簡 CSV 解析（支援用雙引號包住的逗號）
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'; // 轉義的雙引號
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}