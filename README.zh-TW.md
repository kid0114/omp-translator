# omp-translator

[English](README.md)

[omp](https://github.com/can1357/oh-my-pi) 的即時翻譯擴充套件：你的輸入會被翻譯成**輸出語言**（主模型思考與回覆所用的語言），而模型的回覆會以你的**輸入語言**（你的閱讀語言）顯示。工作階段歷史保留原文；翻譯僅用於顯示，完全不影響模型實際看到的內容。

- 自動偵測來源語言——用任何語言輸入都可以
- 雙向翻譯：輸入→輸出、回覆→顯示兩個方向可分別開關（`/translator input` 只翻譯輸入）
- 顯示翻譯：回覆生成期間顯示本地化的「翻譯中…」佔位；回覆完成後，通過驗證的譯文才取代原文區段。這不是逐 token 的串流翻譯。
- Markdown 語法、程式碼、連結目標與可辨識的技術字面內容在本地保持不變
- 翻譯由獨立、可自行選擇的模型執行，主模型設定不受影響
- 輸入方向 fail-closed：翻譯失敗就不會送出，原稿會回到編輯器
- 顯示翻譯只存在記憶體中；已印出的終端歷史不會重繪

Pi 對應套件：[pi-translator-live](https://github.com/kid0114/pi-translator-live)。

## 安裝

```bash
omp plugin install github:kid0114/omp-translator
```

然後啟動新的 omp 程序。套件安裝時會自動安裝 mdast/GFM 解析器相依套件，無需另外設定。偏好設定存在 `~/.omp/agent/translator.json`。

本機開發（符號連結，改檔即時生效）：

```bash
git clone https://github.com/kid0114/omp-translator.git
cd omp-translator
omp plugin link .
```

鎖定發行版本而非追蹤預設分支：

```bash
omp plugin install github:kid0114/omp-translator#v1.0.0
```

更新 / 移除：

```bash
omp plugin upgrade omp-translator
omp plugin uninstall omp-translator
```

安裝或更新後請開一個新的 omp 工作階段，擴充模組才會載入。

## 需求

- 支援外掛的 omp（`omp plugin install github:…`）
- 翻譯模型白名單：Gemini、Muse，或已註冊的 `local-hymt2` 提供者。便宜、快速的模型（例如 Gemini Flash 級）最適合當翻譯模型。

## 首次使用

翻譯預設開啟。若 `translator.json` 已記錄且該模型仍可用，就用該模型；否則優先選已註冊的 `local-hymt2`，再否則選 Gemini/Muse。用 `/translator default` 儲存選擇。

## 用法

翻譯預設開啟。指令：

| 指令 | 效果 |
|---|---|
| `/translator` 或 `/translator both` | 啟用輸入 + 回覆翻譯 |
| `/translator input` | 只翻譯輸入；回覆維持輸出語言 |
| `/translator off` | 關閉；取消進行中的翻譯 |
| `/translator original` | 唯讀檢視上一則完成回覆的原文 |
| `/translator model [query]` | 本次執行切換翻譯模型（省略則開選擇器） |
| `/translator default [query]` | 同上，並存成預設 |
| `/translator default clear` | 清除已存的預設模型 |
| `/translator default input [lang]` | 設定回覆的**顯示語言**（例如 `zh-TW`） |
| `/translator default output [lang]` | 設定**主模型語言**（例如 `en`） |

> 命名說明：`default input` 選的是回覆**顯示**語言；`default output` 選的是輸入被翻譯**成**、主模型用來回覆的語言。

語言參數可用代碼（`en`、`zh-CN`、`zh-TW`、`ja`…）或英文名稱；省略則開選擇器。內建 33 種語言。

輸入翻譯進行中可按 Esc 取消。

## 支援語言

33 種內建語言都可作為輸入（顯示）語言或輸出（主模型）語言任意搭配——來源語言由翻譯模型自動偵測。

| 代碼 | 語言 | 代碼 | 語言 |
|---|---|---|---|
| `en` | English | `ru` | Russian |
| `zh-CN` | Simplified Chinese | `ar` | Arabic |
| `zh-TW` | Traditional Chinese | `hi` | Hindi |
| `ja` | Japanese | `th` | Thai |
| `ko` | Korean | `vi` | Vietnamese |
| `fr` | French | `id` | Indonesian |
| `de` | German | `ms` | Malay |
| `es` | Spanish | `tl` | Filipino |
| `pt` | Portuguese | `tr` | Turkish |
| `it` | Italian | `pl` | Polish |
| `cs` | Czech | `nl` | Dutch |
| `km` | Khmer | `my` | Burmese |
| `fa` | Persian | `gu` | Gujarati |
| `ur` | Urdu | `te` | Telugu |
| `mr` | Marathi | `bn` | Bengali |
| `ta` | Tamil | `jv` | Javanese |
| `he` | Hebrew | | |

用 `/translator default input <code>`（顯示）與 `/translator default output <code>`（模型）設定；英文名稱（`japanese`…）也可以，省略參數則開選擇器。

註：從右到左的語言（`ar`、`he`、`fa`、`ur`）原樣交給終端；顯示品質取決於終端的雙向文字支援（開啟 bidi 的 iTerm2、WezTerm、Windows Terminal 較好）。

## 選擇翻譯模型

### 本地模型（有的話建議用）

本地 Hy-MT2 伺服器讓文字留在本機（macOS Apple Silicon）。目標機型是 MacBook Pro，含 Pro 以上晶片（Max / Ultra）。其他晶片的速度未知。啟動器讀取 `sysctl hw.memsize`，只提供裝得下的權重：

- **7B 8-bit**（首選）：**32 GiB+**，MLX 預留 **10 GiB**
- **7B 4-bit**：**16 GiB+**，預留 **6 GiB**
- **1.8B**（先 8-bit 再 4-bit）：**8 GiB+**，預留 **2 GiB**

未設定 `HYMT2_MODEL` 時，在裝得下的選項裡選最好的，並優先用 Hugging Face 快取。低於 32 GiB 不會啟動 7B 8-bit。


```bash
python3 -m pip install mlx-lm
scripts/start-hymt2 --check
scripts/start-hymt2
```

只綁 loopback。預設埠為 mlx_lm 的 8080（可用 `HYMT2_PORT` 覆寫）。管線分片為可選：`HYMT2_PIPELINE=1 scripts/start-hymt2`。

將 `examples/models.yml` 合併進 `~/.omp/agent/models.yml`，再執行 `/translator default local-hymt2/mlx-community/Hy-MT2-7B-8bit`（或啟動器實際選到的 4-bit / 1.8B id）。

### 託管模型

使用你已在 omp 登入的 Gemini 或 Muse 模型——不必額外設定，會出現在 `/translator model`。請優先選便宜、快速、非推理模型：每次輸入與每次回覆都會跑翻譯，重量級推理模型只會增加延遲與 token 成本。

## 運作方式

- **輸入方向（fail-closed）：** 散文會在送出前譯成輸出語言。翻譯失敗就不送出。僅在編輯器為空時還原該次原稿；較新的草稿或工作階段不會被覆蓋。指令、`!shell`、路徑與程式碼不翻譯。
- **顯示方向（整份回退）：** 回覆生成期間顯示「翻譯中…」佔位。定稿後整則回覆翻譯並通過驗證，才用 Markdown 顯示轉換發布。歷史與主模型看到的內容不變。失敗時顯示完整原文（含表格儲存格），狀態在回覆外，不會把失敗文字或計數寫進段落或儲存格。
- 系統提示只要求主模型用輸出語言回覆，並保留你的任務、程式碼、路徑與工具參數。
- **先解析，只翻譯文字：** `mdast-util-from-markdown` 加 GFM 與數學擴充，在呼叫模型前解析來源。只有可翻譯的文字跨度成為單元；同一工作中相同單元共用一次請求，相異單元依序翻譯。只有程式碼／字面內容時不必呼叫模型。沒有由模型攜帶的 XML 包裝、標記複製協定或片段重試協定。
- **本地保留來源：** 原始 Markdown 分隔符、區塊順序、表格版面、換行、程式碼、行內數學（`$…$`）、展示數學（`$$…$$`）、連結目標／參考 ID，以及可辨識的指令、路徑、URL 與其他技術字面內容留在客戶端。公式不會傳給翻譯模型，並逐位元組原樣保留。明確的連結標籤可翻譯，目標不變。字面內容維持原位置，不會被模型重排。
- **重建與驗證：** 譯文以文字跳脫後拼回原始跨度。整份文件再解析一次；Markdown 結構與受保護字面值必須與原文一致才接受。缺漏散文、引入技術字面內容或結構變化會拒絕整份結果。
- 一般單斜線複合詞（含 `類型/reputation` 這類混寫）在沒有明確路徑證據時視為散文。模稜兩可的路徑請放進行內程式碼以明確保留。
- 每個請求自帶取消與 **60 秒輸出閒置計時**。計時只在第一個非空文字、思考或工具呼叫增量之後開始；空心跳不重置。佇列／預填等待沒有擴充套件期限，但提供者傳輸與重試限制仍適用。
- 模式、工作階段、模型或語言變更會取消過期工作並阻止過期快取寫入。較新的互動輸入會取代較舊的待處理輸入。
- 請求經由單一佇列序列化，輸入優先。跨工作階段公平排程與非同步分片**尚未實作**。

## 驗證

```bash
bun test extensions/translator/translator-core.test.ts
```

核心回歸涵蓋來源跨度還原、GFM 表格／任務、巢狀 Markdown、Unicode 位移、程式碼與技術字面內容、連結目標、斜線複合詞、強調邊界、模型標點跳脫，以及缺漏或不安全散文的整份拒絕。數學案例涵蓋行內與多行公式、CRLF、表格儲存格、純數學輸入，以及防止譯文中的美元符號引入數學語法。解析器相依套件由套件管理器安裝。

## 疑難排解

失敗寫入 `~/.omp/logs/`，含方向、目標語言、所選模型、耗時、類別與原因。擴充套件不記錄原文與譯文。

修改擴充檔案或更新套件後，請開新的 omp 程序載入變更。切換翻譯模型或開關翻譯不會重載擴充原始碼。

- `idle-timeout`：輸出已開始，接著 60 秒沒有進展。
- `provider-timeout` 或 `provider`：提供者／傳輸失敗；光是佇列等待不算擴充套件逾時。
- `completion`、`language` 或 `protection`：輸出不完整、散文未譯、不安全散文，或重建／Markdown 結構不符。完整原文仍可見；部分譯文不會發布。
- 輸入失敗：不送出；僅在不會覆蓋較新編輯器內容時還原原稿。
- `/translator original` 開啟上一則完成回覆的原文，不改歷史。

## 隱私

你的輸入與模型回覆會傳送給你所選的翻譯模型。在意這點的話請選用本地端點。除此之外不會傳送任何資料；本套件只在你自己的 omp 代理目錄中儲存偏好設定（`translator.json`）。
