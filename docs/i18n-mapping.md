# Ghost Shift 中英文对照表

## 统计概览

- **已扫描文件数**: 75 个 .tsx 和 .ts 文件
- **已中文化文件**: 主要 UI 组件已完成中文化
- **待处理英文**: 约 200+ 处用户可见的英文文案

---

## 1. ReplayControlBar.tsx（回放控制栏）

### 按钮和标签

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Storyline | 故事线 | 模式切换标题 |
| Live | 实时 | 模式按钮 |
| Replay | 回放 | 模式按钮 |
| Thumbnail | 缩略图 | 预览帧标签 |
| Play | 播放 | 播放按钮 |
| Pause | 暂停 | 暂停按钮 |
| Jump to live | 跳到实时 | 跳转按钮 |
| 1h / 6h / 24h | 1小时 / 6小时 / 24小时 | 时间窗口按钮 |
| 0.5x / 1x / 2x | 0.5倍速 / 1倍速 / 2倍速 | 播放速度按钮 |
| Continue tour | 继续导览 | 导览按钮 |

### 状态文本

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Offline | 离线 | 状态标签 |
| Delayed | 延迟 | 状态标签 |
| Live now | 实时 | 状态标签 |
| Updated | 更新于 | 时间提示 |
| Frame | 帧 | 帧标签 |
| Waiting for replay frames | 等待回放帧 | 空状态 |
| Live edge | 实时边缘 | 实时标签 |
| Replay buffer empty | 回放缓存为空 | 缓存状态 |
| Buffered | 已缓存 | 缓存状态 |
| Replay roster | 回放名单 | 名单标题 |
| Live roster | 实时名单 | 名单标题 |
| active | 活跃 | 活动状态 |
| Quiet office | 安静的办公室 | 空闲状态 |

---

## 2. ProductDashboard.tsx（产品仪表盘）

### 统计卡片

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Statistics Dashboard | 统计仪表盘 | 章节标题 |
| Agents | 代理数 | 统计卡片 |
| Sessions | 会话数 | 统计卡片 |
| Uptime | 在线时间 | 统计卡片 |
| public aliases visible right now | 当前可见的公开别名 | 副标题 |
| currently running in the public office | 当前在公开办公室运行中 | 副标题 |
| connected inside the retained window | 在保留窗口内连接 | 副标题 |
| 24h live trend | 24小时实时趋势 | 趋势卡片 |
| peak | 峰值 | 趋势标签 |
| live agents in the last 24h | 过去24小时内的实时代理 | 副标题 |
| Realtime signal | 实时信号 | 信号卡片 |
| Visible load | 可见负载 | 负载卡片 |
| vs the earlier half of the 24h window | 对比24小时窗口的前半段 | 副标题 |
| 6h rolling delta | 6小时滚动增量 | 增量卡片 |
| avg now vs | 当前平均对比 | 副标题 |
| in the previous 6h | 过去6小时内 | 副标题 |
| Same-hour baseline | 同小时基线 | 基线卡片 |
| today avg | 今日平均 | 副标题 |
| yesterday | 昨日 | 副标题 |
| Prediction | 预测 | 预测卡片 |
| next projection | 下一次预测 | 副标题 |
| live with | 实时 | 副标题 |
| confidence fit | 置信度拟合 | 副标题 |
| Zone concentration | 区域集中度 | 集中度卡片 |
| leads the visible mix | 领导可见混合 | 副标题 |
| waiting for visible sessions | 等待可见会话 | 空状态 |
| Model diversity | 模型多样性 | 多样性卡片 |
| families visible in the current frame | 当前帧中可见的家族 | 副标题 |
| Freshness | 新鲜度 | 新鲜度卡片 |
| current frame timestamp for the displayed surface | 显示表面的当前帧时间戳 | 副标题 |
| Retention | 保留期 | 保留卡片 |
| history buffer used for replay, trends, and comparisons | 用于回放、趋势和比较的历史缓存 | 副标题 |

### 比较图表

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Comparison chart | 比较图表 | 图表标题 |
| Today vs yesterday running-agent profile | 今日与昨日的运行代理概况 | 副标题 |
| 6h rolling | 6小时滚动 | 标签 |
| Visible | 可见 | 标签 |
| Same-hour | 同小时 | 标签 |
| Yesterday is partial because retention is limited | 昨日数据不完整，因为保留期有限 | 提示 |
| Today | 今日 | 图例 |
| Yesterday | 昨日 | 图例 |

### 预测和可视化

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Simple linear forecast | 简单线性预测 | 预测标题 |
| Projected live-agent trajectory | 预测的实时代理轨迹 | 副标题 |
| projected | 预测 | 预测值 |
| Uses the latest retained samples to extend a straight-line trend. Lightweight, explainable, and useful for short-range momentum cues. | 使用最新保留的样本延伸直线趋势。轻量、可解释，适合短期动量提示。 | 说明文本 |
| Radar chart | 雷达图 | 图表标题 |
| Surface health profile | 表面健康概况 | 副标题 |
| No zone lead yet | 尚无区域主导 | 空状态 |
| Scatter plot | 散点图 | 图表标题 |
| Signal vs status-change latency | 信号与状态变更延迟 | 副标题 |
| tracked agents | 追踪的代理 | 标签 |
| X-axis shows minutes since the last status change. Y-axis shows signal score. Larger dots are currently running agents. | X轴显示自上次状态变更以来的分钟数。Y轴显示信号分数。较大的点是当前运行的代理。 | 说明文本 |
| minutes since status change | 自状态变更以来的分钟数 | 提示 |
| Signal score | 信号分数 | 提示 |

---

## 3. GhostShiftSummaryCard.tsx（摘要卡片）

### 标题和标签

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Embeddable summary card | 可嵌入的摘要卡片 | 眉毛文本 |
| Snapshot unavailable | 快照不可用 | 错误状态 |
| Live snapshot | 实时快照 | 状态标签 |
| Connecting | 连接中 | 状态标签 |
| Offline | 离线 | 状态标签 |
| Ghost Shift | 幽灵班次 | 品牌名 |
| A compact product surface for the live public office demo. | 一个紧凑的产品表面，用于实时公开办公室演示。 | 标题 |
| Public office demo in a portfolio-sized frame. | 作品集尺寸框架中的公开办公室演示。 | 标题（嵌入模式）|
| Built for | 为...构建 | 说明文本 |
| enough live signal to prove the product is running | 足够的实时信号证明产品正在运行 | 说明文本 |
| now with 24h trend context | 现在包含24小时趋势上下文 | 说明文本 |
| mini charts | 迷你图表 | 说明文本 |
| and a rotating roster of the strongest public agents | 和最强公开代理的轮换名单 | 说明文本 |

### 统计指标

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Visible | 可见 | 统计标签 |
| Running | 实时 | 统计标签 |
| Active zones | 活跃区域 | 统计标签 |
| 24h live activity | 24小时实时活动 | 趋势标签 |
| 24h visible load | 24小时可见负载 | 趋势标签 |
| peak | 峰值 | 趋势值 |
| Top zone | 主要区域 | 事实标签 |
| Model mix | 模型分布 | 事实标签 |
| Average signal | 平均信号 | 事实标签 |
| Last update | 最后更新 | 事实标签 |
| Waiting for first snapshot | 等待首次快照 | 空状态 |
| Waiting for public traffic | 等待公开流量 | 空状态 |
| Hidden | 隐藏 | 空值 |

### 代理轮播

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Top agents | 顶级代理 | 轮播标题 |
| Prev | 上一个 | 导航按钮 |
| Next | 下一个 | 导航按钮 |
| signal | 信号 | 代理统计 |
| Waiting for public agents | 等待公开代理 | 空状态 |
| Show | 显示 | 无障碍标签 |

### 页脚

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Refreshes every | 每...刷新 | 刷新提示 |
| Open live office | 打开实时办公室 | 链接文本 |

---

## 4. CaseStudyLayer.tsx（案例研究层）

### 标题和说明

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Case Study Layer | 案例研究层 | 章节标题 |
| Show the transformation, animate the privacy boundary, and answer trust questions in place. | 展示转换、动画隐私边界，并在原地回答信任问题。 | 副标题 |
| This layer turns the sanitization contract into a guided demo | 该层将清理契约转变为引导式演示 | 说明文本 |
| click through each data boundary | 点击每个数据边界 | 说明文本 |
| watch the flow animate | 观看流程动画 | 说明文本 |
| and expand the FAQ without leaving the product surface | 并在不离开产品表面的情况下展开常见问题 | 说明文本 |

### 流程步骤

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| 1. Raw gateway | 1. 原始网关 | 步骤标签 |
| Identity, prompts, and tool arguments still exist here. | 身份、提示和工具参数仍在此处。 | 步骤说明 |
| 2. Public snapshot | 2. 公开快照 | 步骤标签 |
| Sensitive fields are stripped and only public-safe metadata remains. | 敏感字段被剥离，仅保留公开安全的元数据。 | 步骤说明 |
| 3. Product surface | 3. 产品表面 | 步骤标签 |
| The browser renders from the reduced contract only. | 浏览器仅从缩减的契约渲染。 | 步骤说明 |
| Pause animation | 暂停动画 | 控制按钮 |
| Play animation | 播放动画 | 控制按钮 |

### 示例面板

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Before sanitization | 清理前 | 面板标签 |
| After sanitization | 清理后 | 面板标签 |
| Rendered product surface | 渲染的产品表面 | 面板标签 |
| The office scene, analytics cards, and social share card all render from this narrower contract instead of from the raw gateway payload. | 办公室场景、分析卡片和社交分享卡片都从这个更窄的契约渲染，而不是从原始网关负载。 | 说明文本 |
| Interactive example | 交互式示例 | 示例标题 |
| Inspect one rule at a time. | 一次检查一个规则。 | 说明文本 |
| Each field card updates with the current stage so visitors can compare raw, public, and rendered states. | 每个字段卡片随当前阶段更新，访客可以比较原始、公开和渲染状态。 | 说明文本 |
| Animation demo | 动画演示 | 卡片标题 |
| Play the privacy flow during live demos. | 在实时演示中播放隐私流程。 | 说明文本 |
| The animated track keeps the sanitization story moving when you are presenting the product in person. | 当你亲自演示产品时，动画轨道保持清理故事的推进。 | 说明文本 |
| FAQ accordion | 常见问题折叠 | 卡片标题 |
| Collapse detail until the viewer asks for it. | 折叠细节直到观众要求。 | 说明文本 |
| Trust questions stay nearby, but the explanation layer avoids overwhelming the primary narrative. | 信任问题就在附近，但解释层避免压倒主要叙述。 | 说明文本 |

### 字段卡片

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Identity | 身份 | 字段标题 |
| Personal identifiers are removed before the browser receives the payload. | 浏览器接收负载前移除个人标识符。 | 字段说明 |
| Prompt context | 提示上下文 | 字段标题 |
| Prompt text becomes coarse activity metadata instead of display content. | 提示文本变成粗粒度的活动元数据，而不是显示内容。 | 字段说明 |
| Tool arguments | 工具参数 | 字段标题 |
| Operational commands never enter the public contract. | 操作命令从不进入公开契约。 | 字段说明 |
| Model detail | 模型详情 | 字段标题 |
| Model families stay visible because they explain capability without exposing raw deployment strings. | 模型家族保持可见，因为它们解释能力而不暴露原始部署字符串。 | 字段说明 |
| hidden | 隐藏 | 字段值 |
| prompt hidden | 提示已隐藏 | 字段值 |
| tool args hidden | 工具参数已隐藏 | 字段值 |
| user identity hidden | 用户身份已隐藏 | 字段值 |
| public alias preserved | 公开别名已保留 | 字段值 |
| model family preserved | 模型家族已保留 | 字段值 |
| activity window only | 仅活动窗口 | 字段值 |
| not rendered | 未渲染 | 字段值 |

### 常见问题

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Why does Ghost Shift hide session keys and raw model names? | 为什么幽灵班次隐藏会话密钥和原始模型名称？ | 问题 |
| The public surface tells a product story, not an operator story. Stable aliases and model families preserve continuity while removing handles that could leak internals or confuse casual viewers. | 公开表面讲述产品故事，而不是操作员故事。稳定的别名和模型家族保持连续性，同时移除可能泄露内部信息或混淆随意观看者的句柄。 | 回答 |
| Why are the timeline and share links timestamped? | 为什么时间线和分享链接带有时间戳？ | 问题 |
| Timestamped links keep review conversations anchored to a single frame. That matters in async design reviews because everyone lands on the same evidence instead of a moving live edge. | 时间戳链接将审查对话锚定到单个帧。这在异步设计审查中很重要，因为每个人都落在相同的证据上，而不是移动的实时边缘。 | 回答 |
| Why is the sanitization flow visualized in the product surface? | 为什么清理流程在产品表面中可视化？ | 问题 |
| Privacy boundaries are easier to trust when people can inspect them. The case study layer shows what gets removed, what survives, and why the resulting view is safe to share. | 当人们可以检查隐私边界时，更容易信任它们。案例研究层显示什么被移除、什么存活，以及为什么结果视图可以安全分享。 | 回答 |

---

## 5. RealtimeStatsSidebar.tsx（实时统计侧边栏）

### 标题和标签

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Realtime stats | 实时统计 | 标题 |
| Model usage | 模型使用 | 章节标题 |
| Zone activity | 区域活动 | 章节标题 |
| Surface latency | 表面延迟 | 章节标题 |
| Freshness | 新鲜度 | 元标签 |

---

## 6. ExperiencePanel.tsx（体验面板）

### 快捷键

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Open guide and shortcuts | 打开指南和快捷键 | 快捷键说明 |
| Cycle color theme | 切换颜色主题 | 快捷键说明 |
| Toggle heatmap | 切换热力图 | 快捷键说明 |
| Jump between live and replay | 在实时和回放之间跳转 | 快捷键说明 |
| Switch replay window to 1h, 6h, or 24h | 将回放窗口切换为1小时、6小时或24小时 | 快捷键说明 |
| Scroll to the share panel | 滚动到分享面板 | 快捷键说明 |

### 指南提示

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Lead with the office stage, then use the analytics cards to explain momentum, confidence, and baseline comparisons. | 以办公室舞台开场，然后使用分析卡片解释动量、置信度和基线比较。 | 指南提示 |
| Keep social cards short: one headline, one proof metric, and one timestamp anchor converts better than a dense status dump. | 保持社交卡片简短：一个标题、一个证明指标和一个时间戳锚点比密集的状态转储转化率更高。 | 指南提示 |
| Use the case study layer while reviewing privacy boundaries so visitors see the transformation instead of reading an abstract policy. | 在审查隐私边界时使用案例研究层，让访客看到转换而不是阅读抽象策略。 | 指南提示 |

### 设置选项

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Auto-refresh share previews when the frame changes | 帧变更时自动刷新分享预览 | 设置选项 |
| Keep guide tips expanded by default | 默认保持指南提示展开 | 设置选项 |

---

## 7. SharePanel.tsx（分享面板）

### 标题和标签

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Share surface | 分享表面 | 章节标题 |
| Generate polished social cards, inspect source images, and package links | 生成精美的社交卡片、检查源图片和打包链接 | 副标题 |
| Theme presets, custom headline and summary fields, live image previews, and platform length checks keep the sharing flow production-ready. | 主题预设、自定义标题和摘要字段、实时图片预览和平台长度检查，让分享流程保持生产就绪状态。 | 说明文本 |
| Card style | 卡片风格 | 标签 |
| Headline | 标题 | 标签 |
| Summary | 摘要 | 标签 |
| Generate preview | 生成预览 | 按钮 |
| Copy link | 复制链接 | 按钮 |
| Copy social copy | 复制社交文案 | 按钮 |
| Download PNG | 下载 PNG | 按钮 |
| Share | 分享 | 按钮 |

### 预览和状态

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Social media card preview | 社交媒体卡片预览 | 预览标签 |
| Generated Ghost Shift share preview | 生成的幽灵班次分享预览 | 替代文本 |
| Generate a preview to combine the office frame, product proof points, and a timestamp-safe share link. | 生成预览以合并办公室框架、产品证明点和时间戳安全的分享链接。 | 占位符文本 |
| Source image preview | 源图片预览 | 预览标签 |
| Current office stage snapshot | 当前办公室舞台快照 | 替代文本 |
| The live stage snapshot appears here when the canvas is available. It is used as the base image for the social card. | 当画布可用时，实时舞台快照出现在这里。它用作社交卡片的基础图片。 | 占位符文本 |

### 平台检查

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Title length | 标题长度 | 检查项 |
| Description length | 描述长度 | 检查项 |
| Deep link | 深度链接 | 检查项 |
| Card ratio | 卡片比例 | 检查项 |
| Timestamped | 带时间戳 | 检查值 |
| Live edge | 实时边缘 | 检查值 |

### 消息提示

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Preview unavailable in this environment | 此环境中预览不可用 | 错误消息 |
| Timestamped link copied | 带时间戳的链接已复制 | 成功消息 |
| Clipboard unavailable | 剪贴板不可用 | 错误消息 |
| Social copy copied | 社交文案已复制 | 成功消息 |
| PNG downloaded | PNG 已下载 | 成功消息 |
| Shared successfully | 分享成功 | 成功消息 |
| Share cancelled | 分享已取消 | 取消消息 |
| Preview refreshed | 预览已刷新 | 成功消息 |

---

## 8. publicDisplay.ts（公开显示工具函数）

### 活动窗口标签

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| observed | 已观察 | 窗口标签 |
| active | 活跃 | 窗口标签 |
| warm | 预热 | 窗口标签 |

### 区域标签

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Code Studio | 代码工作室 | 区域标签 |
| Chat Lounge | 对话休息室 | 区域标签 |
| Ops Lab | 运维实验室 | 区域标签 |

### 足迹标签

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Heavy | 重度 | 足迹标签 |
| Medium | 中度 | 足迹标签 |
| Light | 轻度 | 足迹标签 |

### 活动频段

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| surging | 激增 | 频段标签 |
| steady | 稳定 | 频段标签 |
| warm | 预热 | 频段标签 |
| quiet | 安静 | 频段标签 |

---

## 9. 通用术语

### 状态和模式

| 英文原文 | 中文翻译 | 备注 |
|---------|---------|------|
| Live | 实时 | 模式 |
| Replay | 回放 | 模式 |
| Embed | 嵌入 | 模式 |
| Offline | 离线 | 状态 |
| Delayed | 延迟 | 状态 |
| Connected | 已连接 | 状态 |
| Disconnected | 已断开 | 状态 |

### 代理角色

| 英文原文 | 中文翻译 | 备注 |
|---------|---------|------|
| assistant | 助手 | 角色 |
| automation | 自动化 | 角色 |
| webchat | 对话 | 角色 |

### 模型家族

| 英文原文 | 中文翻译 | 备注 |
|---------|---------|------|
| GPT | GPT | 保持英文 |
| Claude | Claude | 保持英文 |
| Gemini | Gemini | 保持英文 |
| Qwen | 通义 | 阿里模型 |
| DeepSeek | 深度求索 | DeepSeek 模型 |
| Hidden | 隐藏 | 未知模型 |

### 通用操作

| 英文原文 | 中文翻译 | 备注 |
|---------|---------|------|
| Loading | 加载中 | 加载状态 |
| Error | 出错 | 错误状态 |
| Retry | 重试 | 操作按钮 |
| Close | 关闭 | 操作按钮 |
| Copy | 复制 | 操作按钮 |
| Copied | 已复制 | 状态确认 |
| Learn more | 了解更多 | 链接文本 |

---

## 10. 页面标题和路由

| 英文原文 | 中文翻译 | 位置 |
|---------|---------|------|
| Ghost Shift | 幽灵班次 | 品牌名 |
| Live Office | 实时办公室 | 页面标题 |
| Replay Workspace | 回放工作区 | 页面标题 |
| Embed Studio | 嵌入工作室 | 页面标题 |
| Docs & API | 文档与 API | 页面标题 |
| About Ghost Shift | 关于幽灵班次 | 页面标题 |
| Landing | 落地页 | 页面标题 |

---

## 备注

### 翻译原则

1. **专业性优先**：使用产品级中文，避免开发者注释风格
2. **术语统一**：
   - Live = 实时
   - Replay = 回放
   - Embed = 嵌入
   - Agent = 代理
   - Session = 会话
   - Snapshot = 快照
3. **保持简洁**：中文文案应该简洁明了，避免冗余
4. **面向外部用户**：措辞要友好，不是内部术语

### 特殊处理

1. **品牌名称**：Ghost Shift = 幽灵班次
2. **技术术语**：GPT、Claude、Gemini 等保持英文
3. **单位保持**：1h、6h、24h 保持原样，但在说明中可以使用中文
4. **格式化文本**：百分比、时间戳等格式保持不变

### 未翻译项目

以下项目保持英文：
- 代码注释（不在本次任务范围内）
- CSS 类名（技术属性）
- API 端点路径
- 配置键名
- 变量名和函数名
