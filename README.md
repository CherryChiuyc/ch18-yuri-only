# CH18 百合向ONLY攤位地圖（Astro + Cloudflare Pages）

## 快速開始（本機）
1. 安裝 Node.js 18 以上（建議 20）。
2. 安裝依賴：`npm install`
3. 開發模式：`npm run dev`（http://localhost:4321）

## 部署到 Cloudflare Pages（連 GitHub）
1. 在 Cloudflare Pages 建立專案（Connect to Git -> 選你的 **私有** repo）。
2. Build 設定：
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Output directory: `dist`
3. 在 **Settings → Environment variables** 新增：
   - `PUBLIC_CSV_URL` = 你的 Google Sheet 匯出 CSV 的網址：
     `https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=0`
4. Deploy！

> 注意：`PUBLIC_` 前綴會讓變數在前端可讀（必要，因為前端要發請求抓 CSV）。若你之後換成 Apps Script JSON API，也請把 URL 放在這個變數裡。

## 準備你的 SVG 地圖
- 將場地平面圖輸出為 `public/map/venue.svg`。
- 每個攤位需有 **唯一 id**（如 `A12`）。CSV 的 `spotId` 欄位要對應同名 id。

## Google Sheet 欄位建議
至少包含：`id, name, desc, site, instagram, area, spotId, tags`。
- `tags` 以逗號分隔。
- 若 `spotId` 留空，程式會回退用 `id`。
- 請將工作表 **發佈到網路（CSV）**，網站才抓得到。

## 常見問題
- **空白頁 / 只有框線**：確認 `public/map/venue.svg` 是否存在且可讀。
- **載不到資料**：確認 Cloudflare Pages 的 `PUBLIC_CSV_URL` 是否正確、該工作表已發佈為 CSV。
- **我要加搜尋/篩選**：在 `Map.tsx` 上方加入一個 input，對 `stalls` 做 `filter` 後重新渲染即可。