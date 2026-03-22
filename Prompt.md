# 如何產生這個專案的 Prompt (How to Generate This Project)

以下是產生此「CMoney ETF 資料檢視器」專案所使用的核心 Prompt 邏輯與步驟。

## 1. 初始開發階段 (Initial Development)

**Prompt:**
> 建立一個 React 全端應用程式，使用 Express 作為後端。
> 功能：從 CMoney API (`https://www.cmoney.tw/etf/api/data/getetfholdingdata?etfCode={code}`) 抓取台灣 ETF 的持股資料。
> 技術要求：
> - 後端：使用 Express 建立 API 代理 (Proxy)，解決 CORS 問題。
> - 前端：使用 React, TypeScript, Tailwind CSS。
> - UI 設計：現代化儀表板風格，包含表格 (Table) 與網格 (Grid) 兩種檢視模式切換。
> - 預設提供熱門 ETF 選單（如 0050, 0056, 00878 等）。
> - 使用 `lucide-react` 圖示與 `motion` 動態效果。

## 2. 功能擴充階段 (Feature Expansion)

**Prompt:**
> 為 ETF 選擇器增加「管理資料來源」功能。
> - 點擊齒輪圖示開啟設定面板。
> - 允許使用者輸入「ETF 代號」與「顯示名稱」來新增自定義來源。
> - 使用 `localStorage` 持久化儲存自定義列表。
> - 提供「重置為預設值」按鈕。

## 3. 編輯與驗證優化 (Edit & Validation Optimization)

**Prompt:**
> 增加編輯功能與重複代號檢查：
> - 在管理面板中為每個 ETF 增加編輯按鈕。
> - 當新增或編輯 ETF 時，若輸入的「代號」已存在於列表中，應在輸入框下方顯示紅色的錯誤提示訊息：「代號 "XXXX" 已存在，請使用其他代號。」
> - 錯誤提示應為即時顯示，且在使用者重新輸入時自動消失。
> - 確保編輯模式下，修改後的代號不會與其他現有代號衝突。

## 4. 文件化階段 (Documentation)

**Prompt:**
> 1. 用中文撰寫專案說明並寫入 `Readme.md`。
> 2. 將產生此專案的 Prompt 邏輯整理並寫入 `Prompt.md`。
