# Prompt 咒語收藏盒

一個深色模式單頁 Web App，用來收藏、分類、搜尋、備份與快速複製 AI Prompt。  
目前版本已從早期 LocalStorage 單機版升級為 Firebase backed 的私人 Prompt 管理工具。

## 目前功能

- Google 登入，前端 UI 目前限制指定帳號存取
- Firestore 即時同步 Prompt 與自訂標籤
- Firebase Storage 儲存每個 Prompt 版本的範例圖片
- Prompt 新增、編輯、刪除與一鍵複製
- 每筆 Prompt 支援最多 5 個版本頁籤
- 固定標籤池、自訂標籤、分類顏色與標籤篩選
- Gemini API 自動產生標題與標籤
- 依最後更新、標題、標籤排序
- ZIP 全量備份，包含 JSON、TXT 與可下載的圖片
- 舊 LocalStorage 資料自動遷移到 Firestore

## 技術棧

- HTML5
- CSS3
- Vanilla JavaScript
- Firebase Compat SDK 10.8.0
  - Authentication
  - Firestore
  - Storage
- Gemini API
- JSZip
- jsdom，用於本地 DOM smoke test

## 檔案結構

```text
prompt-collection-box/
├── index.html        # 單頁 App 結構與 CDN script
├── style.css         # 深色 UI、抽屜、卡片、標籤、登入頁樣式
├── script.js         # Firebase、狀態、CRUD、渲染、備份、AI 生成邏輯
├── firestore.rules   # Firestore 私人單帳號安全規則
├── storage.rules     # Storage 私人單帳號安全規則
├── firebase.json     # Firebase rules 部署設定
├── check_ids.js      # 檢查 JS getElementById 參照是否存在於 HTML
├── test_jsdom.js     # 無登入狀態的 DOM smoke test
├── ids.txt           # DOM id 盤點紀錄
├── get_ids.txt       # 目前空檔，保留待整理
├── package.json      # 本地開發與檢查指令
├── package-lock.json
└── README.md
```

## 本地開發

先安裝依賴：

```bash
npm install
```

啟動本地靜態伺服器：

```bash
npm run dev
```

開啟：

```text
http://localhost:8080
```

也可以直接開啟 `index.html`，但建議使用本地伺服器，較接近瀏覽器實際載入 Firebase/CDN 與 Clipboard API 的情境。

## 檢查與測試

執行所有目前可用檢查：

```bash
npm run check
```

這會依序執行：

```bash
npm run check:syntax
npm run check:ids
npm run test:dom
```

各指令用途：

- `npm run check:syntax`：用 `node --check` 檢查 JS 語法。
- `npm run check:ids`：確認 `script.js` 內的 `getElementById(...)` 都能在 `index.html` 找到。
- `npm run test:dom`：用 jsdom mock Firebase，跑一次無登入狀態的 DOM smoke test。

目前還沒有完整 E2E 測試。涉及登入、Firestore、Storage、備份下載、圖片上傳與 Gemini API 的流程仍需用瀏覽器人工驗證，或後續補 Playwright 測試。

## Firebase 前置條件

目前 Firebase 設定寫在 `script.js` 的 `firebaseConfig`。這些值是前端 Firebase client config，不等於後端私鑰；真正的資料安全必須靠 Firebase Console 裡的 Firestore Rules 與 Storage Rules。

本 repo 已提供私人單帳號規則範本：

- `firestore.rules`
- `storage.rules`
- `firebase.json`

目前規則只允許 `cooperfu.615@gmail.com` 登入後讀寫 `prompts`、`tagPool` 與 `images/`。其他 collection、document 與 storage path 預設拒絕。

接手或部署前請確認：

- Firebase Authentication 已啟用 Google provider。
- Firestore 有 `prompts` collection。
- Firestore 有 `tagPool` collection，用於自訂標籤。
- Firebase Storage bucket 可用。
- Firebase Console 內的 Firestore Rules 已套用 `firestore.rules`。
- Firebase Console 內的 Storage Rules 已套用 `storage.rules`。
- 前端的 `ALLOWED_EMAIL` 只能當 UI gate，不能取代 Firebase Rules。

若已安裝 Firebase CLI 並登入正確專案，可以用以下指令部署規則：

```bash
firebase deploy --only firestore:rules,storage
```

也可以直接在 Firebase Console 手動貼上 `firestore.rules` 與 `storage.rules` 的內容。

## Gemini API Key

Gemini API Key 由使用者在設定視窗輸入，儲存在瀏覽器 LocalStorage 的 `gemini-api-key`。  
目前不會上傳到自家伺服器，但會由瀏覽器直接呼叫 Gemini API。

注意事項：

- 這種做法適合私人工具與本地使用。
- 若未來要開放多人使用，建議改由後端或 serverless function 代理，避免 API key 暴露在瀏覽器環境。
- Gemini model 目前使用 `gemini-2.0-flash:generateContent`。

## 資料模型概覽

Prompt 文件大致格式：

```js
{
  title: string,
  variants: [
    {
      tabName: string,
      prompt: string,
      imageUrl: string | null
    }
  ],
  tags: string[],
  createdAt: string,
  updatedAt: string
}
```

自訂標籤文件大致格式：

```js
{
  category: string,
  tags: string[]
}
```

## 備份流程

點擊「全部備份」會：

1. 從 Firestore 讀取所有 Prompt。
2. 產生 `system_backup.json`。
3. 產生 `Prompts_Backup.txt`。
4. 嘗試抓取每個版本的圖片並放入 `images/`。
5. 下載 `Prompt_Backup.zip`。

圖片下載可能受 CORS 限制而失敗，失敗項目會在備份完成時提示。

## 已知技術債

- Firebase Rules 已納入 repo，但尚未加入 emulator 測試。
- `script.js` 還是大型單檔，後續應拆成資料層、UI 層、Firebase 層與工具函式。
- Firestore `onSnapshot` 目前沒有集中管理 unsubscribe callback。
- 圖片上傳 Storage path 需要整理，避免空白與不安全檔名。
- 大量 HTML 字串與 inline onclick，後續可逐步改成 DOM API 或集中 event delegation。
- `alert` / `confirm` 可改為一致的 modal/toast 體驗。
- 缺少完整 E2E 測試與 Firebase emulator 測試。

## 建議優化路線

1. 補文件與開發流程。
2. 修正 Firebase/Storage 安全與高風險 bug。
3. 拆分 `script.js`，降低後續維護成本。
4. 補 UI 與資料操作測試。
5. 優化手機版抽屜、備份體驗、錯誤狀態與載入狀態。
6. 視功能成長再評估是否遷移到 Vite/React 或保留 Vanilla 模組化。
