# 生产环境 · 渲染 · QA

## 环境

- hyperframes 需 Node ≥ 22（`node -v` 先确认）。若系统默认 node 版本过低但装有新版，把新版目录前置到 PATH（如 `PATH=/usr/local/bin:$PATH`）再跑 npx。
- 版本锁定 `hyperframes@0.7.56`（`npx --yes hyperframes@0.7.56 <cmd>`），避免 latest 漂移。
- 样帧截图用 headless Chrome（见 SKILL.md Gate 2），不依赖 hyperframes。
- 项目默认放 `~/hyperframes-projects/<YYYY-MM-DD>-collage-info-<主题>/`，可用环境变量 `HYPERFRAMES_PROJECTS_DIR` 改根目录。

## 项目结构（scripts/new_project.sh 自动生成）

```
<项目>/
├── hyperframes.json      # paths: blocks=compositions, assets=assets
├── package.json          # scripts 锁 0.7.56
├── meta.json
├── index.html            # 项目索引页（可选，给 preview 用）
├── assets/               # collage.css + gsap.min.js + sfx/（从 skill 拷入，项目自包含）
├── style-plates/         # Gate 2 样帧 HTML + PNG
├── compositions/         # 每条一个 .html
├── renders/              # 成片
└── qa/                   # 末帧 contact sheet
```

## composition 要点

- 根节点：`<div id="root" data-composition-id="sNN" data-start="0" data-duration="5" data-width="1080" data-height="1920" data-fps="30">`
- 内层 `.clip` 要有稳定 id（`id="scene-NN"`），否则 lint 警告。
- 资源路径写**根相对**（`assets/...`），不写 `../assets/`——渲染器以项目根为 base。
- 字体：collage.css 顶部已有 `@font-face src:local()` 三连，够用。

## 渲染与 QA

```bash
cd <项目>
npx --yes hyperframes@0.7.56 lint
npx --yes hyperframes@0.7.56 render \
  -c compositions/<名>.html -o renders/<名>.mp4 -q standard --quiet
```

- 单条 5s 约 7–10 秒渲完。逐条渲，看输出里的 `"audioCount"` 是否等于 cue 数。
- **lint 已知误报**：加了 `<audio>` 后会报 `media_in_subcomposition`——lint 假定 compositions/ 下是挂在 index.html 的子合成，而我们用 `render -c` 当独立入口。只要渲染日志有 `hasAudio:true` 且产物有 AAC 流即可无视，不要为它改结构。其余 lint 错误（路径、字体、缺 id）要真修。
- 末帧 QA（暂停即海报的最终检查）：

```bash
for f in renders/*.mp4; do n=$(basename "$f" .mp4); \
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"); \
  ffmpeg -v error -ss $(echo "$d - 0.3"|bc) -i "$f" -frames:v 1 -vf scale=400:-1 -y "qa/end-$n.png"; done
ffmpeg -v error -pattern_type glob -i "qa/end-*.png" \
  -filter_complex "tile=<列>x<行>:margin=8:padding=8:color=0x1E1E1E" -frames:v 1 -y qa/all-end.jpg
```

- 音频抽查一条：`ffmpeg -i <mp4> -af volumedetect -f null /dev/null`，峰值应在 −12 到 −6dB。

## QA 检查单（交付前自查）

- [ ] 末帧与 Gate 2 确认样帧一致
- [ ] 信息全部在 y ≤ 1280，底部只有地层
- [ ] 每帧只有一处点色批注；点色占比 <10%
- [ ] 主动效全片不重复；落位有 hold
- [ ] audioCount = cue 数；无 lint 真错误
- [ ] 屏幕文字全部来自逐字稿原文，占位处是空白卡而非编造内容

## 交付

- 成片留在项目 `renders/`；把 mp4 + `qa/all-end.jpg` 发给用户，并问要不要拷到指定目录（如 `~/Downloads/<主题>-信息动画/`）。
- 项目里补 `DESIGN.md`（色本分配 + 截图锚点待替换表）和 `STORYBOARD.md`（逐条节拍），照参考实现的格式写短点。
