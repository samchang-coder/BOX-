# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案背景

這是 **Raymond-Agent** 專案（SAM 的 POS OS）底下的一個子專案。目前程式碼是一個很簡單的網頁聊天機器人雛形，但最終目標不是通用聊天機器人，而是**嵌入 POS 系統的客服 AI 助理**——讓使用 POS 的客人遇到問題（例如結帳失敗、如何退款、操作教學等）時，可以直接問這個助理來排解狀況。

修改這個專案時，功能、角色設定（system prompt）、架構規劃都應該朝「POS 客服助理」的方向去想，而不是當成一般 demo 聊天機器人來改。

要對接的零售 POS 系統：https://acpay-boxs-retail.zeabur.app （部署在 Zeabur）。

## 常用指令

- `npm start` — 啟動伺服器（`node server.js`）
- `npm run dev` — 開發模式啟動，檔案有改動會自動重啟（`node --watch server.js`）
- 目前沒有設定測試、build 或 lint 工具。

啟動前設定：複製 `.env.example` 為 `.env`，填入 `ANTHROPIC_API_KEY`。伺服器監聽的埠號由 `PORT` 決定（預設 3000）。

## 架構說明

整個專案是「後端負責跟 Claude API 對話、前端負責顯示聊天畫面」的簡單結構，沒有用任何前端框架或打包工具，檔案就是直接拿來跑。

- `server.js` — 後端主入口。聊天路由 `POST /api/chat`：接收前端傳來的 `{ messages }`（完整對話紀錄），呼叫 `client.messages.stream(...)` 串流呼叫 Claude，並把回覆內容以純文字串流的方式即時傳回前端。助理的角色設定（目前叫「Master」）寫在這裡的 `SYSTEM_PROMPT`。另外把 `budget.js` 的路由掛在 `/api/budget` 底下。`public/` 資料夾透過 `express.static` 直接當靜態網站服務。
- `public/index.html` — 聊天頁面骨架：一個聊天訊息顯示區 + 一個輸入表單，右上角有連結可以切到記帳頁面。
- `public/app.js` — 前端所有邏輯都在這裡：用一個記憶體陣列 `history` 保存對話紀錄（不會存檔，重新整理頁面就消失），送出訊息後用 `res.body.getReader()` 一段一段讀取後端串流回來的文字，即時顯示在畫面上。
- `public/style.css` — 聊天頁面與共用元件（如頁首、連結）的樣式。
- `logs/` — 每次對話結束後，後端會自動把「時間（台北時間）、客人問的內容、AI 回的完整內容」寫成一行 JSON，存到當天的檔案（例如 `logs/2026-08-19.log`）。此資料夾已加進 `.gitignore`，不會上傳到 Git。

### 記帳功能（2026-08-20 新增）

跟 POS 客服助理無關，是加在同一個專案裡的獨立小功能：每月記帳，可分類統計。

- `budget.js` — Express router，掛在 `/api/budget`。提供分類（`/categories`）與紀錄（`/records`，支援 `?month=YYYY-MM` 查詢）的增刪查 API。資料存成 `data/budget.json`（結構：`{ categories: string[], records: {id, date, category, amount, note}[] }`），此資料夾已加進 `.gitignore`，不會上傳到 Git。預設分類為「吃、喝、玩、樂、其他」，使用者可在畫面上自行新增/刪除分類。
- `public/budget.html` / `public/budget.js` / `public/budget.css` — 記帳頁面。可選月份、新增/刪除一筆一筆的花費紀錄、管理分類，並即時算出「本月總支出」與「各分類小計」（前端算，後端只回傳當月的原始紀錄）。金額都是正數（只記支出，不記收入），單一使用者共用一份資料，沒有登入機制。

**改動時要注意**：前後端之間傳的是「純文字串流」，不是結構化的 JSON 事件。如果之後要讓後端多回傳一些結構化資訊（例如：分類問題類型、附上相關 POS 操作步驟連結），`public/app.js` 裡讀取串流的那段邏輯也要跟著改，不能只當純文字處理。

## 目前進度（2026-08-19）

- 本機環境已裝好 Node.js（LTS，透過 winget 安裝）與專案套件（`npm install` 已跑過）。
- `.env` 已建立並填入 SAM 的 Anthropic API Key。
- 實測結果：伺服器可正常啟動、對話 log 機制運作正常（有正確寫入 `logs/`）；但呼叫 Claude API 時回傳「credit balance 太低」的錯誤——這是 Anthropic API 帳號（console.anthropic.com）額度不足，跟 Claude Pro 訂閱是分開計費的兩個系統，Pro 訂閱不包含 API 額度。
- **待辦**：SAM 需要到 https://console.anthropic.com/settings/billing 幫 API 帳號加值後，才能實際測試對話功能。加值完成前，暫緩繼續往下開發/測試。
