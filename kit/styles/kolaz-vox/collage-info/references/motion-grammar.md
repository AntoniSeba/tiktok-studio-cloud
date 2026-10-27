# 动效语法 · stop-motion 定格 + 拟音

## 为什么是定格

这个风格假装自己是手工纸拼贴的定格动画。smooth ease 会立刻暴露"这是网页动画"，所以：

- 30fps 渲染，落位对齐 **10fps 网格**（每 3 帧一格），一律 `ease:"steps(n)"`。
- 常用档位：`{duration:.3, ease:"steps(3)"}`（落位）、`{duration:.4, ease:"steps(4)"}`（滑入）、翻面 `steps(6)`、计时/进度 `steps(24)`。
- 每次重要落位后 **hold ≥ 0.8s**——暂停即是一张可读海报。5s 一条的节奏大致是：0–0.4 页眉，0.4–3.5 拼装，3.5 起静止收帧。
- 转场是纸片被**抽走 / 翻面 / 吸走 / 推入**，不用 opacity fade 当主转场（fade 只做 0.1–0.2s 的辅助消隐）。
- **样帧 = 收帧**：动画结束时的画面必须与 Gate 2 确认过的样帧一致。动画是"这张海报怎么拼出来的"，不是另一张画。

## 主动效清单（每条选一个，全片不重复）

| 主动效 | 适用 | 要点 |
|---|---|---|
| 吸入 | 概念封装、收纳 | 元素缩小 + 位移进入容器口，`steps(5)`，吸完目标内容逐行揭示 |
| 堆叠落位 | 系列预告、多单元 | 逐张从画外飞入，色条/编号/名称按 0.2s 间隔跟进 |
| 撞入 | 数字冲击 | 数字 scale 1.5→1 定格 3 格，配 pop 拟音 |
| 景深 | 时间压缩、背景文档 | 背景 blur 15px→0，与计时/进度同步收清 |
| 生长 | 决策树、流程 | 根→干→梁→支→节点，严格自下而上，`transform-origin` 对准生长方向 |
| 抽屉 | 分类库、公式库 | 全部格先松开一档，重点格抽到底 + 变点色 + 标签揭示 |
| 推焦收敛 | 多选一 | 落选项 blur+降透明+微缩，选中项微放大 + 点色描边遮罩画出 |
| 翻面 | 对比、痛点翻转 | rotateY 180，`preserve-3d`，正反面信息互为答案 |

派生不占名额：同模板换色（标题卡系列）、同 composition 延长时间轴分段（收拢/翻面/汇聚三段一条）。

## GSAP 结构（确定性硬规则）

```js
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({paused:true});   // 必须 paused
tl.from("#x", {y:-40, opacity:0, duration:.3, ease:"steps(3)"}, 0.9);  // 绝对时间
window.__timelines.<compositionId> = tl;    // 必须注册
```

- 只用绝对时间参数，不用相对链式默认排队。
- 计数器（计时、数字滚动）用 `tl.to(obj, {v:目标, ease:"steps(24)", onUpdate})` 由时间线驱动——不用 `setTimeout`/`rAF`/`Date.now()`。
- 撕边、微旋等"随机"全部预生成写死（collage.css 里的 torn-11/22/33 就是固定种子产物）。
- 无渲染期网络请求：gsap 用项目内 `assets/gsap.min.js`。

## 拟音（内置进成片）

音色库在 skill `assets/sfx/`（已裁短加淡出，来源 Mixkit 免版权）：

| 文件 | 用途 |
|---|---|
| pop-land / pop-soft / tick | 卡纸落位 / 大色块落位 / 密集序列小节拍 |
| click | 文字遮罩揭开 |
| whoosh-soft / whoosh-in / flip | 剪片滑入·纸条抽走 / 吸入·汇入 / 翻面 |
| reveal / focus / grow | zoom snap·合上 / 景深转清·退焦 / 生长 |

写法——`<audio>` 必须有 `id`，必须放在 `#root` 内（`.clip` 之后）：

```html
<!-- SFX · cue 表集中放文件底部，方便改时间 -->
<audio id="sfx-16-01" src="assets/sfx/pop-land.mp3" data-start="0.95"
       data-duration="0.31" data-track-index="2" data-volume="0.5"></audio><!-- 7 条观点 -->
```

规矩：

- 每条 3–7 个 cue，只配真正的落位/揭示/转场，静止段不配。
- 同一时间点只放一个，相邻 ≥ 0.25s；track-index 从 2 起逐个 +1。
- 音量一律 ≤ 0.5（BGM 在剪辑台叠加，预留 0.2 余量）。目标电平：峰值约 −9dB。
- cue 的 `data-start` 对齐动画时间线上的落位时刻，不对齐动作起点——咔哒声属于"落地"不属于"起飞"。
