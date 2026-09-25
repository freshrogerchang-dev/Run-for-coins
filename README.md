# 金幣酷跑 Run for Coins

3D 火車軌道跑酷遊戲，使用 [Three.js](https://threejs.org/) 製作。純靜態網頁，不需要建置步驟。

## 玩法

- 沿著三條軌道一直往前跑，吃金幣、閃避障礙
- **紅白柵欄**：跳過去
- **黃黑高架柵欄**：滑鏟從下面鑽過
- **停靠的列車**：換軌道閃開，或從**黃黑斜坡**跑上車頂
- **亮著頭燈的列車**會迎面開過來，要提早換道
- 換道時撞到側面會被彈回，3 秒內再撞一次就出局
- 速度會隨距離越來越快；分數 = 距離 + 金幣 × 10

| 動作 | 鍵盤 | 手機 |
| --- | --- | --- |
| 換軌道 | ← → / A D | 左右滑 |
| 跳躍 | ↑ / W / 空白鍵 | 上滑 |
| 滑鏟（空中按下可快速落地） | ↓ / S | 下滑 |
| 暫停 | P / Esc | 右上角按鈕 |
| 靜音 | M | 右上角按鈕 |

## 執行

因為使用 ES Modules，需要透過本機伺服器開啟（直接雙擊 `index.html` 會被瀏覽器擋下）：

```bash
npx http-server . -p 8080
# 或
python3 -m http.server 8080
```

然後打開 <http://localhost:8080>。Three.js 由 jsDelivr CDN 載入，所以第一次需要網路。

也可以直接用 GitHub Pages 發佈這個資料夾。

## 畫面技術

- ACES 色調映射、PCF 軟陰影、HDR Bloom 後製、MSAA 抗鋸齒
- RoomEnvironment 環境反射（金幣和車身的金屬光澤）
- 自訂天空 Shader：漸層、太陽光暈、fbm 程序化雲層
- 所有貼圖（碎石、枕木、塗鴉牆、列車塗裝、大樓立面、海報）都用 Canvas 即時繪製，沒有任何圖片檔
- 音效與背景音樂用 Web Audio 即時合成
- 手機自動降低解析度與陰影品質

## 程式結構

```
index.html        介面（HUD、開始畫面、暫停、結算車票）
style.css
src/
  main.js         遊戲狀態、輸入、物理與碰撞、鏡頭
  config.js       遊戲常數（速度、重力、車道位置…）
  stage.js        渲染器、天空、燈光、Bloom、粒子、速度線
  environment.js  無限循環場景：軌道、塗鴉牆、電車線、車站月台、大樓
  level.js        關卡片段生成：列車、斜坡、柵欄、金幣
  models.js       列車 / 斜坡 / 柵欄 / 金幣 3D 模型
  player.js       跑者角色與程序化動畫
  textures.js     Canvas 程序化貼圖
  audio.js        Web Audio 音效與音樂
```

想新增場景主題（例如地鐵隧道、海邊、雪地），主要改 `environment.js` 的路段外觀和 `textures.js` 的貼圖即可；障礙物配置在 `level.js` 的 `chunk_*` 函式。
