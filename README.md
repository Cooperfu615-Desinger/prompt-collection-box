# Prompt 咒語收藏盒 ✨

一個精美的深色模式單頁 Web App，用來收藏、整理與快速複製你的 AI Prompt 咒語。

## 功能特色

- 📝 **新增咒語** - 輸入標題、Prompt 內容、分類標籤、範例圖片
- 🗂️ **卡片展示** - 以精美卡片呈現所有收藏的咒語
- 📋 **一鍵複製** - 點擊即可複製咒語內容到剪貼簿
- ✏️ **編輯刪除** - 隨時修改或移除舊的咒語
- 💾 **自動儲存** - 使用 LocalStorage，資料不會因重整而消失
- 🔍 **搜尋過濾** - 依標題或標籤快速找到需要的咒語

## 如何預覽

### 方法一：直接開啟
直接在瀏覽器中開啟 `index.html` 檔案即可使用。

### 方法二：本地伺服器（推薦）
```bash
# 使用 Python
python3 -m http.server 8080

# 或使用 Node.js
npx serve .
```
然後開啟瀏覽器前往 `http://localhost:8080`

## 檔案結構

```
prompt-collection-box/
├── index.html   # 主頁面 HTML
├── style.css    # 深色模式樣式
├── script.js    # 核心 JavaScript 邏輯
├── README.md    # 專案說明文件
└── .gitignore   # Git 忽略檔案設定
```

## 技術棧

- HTML5
- CSS3（CSS Variables, Grid, Flexbox, Animations）
- Vanilla JavaScript（ES6+）
- LocalStorage API
- Clipboard API

## 未來優化方向

- [ ] 匯出/匯入 JSON 備份
- [ ] 拖曳排序功能
- [ ] 更多主題色彩選擇
- [ ] PWA 離線支援

---

Made with 💜 for prompt collectors
