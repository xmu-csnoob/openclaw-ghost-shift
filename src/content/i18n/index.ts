import { agentI18n } from './agent.js'
import { analyticsI18n } from './analytics.js'
import { commonI18n } from './common.js'
import { navI18n } from './nav.js'
import { replayI18n } from './replay.js'
import { text } from './shared.js'

export const i18n = {
  ...commonI18n,
  ...navI18n,
  ...agentI18n,
  ...analyticsI18n,
  ...replayI18n,

  cards: {
    office: {
      eyebrow: text('核心展示', 'Core demo'),
      title: text('公开办公演示', 'Public office demo'),
      body: text('一个实时像素办公室，把 Agent 工作变成几秒钟就能看懂的内容。', 'A live pixel office that makes Agent work legible in seconds.'),
    },
    embed: {
      eyebrow: text('作品集嵌入', 'Portfolio embed'),
      title: text('摘要卡片', 'Summary card'),
      body: text('紧凑的 Embed 卡片，适合放在作品集或博客中。', 'A compact Embed card for portfolios and blogs.'),
    },
    privacy: {
      eyebrow: text('隐私边界', 'Privacy boundary'),
      title: text('安全分享', 'Safe sharing'),
      body: text('只展示公开信息，敏感数据完全隐藏。', 'Only public-safe information is shown; sensitive data stays hidden.'),
    },
  },

  summaryCard: {
    eyebrow: text('可嵌入的摘要卡片', 'Embeddable summary card'),
    snapshotUnavailable: text('快照不可用', 'Snapshot unavailable'),
    liveSnapshot: text('实时快照', 'Live snapshot'),
    connecting: text('连接中', 'Connecting'),
    offline: text('离线', 'Offline'),
    iframeTitle: text('Ghost Shift 摘要卡片', 'Ghost Shift summary card'),
    title: {
      feature: text('一个紧凑的产品表面，用于实时公开办公室演示。', 'A compact product surface for the live public office demo.'),
      embed: text('作品集尺寸的 Embed 框架中的公开办公室演示。', 'Public office demo in a portfolio-sized Embed frame.'),
    },
    body: text(
      '为 me.wenfei4288.com 构建：足够的实时信号证明产品正在运行，现在还带有24小时趋势上下文、迷你图表和轮换的最强公开 Agent 名单。',
      'Built for me.wenfei4288.com: enough live signal to prove the product is running, now with 24h trend context, mini charts, and a rotating roster of the strongest public Agents.',
    ),
    metrics: {
      visible: text('可见', 'Visible'),
      running: text('实时', 'Live'),
      activeZones: text('活跃区域', 'Active zones'),
    },
    sparklines: {
      liveActivity: text('24小时实时活动', '24h live activity'),
      visibleLoad: text('24小时可见负载', '24h visible load'),
      peak: text('峰值', 'peak'),
    },
    facts: {
      topZone: text('主要区域', 'Top zone'),
      modelMix: text('模型分布', 'Model mix'),
      averageSignal: text('平均信号', 'Average signal'),
      lastUpdate: text('最后更新', 'Last update'),
      waitingForFirstSnapshot: text('等待首次快照', 'Waiting for the first snapshot'),
      waitingForPublicTraffic: text('等待公开流量', 'Waiting for public traffic'),
    },
    carousel: {
      topAgents: text('顶级 Agent', 'Top Agents'),
      prev: text('上一个', 'Prev'),
      next: text('下一个', 'Next'),
      signal: text('信号', 'signal'),
      waitingForPublicAgents: text('等待公开 Agent', 'Waiting for public Agents'),
      show: text('显示', 'Show'),
    },
    footer: {
      refreshesEvery: text('刷新间隔', 'Refreshes every'),
      openLiveOffice: text('打开实时办公室', 'Open live office'),
    },
  },

  caseStudy: {
    eyebrow: text('案例研究层', 'Case study layer'),
    title: text('展示清理过程、动画隐私边界，并在原地回答信任问题。', 'Show the sanitization flow, animate the privacy boundary, and answer trust questions in place.'),
    modalTitle: text('案例研究 - 隐私转换', 'Case study - privacy transition'),
    description: text(
      '该层将清理契约转变为引导式演示：点击每个数据边界、观看流程动画，并在不离开产品表面的情况下展开常见问题。',
      'This layer turns the sanitization contract into a guided demo: inspect each boundary, watch the flow animate, and unfold FAQ answers without leaving the product surface.',
    ),
    flow: {
      rawGateway: text('原始网关', 'Raw gateway'),
      publicSnapshot: text('公开快照', 'Public snapshot'),
      productSurface: text('产品表面', 'Product surface'),
      rawDetail: text('身份、提示和工具参数仍在此处。', 'Identity, prompts, and tool arguments stay here.'),
      publicDetail: text('敏感字段被剥离，仅保留公开安全的元数据。', 'Sensitive fields are stripped; only public-safe metadata remains.'),
      surfaceDetail: text('浏览器仅从缩减的契约渲染。', 'The browser renders only from the reduced contract.'),
      pauseAnimation: text('暂停动画', 'Pause animation'),
      playAnimation: text('播放动画', 'Play animation'),
    },
    panels: {
      beforeSanitization: text('清理前', 'Before sanitization'),
      afterSanitization: text('清理后', 'After sanitization'),
      renderedProductSurface: text('渲染的产品表面', 'Rendered product surface'),
      surfaceCardExplanation: text('办公室场景、分析卡片和分享卡片都从这个更窄的契约渲染，而不是从原始网关负载。', 'Office scenes, analytics cards, and share cards all render from this narrower contract rather than the raw gateway payload.'),
    },
    fields: {
      identity: text('身份', 'Identity'),
      identityNote: text('浏览器接收负载前移除个人标识符。', 'Personal identifiers are removed before the payload reaches the browser.'),
      promptContext: text('提示上下文', 'Prompt context'),
      promptContextNote: text('提示文本会变成粗粒度的活动元数据，而不是直接显示内容。', 'Prompt text becomes coarse activity metadata rather than rendered content.'),
      toolArguments: text('工具参数', 'Tool arguments'),
      toolArgumentsNote: text('操作命令从不进入公开契约。', 'Action commands never enter the public contract.'),
      modelDetail: text('模型详情', 'Model detail'),
      modelDetailNote: text('模型家族保持可见，因为它们解释能力而不暴露原始部署字符串。', 'Model families stay visible because they explain capability without exposing raw deployment strings.'),
      hidden: text('隐藏', 'Hidden'),
      promptHidden: text('提示已隐藏', 'Prompt hidden'),
      transcriptHidden: text('对话记录已隐藏', 'Transcript hidden'),
      toolArgsHidden: text('工具参数已隐藏', 'Tool arguments hidden'),
      userIdentityHidden: text('用户身份已隐藏', 'User identity hidden'),
      publicAliasPreserved: text('公开别名已保留', 'Public alias preserved'),
      modelFamilyPreserved: text('模型家族已保留', 'Model family preserved'),
      activityWindowOnly: text('仅活动窗口', 'Activity window only'),
      notRendered: text('未渲染', 'Not rendered'),
    },
    cards: {
      interactive: {
        eyebrow: text('交互式示例', 'Interactive example'),
        title: text('一次检查一个规则。', 'Inspect one rule at a time.'),
        body: text('每个字段卡片都会随着当前阶段更新，让访客可以比较原始、公开和渲染状态。', 'Each field card updates with the current stage so visitors can compare raw, public, and rendered states.'),
      },
      animation: {
        eyebrow: text('动画演示', 'Animated walkthrough'),
        title: text('在实时演示中播放隐私流程。', 'Play the privacy flow inside the live demo.'),
        body: text('当你亲自演示产品时，动画轨道会持续推进清理故事。', 'The animated track keeps the sanitization story moving while you present the product live.'),
      },
      faq: {
        eyebrow: text('常见问题折叠', 'FAQ accordion'),
        title: text('按需展开细节。', 'Keep the details folded until asked.'),
        body: text('信任问题就在附近，但解释层不会压倒主叙事。', 'Trust questions stay close, but the explanation layer avoids overwhelming the main narrative.'),
      },
    },
    faq: {
      hideSessionKeys: {
        question: text('为什么 Ghost Shift 隐藏 Session key 和原始模型名称？', 'Why does Ghost Shift hide Session keys and raw model names?'),
        answer: text('公开表面讲述的是产品故事，而不是操作员故事。稳定的别名和模型家族保留了连续性，同时去掉可能泄露内部信息或让随意观看者困惑的句柄。', 'Public surfaces tell the product story, not the operator story. Stable aliases and model families preserve continuity while removing handles that can leak internals or confuse casual viewers.'),
      },
      timestampedLinks: {
        question: text('为什么时间线和分享链接带时间戳？', 'Why are timeline and share links timestamped?'),
        answer: text('带时间戳的链接会把审查对话锚定到单个帧。在异步设计审查里这很重要，因为每个人都能落在同一份证据上，而不是移动中的实时边缘。', 'Timestamped links anchor review conversations to a single frame. That matters in async design review because everyone lands on the same evidence instead of a moving live edge.'),
      },
      sanitizationVisualized: {
        question: text('为什么要在产品表面中可视化清理流程？', 'Why visualize the sanitization flow in the product surface?'),
        answer: text('当人们可以检查隐私边界时，就更容易信任它。案例研究层展示了什么被移除、什么被保留，以及为什么结果可以安全分享。', 'Privacy boundaries are easier to trust when people can inspect them. The case study layer shows what gets removed, what survives, and why the result is safe to share.'),
      },
    },
  },

  experience: {
    eyebrow: text('体验层', 'Experience layer'),
    title: text('引导叙事、展示快捷键，让页面适应观看者', 'Guide the narrative, surface shortcuts, and adapt the page to the viewer'),
    accessibility: {
      controls: text('体验层控制', 'Experience layer controls'),
    },
    actions: {
      hideGuide: text('隐藏指南', 'Hide guide'),
      showGuide: text('显示指南', 'Show guide'),
      hideSettings: text('隐藏设置', 'Hide settings'),
      showSettings: text('显示设置', 'Show settings'),
      jumpToShare: text('跳到分享', 'Jump to share'),
      jumpToCaseStudy: text('跳到案例', 'Jump to case study'),
    },
    guide: {
      eyebrow: text('指南提示', 'Guide notes'),
      title: text('让产品叙事更容易理解', 'Make the product story easier to follow'),
      tips: [
        text('以办公室舞台开场，再用分析卡片解释动量、置信度和基线比较。', 'Open on the office stage, then use analytics cards to explain momentum, confidence, and baseline comparisons.'),
        text('让社交卡片保持简短：一个标题、一个证明指标和一个时间戳锚点，比密集的状态转储更容易转化。', 'Keep share cards short: one headline, one proof metric, and one timestamp anchor convert better than a dense status dump.'),
        text('在审查隐私边界时启用案例研究层，让访客看到转换过程，而不是阅读抽象策略。', 'Use the case study layer when reviewing privacy boundaries so visitors can see the transformation instead of reading an abstract policy.'),
      ],
    },
    shortcuts: {
      eyebrow: text('键盘快捷键', 'Keyboard shortcuts'),
      title: text('演示和快速控制的快捷方式', 'Shortcuts for demos and quick control'),
      items: [
        { key: '?', action: text('打开指南和快捷键', 'Open guide and shortcuts') },
        { key: 'T', action: text('切换颜色主题', 'Cycle color theme') },
        { key: 'G', action: text('切换热力图', 'Toggle heatmap') },
        { key: 'L / R', action: text('在实时和回放之间跳转', 'Jump between Live and Replay') },
        { key: '1 / 6 / 2', action: text('将回放窗口切换为1小时、6小时或24小时', 'Switch replay window to 1h, 6h, or 24h') },
        { key: 'S', action: text('滚动到分享面板', 'Scroll to the share panel') },
      ],
    },
    settings: {
      eyebrow: text('个性化', 'Personalize'),
      title: text('调整界面以适应你的偏好', 'Tune the interface to your preference'),
      colorTheme: text('颜色主题', 'Color theme'),
      themes: {
        aurora: {
          label: text('Aurora', 'Aurora'),
          description: text('冷调蓝色渐变配合柔和金色高光，适合作为默认产品展示。', 'Cool blue gradients with soft gold highlights for the default product showcase.'),
        },
        ember: {
          label: text('Ember', 'Ember'),
          description: text('更温暖的琥珀红色调，让重点信息和分享卡片更具编辑感。', 'Warmer amber-red tones that make highlights and share cards feel more editorial.'),
        },
        circuit: {
          label: text('Circuit', 'Circuit'),
          description: text('更锐利的绿青色点缀，营造更技术化的遥测氛围。', 'Sharper green-teal accents for a more technical telemetry mood.'),
        },
      },
      density: text('密度', 'Density'),
      comfortable: text('舒适', 'Comfortable'),
      compact: text('紧凑', 'Compact'),
      behavior: text('行为', 'Behavior'),
      language: text('语言', 'Language'),
      autoRefreshSharePreviews: text('帧变更时自动刷新分享预览', 'Auto-refresh share previews when frames change'),
      keepGuideTipsExpanded: text('默认保持指南提示展开', 'Keep guide notes expanded by default'),
    },
  },

  share: {
    eyebrow: text('分享表面', 'Share surface'),
    title: text('生成精美的社交卡片、检查源图片和打包链接', 'Generate polished social cards, inspect source images, and package the link'),
    description: text('主题预设、自定义标题和摘要字段、实时图片预览和平台长度检查，让分享流程保持生产就绪状态。', 'Theme presets, custom headlines and summaries, live image previews, and platform length checks keep the share workflow production-ready.'),
    defaultHeadline: text('Ghost Shift 让公开办公室一眼可懂。', 'Ghost Shift makes the public office legible at a glance.'),
    defaultSocialCopy: text('{headline}，{freshness}，当前有 {visible} 个可见 Agent，其中 {running} 个正在运行。', '{headline}. {freshness}. {visible} visible Agents, {running} running right now.'),
    defaults: {
      headline: text('Ghost Shift 让公开办公室一眼可懂。', 'Ghost Shift makes the public office legible at a glance.'),
      summary: text('实时办公室、24小时趋势和时间戳链接，把产品证明点压缩进一张可分享的卡片。', 'A live office, 24h trend context, and timestamped links compress product proof into a shareable card.'),
      socialCopy: text('{headline}，{freshness}，当前 {visible} 个可见 Agent，{running} 个运行中。', '{headline} {freshness} with {visible} visible Agents and {running} running now.'),
    },
    cardStyle: text('卡片风格', 'Card style'),
    headline: text('标题', 'Headline'),
    summary: text('摘要', 'Summary'),
    buttons: {
      generatePreview: text('生成预览', 'Generate preview'),
      copyLink: text('复制链接', 'Copy link'),
      copySocialCopy: text('复制社交文案', 'Copy social copy'),
      downloadPNG: text('下载 PNG', 'Download PNG'),
      share: text('分享', 'Share'),
    },
    preview: {
      socialMediaCard: text('社交媒体卡片预览', 'Social card preview'),
      sourceImage: text('源图片预览', 'Source image preview'),
      generatedSharePreview: text('生成的 Ghost Shift 分享预览', 'Generated Ghost Shift share preview'),
      currentStageSnapshot: text('当前办公室舞台快照', 'Current office-stage snapshot'),
      placeholderGenerate: text('生成预览以合并办公室框架、产品证明点和带时间戳的分享链接。', 'Generate a preview to combine the office frame, product proof points, and a timestamped share link.'),
      placeholderSource: text('当画布可用时，实时舞台快照会显示在这里。它将作为社交卡片的基础图片。', 'When the canvas is available, the live stage snapshot appears here. It becomes the base image for the share card.'),
    },
    platformChecks: {
      titleLength: text('标题长度', 'Title length'),
      descriptionLength: text('描述长度', 'Description length'),
      deepLink: text('深度链接', 'Deep link'),
      cardRatio: text('卡片比例', 'Card ratio'),
      timestamped: text('带时间戳', 'Timestamped'),
      liveEdge: text('实时边缘', 'Live edge'),
    },
    messages: {
      previewUnavailable: text('此环境中预览不可用', 'Preview unavailable in this environment'),
      linkCopied: text('带时间戳的链接已复制', 'Timestamped link copied'),
      clipboardUnavailable: text('剪贴板不可用', 'Clipboard unavailable'),
      socialCopyCopied: text('社交文案已复制', 'Social copy copied'),
      pngDownloaded: text('PNG 已下载', 'PNG downloaded'),
      sharedSuccessfully: text('分享成功', 'Shared successfully'),
      shareCancelled: text('分享已取消', 'Share cancelled'),
      previewRefreshed: text('预览已刷新', 'Preview refreshed'),
    },
  },

  caseStudyContent: {
    whatItIs: {
      title: text('这是什么', 'What it is'),
      body: text('Ghost Shift 读取一个隐私安全的公开快照，并将其渲染为实时办公室。访客看到的是房间级别的活动、公开别名、粗粒度角色、模型家族和行为频段，而不是原始的后端状态。', 'Ghost Shift reads a privacy-safe public snapshot and renders it as a live office. Visitors see room-level activity, public aliases, coarse roles, model families, and behavior bands instead of raw backend state.'),
    },
    whatHidden: {
      title: text('什么被隐藏了', 'What stays hidden'),
      body: text('提示词、对话记录、审批、工具参数、精确的 token 计数、设备身份和内部 Session key 都不会出现在产品表面。办公室的设计目标是暴露叙事信号，而不是操作细节。', 'Prompts, transcripts, approvals, tool arguments, exact token counts, device identity, and internal Session keys never appear on the product surface. The office is designed to expose narrative signals, not operating detail.'),
    },
    cadence: {
      title: text('更新节奏', 'Update cadence'),
      body: text('公开表面每30秒刷新一次。这在作品集场景下足够实时，但又足够粗糙，不会让页面变成操作控制台。', 'The public surface refreshes every 30 seconds. That is real-time enough for a portfolio context while still coarse enough to avoid becoming an operations console.'),
    },
  },

  docs: {
    title: text('文档与 API', 'Docs & API'),
    subtitle: text('部署指南和公开接口说明', 'Deployment guides and public interface notes'),
  },

  about: {
    title: text('关于 Ghost Shift', 'About Ghost Shift'),
    subtitle: text('一个公开安全的产品层，展示实时 Agent 工作', 'A public-safe product layer for live Agent work'),
    description: text('Ghost Shift 的目标是暴露动量而不是秘密：可读的办公室画布、可回放的公开遥测，以及尊重操作员边界的 Embed 摘要。', 'Ghost Shift is designed to expose momentum instead of secrets: a readable office canvas, replayable public telemetry, and Embed-friendly summaries that respect operator boundaries.'),
    kicker: text('关于', 'About'),
    body: text('一个公开安全的产品层，展示实时 Agent 工作。Ghost Shift 的目标是暴露动量而不是秘密。', 'A public-safe product layer for live Agent work. Ghost Shift is designed to expose momentum instead of secrets.'),
    primaryAction: text('进入实时', 'Explore live'),
    secondaryAction: text('阅读文档', 'Read docs'),
    exploreLive: text('进入实时', 'Explore live'),
    readDocs: text('阅读文档', 'Read docs'),
    principlesKicker: text('设计原则', 'Principles'),
    principlesTitle: text('设计原则', 'Principles'),
    principlesBody: text('我们相信专注的路由、可移植的 Embed 和最小的公开契约。', 'We believe in focused routes, portable Embeds, and minimal public contracts.'),
    routeMapEyebrow: text('下一站', 'Next stops'),
    routeMapTitle: text('路线图', 'Route map'),
    whyExistsEyebrow: text('为什么存在', 'Why it exists'),
    whyExistsTitle: text('安全地看见 Agent 工作', 'Safe visibility into Agent work'),
    whyItExists: text('为什么存在', 'Why it exists'),
    safeVisibility: text('安全地看见 Agent 工作。', 'Safe visibility into Agent work.'),
    nextStops: text('下一站', 'Next stops'),
    home: text('首页', 'Home'),
    homeLanding: text('落地页', 'Landing page'),
    embed: text('Embed', 'Embed'),
    embedPreviewConfigure: text('预览并配置 Embed', 'Preview and configure Embeds'),
    about: text('关于', 'About'),
    aboutProductIntent: text('产品意图和理由', 'Product intent and rationale'),
    principles: {
      title: text('设计原则', 'Principles'),
      items: [
        text('专注的路由', 'Focused routes'),
        text('可移植的 Embed', 'Portable Embeds'),
        text('最小的公开契约', 'Minimal public contract'),
      ],
    },
    sidebarNotes: [
      text('访客可以一眼理解产品，因为办公室场景本身就承担了解释工作。', 'Visitors understand the product at a glance because the office scene does the explanatory work itself.'),
      text('公开办公室在移动端依然有用：演示保持可读性，密集的遥测数据折叠到下方的辅助卡片中。', 'The public office stays useful on mobile: the demo remains readable while dense telemetry folds into support cards below.'),
      text('摘要卡片和案例研究文案现在与实时表面使用相同的隐私协议。', 'The summary card and case study copy now share the same privacy contract as the live surface.'),
    ],
  },

  sidebar: {
    replayTitle: text('保留对操作员依然可读的历史上下文。', 'Keep historical context while remaining readable for operators.'),
    liveTitle: text('作品集优先，操作员安全。', 'Portfolio-first, operator-safe.'),
    publicAliases: text('公开别名和房间节奏', 'Public aliases and room cadence'),
  },

  docsSection: {
    embedKicker: text('Embed 工作室', 'Embed studio'),
    docsKicker: text('文档', 'Docs'),
    embedTitle: text('预览卡片，复制代码片段，保持 URL 可移植。', 'Preview cards, copy snippets, and keep URLs portable.'),
    docsTitle: text('保持公开契约精简，实现清晰可读。', 'Keep the public contract narrow and the implementation legible.'),
    embedBody: text('摘要卡片是实时办公室的预览界面。使用专用预览路由进行操作员检查，然后将仅卡片路由放入作品集页面或 CMS Embed 中。', 'The summary card is the teaser surface for the live office. Use the dedicated preview route for operator checks, then drop the card-only route into a portfolio page or CMS Embed.'),
    docsBody: text('这些说明涵盖部署边界、公开 API 形状，以及将实时、回放、Embed 和文档拆分到各自路由的产品理念。', 'These notes cover deployment boundaries, the public API shape, and the product thinking behind splitting Live, Replay, Embed, and Docs into dedicated routes.'),
    deploymentNotes: text('部署说明', 'Deployment notes'),
    keepContractNarrow: text('保持公开契约精简。', 'Keep the public contract narrow.'),
    shareableUrls: text('可分享的 URL', 'Shareable URLs'),
    card: text('卡片', 'Card'),
    openCardPreview: text('打开仅卡片预览', 'Open card-only preview'),
    openLiveOffice: text('打开实时办公室', 'Open live office'),
    documentationPoints: [
      text('在专门的 iframe 路径下嵌入摘要卡片，让作品集网站可以把它当作一个干净、可复用的表面。', 'Embed the summary card on a dedicated iframe route so portfolio sites can treat it as a clean, reusable surface.'),
      text('使用案例研究层解释这是一个公开渲染，而不是网关镜像。', 'Use the case study layer to explain that this is a public render, not a gateway mirror.'),
      text('让办公室演示在作品集中保持视觉主导地位，让读者立即看到产品在工作。', 'Keep the office demo visually dominant in the portfolio so readers see the product working immediately.'),
    ],
  },

  landing: {
    features: [
      {
        title: text('像素办公室', 'Pixel office'),
        body: text('实时展示 AI Agent 在虚拟办公室中的活动状态，直观了解团队工作动态。', 'Show AI Agent activity inside a virtual office in real time so team motion is instantly legible.'),
      },
      {
        title: text('时间线回放', 'Timeline replay'),
        body: text('支持历史回放，随时查看过去的工作状态，便于分析和复盘。', 'Replay history on demand so past working states stay available for analysis and review.'),
      },
      {
        title: text('隐私优先', 'Privacy first'),
        body: text('只展示公开统计信息，保护敏感数据，安全可靠。', 'Only public-safe signals are shown, keeping sensitive data protected and safe to share.'),
      },
    ],
    featureCards: [
      {
        title: text('像素办公室', 'Pixel office'),
        body: text('实时展示 AI Agent 在虚拟办公室中的活动状态，直观了解团队工作动态。', 'Show AI Agent activity inside a virtual office in real time so team motion is instantly legible.'),
      },
      {
        title: text('时间线回放', 'Timeline replay'),
        body: text('支持历史回放，随时查看过去的工作状态，便于分析和复盘。', 'Replay history on demand so past working states stay available for analysis and review.'),
      },
      {
        title: text('隐私优先', 'Privacy first'),
        body: text('只展示公开统计信息，保护敏感数据，安全可靠。', 'Only public-safe signals are shown, keeping sensitive data protected and safe to share.'),
      },
    ],
    embedPreview: text('嵌入式预览卡片', 'Embedded preview card'),
    viewCard: text('查看卡片', 'View card'),
  },
} as const

export type I18n = typeof i18n
