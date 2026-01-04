# 2025 CH18 百合向 ONLY 攤位互動式地圖
Interactive Booth Map for CH18 Yuri-only Event

> 一個以 SVG 為基礎的互動式攤位地圖，協助參與百合向 ONLY 活動的讀者能快速查找攤位資訊與創作者。

---

## Live Demo
* Production Site：https://ch18-yuri-only.pages.dev/
* Plurk 宣傳噗文：https://www.plurk.com/p/3hramrw522
  
## Features
* SVG 為基礎的**互動式場地地圖**
* 攤位即時高亮、點擊查看詳細資訊
* 支援搜尋與標籤篩選
* 提供攤位收藏功能，方便活動現場快速查找
* 攤位資料由 Google Sheets（CSV） 驅動，方便非工程師維護
* 適合活動現場手機瀏覽

## Why this project?
這個專案是為了實際活動需求所開發，
目標是讓參與者能在活動期間快速找到感興趣的攤位，而不需要翻閱靜態圖片或 PDF。

主要實作內容包含：
* 前端互動設計與實作
* SVG 地圖結構規劃
* 資料驅動的攤位渲染與狀態管理
* 專案部署與實際上線

## Tech Stack
* Framework：Astro
* Frontend：React, TypeScript
* Hosting：Cloudflare Pages
* Data Source：Google Sheets (CSV)
* Assets：SVG-based venue map

---
# Development & Setup（給開發者）
> 以下內容主要給想 fork 或理解實作的人參考。

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

## 準備 SVG 地圖
- 將場地平面圖輸出為 `public/map/venue.svg`。
- 每個攤位需有 **唯一 id**（如 `A12`）。CSV 的 `spotId` 欄位要對應同名 id。

## Google Sheet 欄位建議
至少包含：`id, rawId, name, keywords, items, _rawRows`。
- `_rawRows` 以逗號分隔。
- 請將工作表 **發佈到網路（CSV）**，網站才抓得到。

## 常見問題
- **空白頁 / 只有框線**：確認 `public/map/venue.svg` 是否存在且可讀。
- **載不到資料**：確認 Cloudflare Pages 的 `PUBLIC_CSV_URL` 是否正確、該工作表已發佈為 CSV。