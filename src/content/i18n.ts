// Ghost Shift 中文案集中管理
// 所有 UI 文字从这里读取

export const i18n = {
  // 品牌名称
  brand: {
    zh: '幽灵班次',
    en: 'Ghost Shift',
    tagline: '实时 Agent 办公室',
  },

  // 导航
  nav: {
    live: '实时',
    replay: '回放',
    embed: '嵌入',
    docs: '文档',
    about: '关于',
  },

  // 首页 Hero
  hero: {
    title: '可回放的公开遥测',
    subtitle: '让你的 AI Agent 工作变成一个活着的办公室',
    cta: {
      primary: '进入办公室',
      secondary: '了解更多',
    },
    pills: [
      '隐私安全',
      '可嵌入',
      '移动友好',
    ],
  },

  // 实时状态
  status: {
    live: '实时',
    liveNow: '实时',
    delayed: '延迟',
    offline: '离线',
    replay: '回放',
    updated: '更新于',
    connecting: '连接中',
    connected: '已连接',
    disconnected: '已断开',
    waitingForLiveSnapshot: '等待实时快照',
    apiUnavailable: 'API 不可用',
  },

  // LiveOfficeStage 组件
  liveOffice: {
    visible: '可见',
    warm: '活跃',
    liveAgents: '实时',
    telemetry: '遥测',
    heatmap: '热力图',
    activityHeatmap: '活动热力图',
    activeSources: '活跃源',
    hotZones: '热点区域',
    pinchDragToInspect: '捏合或拖动以检查',
    panZoomToInspect: '平移或缩放以检查密度',
    replayRoster: '回放名单',
    liveRoster: '实时名单',
    moreInPublicOffice: '公开办公室中的更多',
    scrubHelp: '在时间线上拖动以回放公开办公室。任何平移、缩放或点击都会暂停相机自动导览，直到你恢复它。',
  },

  // 办公室区域
  zones: {
    'code-studio': '代码工作室',
    'chat-lounge': '对话休息室',
    'ops-lab': '运维实验室',
  },

  // Agent 状态
  agent: {
    running: '工作中',
    idle: '空闲',
    status: {
      running: '运行中',
      idle: '空闲',
    },
    role: {
      assistant: '助手',
      automation: '自动化',
      webchat: '对话',
    },
    model: {
      gpt: 'GPT',
      claude: 'Claude',
      gemini: 'Gemini',
      qwen: '通义',
      deepseek: '深度求索',
      hidden: '隐藏',
    },
    window: {
      observed: '已观察',
      active: '活跃',
      warm: '预热',
    },
    footprint: {
      heavy: '重度',
      medium: '中度',
      light: '轻度',
    },
    band: {
      surging: '激增',
      steady: '稳定',
      warm: '预热',
      quiet: '安静',
    },
    toolStats: {
      read: '读取',
      write: '写入',
      ops: '操作',
    },
  },

  // 回放控制
  replay: {
    storyline: '故事线',
    play: '播放',
    pause: '暂停',
    speed: '倍速',
    window: {
      '1h': '1小时',
      '6h': '6小时',
      '24h': '24小时',
    },
    jumpToLive: '跳到实时',
    continueTour: '继续导览',
    thumbnail: '缩略图',
    active: '活跃',
    frame: '帧',
    waitingForReplayFrames: '等待回放帧',
    liveEdge: '实时边缘',
    replayBufferEmpty: '回放缓存为空',
    buffered: '已缓存',
    bufferedRetention: '已缓存 24小时保留期',
    chooseRecordedFrame: '选择已记录的帧',
    replayRoster: '回放名单',
    liveRoster: '实时名单',
    quietOffice: '安静的办公室',
  },

  // 面板标题
  panels: {
    stats: '统计',
    roster: '名单',
    settings: '设置',
    share: '分享',
    heatmap: '热力图',
    experience: '体验层',
    caseStudy: '案例研究层',
    logs: '日志',
  },

  // 产品介绍卡片
  cards: {
    office: {
      eyebrow: '核心展示',
      title: '公开办公演示',
      body: '一个实时像素办公室，把 Agent 工作变成几秒钟就能看懂的内容。',
    },
    embed: {
      eyebrow: '作品集嵌入',
      title: '摘要卡片',
      body: '紧凑的嵌入卡片，适合放在作品集或博客中。',
    },
    privacy: {
      eyebrow: '隐私边界',
      title: '安全分享',
      body: '只展示公开信息，敏感数据完全隐藏。',
    },
  },

  // 统计仪表盘
  dashboard: {
    title: '统计仪表盘',
    subtitle: '实时指标、比较基线和轻量级预测，在一个叙事层中呈现。',
    description: '分析部分现在结合了更丰富的产品指标、6小时滚动比较、同小时基线比较、简单线性预测和互补图表类型，用于更快的模式识别。',
    metrics: {
      agents: '代理数',
      sessions: '会话数',
      uptime: '在线时间',
      liveTrend: '24小时实时趋势',
      realtimeSignal: '实时信号',
      visibleLoad: '可见负载',
      rollingDelta: '6小时滚动增量',
      sameHourBaseline: '同小时基线',
      prediction: '预测',
      zoneConcentration: '区域集中度',
      modelDiversity: '模型多样性',
      freshness: '新鲜度',
      retention: '保留期',
    },
    meta: {
      publicAliasesVisible: '当前可见的公开别名',
      currentlyRunning: '当前在公开办公室运行中',
      connectedInRetainedWindow: '在保留窗口内连接',
      peakLiveAgents: '过去24小时内的实时代理峰值',
      averageSignalAcrossAgents: '所有可见代理的平均信号分数',
      vsEarlierHalf: '对比24小时窗口的前半段',
      avgNowVsPrevious: '当前平均对比过去6小时',
      todayVsYesterday: '今日平均对比昨日',
      nextProjection: '下一次预测',
      confidenceFit: '置信度拟合',
      leadsVisibleMix: '领导可见混合',
      waitingForSessions: '等待可见会话',
      familiesVisible: '当前帧中可见的家族',
      currentFrameTimestamp: '显示表面的当前帧时间戳',
      historyBufferUsed: '用于回放、趋势和比较的历史缓存',
    },
    charts: {
      comparisonChart: '比较图表',
      todayVsYesterdayProfile: '今日与昨日的运行代理概况',
      today: '今日',
      yesterday: '昨日',
      yesterdayPartial: '昨日数据不完整，因为保留期有限',
      linearForecast: '简单线性预测',
      projectedTrajectory: '预测的实时代理轨迹',
      projected: '预测',
      forecastExplanation: '使用最新保留的样本延伸直线趋势。轻量、可解释，适合短期动量提示。',
      radarChart: '雷达图',
      surfaceHealthProfile: '表面健康概况',
      noZoneLead: '尚无区域主导',
      scatterPlot: '散点图',
      signalVsLatency: '信号与状态变更延迟',
      trackedAgents: '追踪的代理',
      scatterExplanation: 'X轴显示自上次状态变更以来的分钟数。Y轴显示信号分数。较大的点是当前运行的代理。',
      minutesSinceStatusChange: '自状态变更以来的分钟数',
      signalScore: '信号分数',
    },
  },

  // 摘要卡片
  summaryCard: {
    eyebrow: '可嵌入的摘要卡片',
    snapshotUnavailable: '快照不可用',
    liveSnapshot: '实时快照',
    connecting: '连接中',
    offline: '离线',
    iframeTitle: '幽灵班次摘要卡片',
    title: {
      feature: '一个紧凑的产品表面，用于实时公开办公室演示。',
      embed: '作品集尺寸框架中的公开办公室演示。',
    },
    body: '为 me.wenfei4288.com 构建：足够的实时信号证明产品正在运行，现在包含24小时趋势上下文、迷你图表和最强公开代理的轮换名单。',
    metrics: {
      visible: '可见',
      running: '实时',
      activeZones: '活跃区域',
    },
    sparklines: {
      liveActivity: '24小时实时活动',
      visibleLoad: '24小时可见负载',
      peak: '峰值',
    },
    facts: {
      topZone: '主要区域',
      modelMix: '模型分布',
      averageSignal: '平均信号',
      lastUpdate: '最后更新',
      waitingForFirstSnapshot: '等待首次快照',
      waitingForPublicTraffic: '等待公开流量',
    },
    carousel: {
      topAgents: '顶级代理',
      prev: '上一个',
      next: '下一个',
      signal: '信号',
      waitingForPublicAgents: '等待公开代理',
      show: '显示',
    },
    footer: {
      refreshesEvery: '每...刷新',
      openLiveOffice: '打开实时办公室',
    },
  },

  // 案例研究
  caseStudy: {
    eyebrow: '案例研究层',
    title: '展示转换、动画隐私边界，并在原地回答信任问题。',
    modalTitle: '案例研究 - 隐私转换',
    description: '该层将清理契约转变为引导式演示：点击每个数据边界、观看流程动画，并在不离开产品表面的情况下展开常见问题。',
    flow: {
      rawGateway: '原始网关',
      publicSnapshot: '公开快照',
      productSurface: '产品表面',
      rawDetail: '身份、提示和工具参数仍在此处。',
      publicDetail: '敏感字段被剥离，仅保留公开安全的元数据。',
      surfaceDetail: '浏览器仅从缩减的契约渲染。',
      pauseAnimation: '暂停动画',
      playAnimation: '播放动画',
    },
    panels: {
      beforeSanitization: '清理前',
      afterSanitization: '清理后',
      renderedProductSurface: '渲染的产品表面',
      surfaceCardExplanation: '办公室场景、分析卡片和社交分享卡片都从这个更窄的契约渲染，而不是从原始网关负载。',
    },
    fields: {
      identity: '身份',
      identityNote: '浏览器接收负载前移除个人标识符。',
      promptContext: '提示上下文',
      promptContextNote: '提示文本变成粗粒度的活动元数据，而不是显示内容。',
      toolArguments: '工具参数',
      toolArgumentsNote: '操作命令从不进入公开契约。',
      modelDetail: '模型详情',
      modelDetailNote: '模型家族保持可见，因为它们解释能力而不暴露原始部署字符串。',
      hidden: '隐藏',
      promptHidden: '提示已隐藏',
      transcriptHidden: '对话记录已隐藏',
      toolArgsHidden: '工具参数已隐藏',
      userIdentityHidden: '用户身份已隐藏',
      publicAliasPreserved: '公开别名已保留',
      modelFamilyPreserved: '模型家族已保留',
      activityWindowOnly: '仅活动窗口',
      notRendered: '未渲染',
    },
    cards: {
      interactive: {
        eyebrow: '交互式示例',
        title: '一次检查一个规则。',
        body: '每个字段卡片随当前阶段更新，访客可以比较原始、公开和渲染状态。',
      },
      animation: {
        eyebrow: '动画演示',
        title: '在实时演示中播放隐私流程。',
        body: '当你亲自演示产品时，动画轨道保持清理故事的推进。',
      },
      faq: {
        eyebrow: '常见问题折叠',
        title: '折叠细节直到观众要求。',
        body: '信任问题就在附近，但解释层避免压倒主要叙述。',
      },
    },
    faq: {
      hideSessionKeys: {
        question: '为什么幽灵班次隐藏会话密钥和原始模型名称？',
        answer: '公开表面讲述产品故事，而不是操作员故事。稳定的别名和模型家族保持连续性，同时移除可能泄露内部信息或混淆随意观看者的句柄。',
      },
      timestampedLinks: {
        question: '为什么时间线和分享链接带有时间戳？',
        answer: '时间戳链接将审查对话锚定到单个帧。这在异步设计审查中很重要，因为每个人都落在相同的证据上，而不是移动的实时边缘。',
      },
      sanitizationVisualized: {
        question: '为什么清理流程在产品表面中可视化？',
        answer: '当人们可以检查隐私边界时，更容易信任它们。案例研究层显示什么被移除、什么存活，以及为什么结果视图可以安全分享。',
      },
    },
  },

  // 实时统计侧边栏
  realtimeStats: {
    eyebrow: '实时统计',
    title: '实时混合、区域压力和表面延迟',
    freshness: '新鲜度',
    sections: {
      modelUsage: '模型使用',
      zoneActivity: '区域活动',
      surfaceLatency: '表面延迟',
    },
  },

  // 体验面板
  experience: {
    eyebrow: '体验层',
    title: '引导叙事、展示快捷键，让页面适应观看者',
    actions: {
      hideGuide: '隐藏指南',
      showGuide: '显示指南',
      hideSettings: '隐藏设置',
      showSettings: '显示设置',
      jumpToShare: '跳到分享',
      jumpToCaseStudy: '跳到案例',
    },
    guide: {
      eyebrow: '指南提示',
      title: '让产品叙事更容易理解',
      tips: [
        '以办公室舞台开场，然后使用分析卡片解释动量、置信度和基线比较。',
        '保持社交卡片简短：一个标题、一个证明指标和一个时间戳锚点比密集的状态转储转化率更高。',
        '在审查隐私边界时使用案例研究层，让访客看到转换而不是阅读抽象策略。',
      ],
    },
    shortcuts: {
      eyebrow: '键盘快捷键',
      title: '演示和快速控制的快捷方式',
      items: [
        { key: '?', action: '打开指南和快捷键' },
        { key: 'T', action: '切换颜色主题' },
        { key: 'G', action: '切换热力图' },
        { key: 'L / R', action: '在实时和回放之间跳转' },
        { key: '1 / 6 / 2', action: '将回放窗口切换为1小时、6小时或24小时' },
        { key: 'S', action: '滚动到分享面板' },
      ],
    },
    settings: {
      eyebrow: '个性化',
      title: '调整界面以适应你的偏好',
      colorTheme: '颜色主题',
      density: '密度',
      comfortable: '舒适',
      compact: '紧凑',
      behavior: '行为',
      autoRefreshSharePreviews: '帧变更时自动刷新分享预览',
      keepGuideTipsExpanded: '默认保持指南提示展开',
    },
  },

  // 分享面板
  share: {
    eyebrow: '分享表面',
    title: '生成精美的社交卡片、检查源图片和打包链接',
    description: '主题预设、自定义标题和摘要字段、实时图片预览和平台长度检查，让分享流程保持生产就绪状态。',
    cardStyle: '卡片风格',
    headline: '标题',
    summary: '摘要',
    buttons: {
      generatePreview: '生成预览',
      copyLink: '复制链接',
      copySocialCopy: '复制社交文案',
      downloadPNG: '下载 PNG',
      share: '分享',
    },
    preview: {
      socialMediaCard: '社交媒体卡片预览',
      sourceImage: '源图片预览',
      generatedSharePreview: '生成的幽灵班次分享预览',
      currentStageSnapshot: '当前办公室舞台快照',
      placeholderGenerate: '生成预览以合并办公室框架、产品证明点和时间戳安全的分享链接。',
      placeholderSource: '当画布可用时，实时舞台快照出现在这里。它用作社交卡片的基础图片。',
    },
    platformChecks: {
      titleLength: '标题长度',
      descriptionLength: '描述长度',
      deepLink: '深度链接',
      cardRatio: '卡片比例',
      timestamped: '带时间戳',
      liveEdge: '实时边缘',
    },
    messages: {
      previewUnavailable: '此环境中预览不可用',
      linkCopied: '带时间戳的链接已复制',
      clipboardUnavailable: '剪贴板不可用',
      socialCopyCopied: '社交文案已复制',
      pngDownloaded: 'PNG 已下载',
      sharedSuccessfully: '分享成功',
      shareCancelled: '分享已取消',
      previewRefreshed: '预览已刷新',
    },
  },

  // 案例研究内容
  caseStudyContent: {
    whatItIs: {
      title: '这是什么',
      body: 'Ghost Shift 读取一个隐私安全的公开快照，并将其渲染为实时办公室。访客看到的是房间级别的活动、公开别名、粗粒度角色、模型族和行为频段，而不是原始的后端状态。',
    },
    whatHidden: {
      title: '什么被隐藏了',
      body: '提示词、对话记录、审批、工具参数、精确的 token 计数、设备身份和内部会话密钥都不会出现在产品表面。办公室的设计目标是暴露叙事信号，而不是操作细节。',
    },
    cadence: {
      title: '更新节奏',
      body: '公开表面每30秒刷新一次。这在作品集场景下足够实时，但又足够粗糙，不会让页面变成操作控制台。',
    },
  },

  // 文档页
  docs: {
    title: '文档与 API',
    subtitle: '部署指南和公开接口说明',
  },

  // 关于页
  about: {
    title: '关于幽灵班次',
    subtitle: '一个公开安全的产品层，展示实时 Agent 工作',
    principlesKicker: '设计原则',
    routeMapEyebrow: '下一站',
    routeMapTitle: '路线图',
    home: '首页',
    homeLanding: '着陆页',
    embed: '嵌入',
    embedPreviewConfigure: '预览并配置嵌入',
    about: '关于',
    aboutProductIntent: '产品意图和理由',
    principles: {
      title: '设计原则',
      items: [
        '专注的路由',
        '可移植的嵌入',
        '最小的公开约定',
      ],
    },
  },

  // 通用
  common: {
    loading: '加载中...',
    error: '出错了',
    retry: '重试',
    close: '关闭',
    copy: '复制',
    copied: '已复制',
    learnMore: '了解更多',
  },

  // 快捷键提示
  shortcuts: {
    title: '快捷键',
    items: [
      { key: 'T', action: '切换主题' },
      { key: 'H', action: '热力图' },
      { key: 'L', action: '实时模式' },
      { key: 'R', action: '回放模式' },
      { key: '?', action: '帮助' },
    ],
  },

  // 页面标题和描述
  pages: {
    live: {
      eyebrow: '实时',
      title: '实时办公室',
      body: '实时画布、公开名单、新鲜度徽章和热力图检查。',
      kicker: '实时办公室',
      description: '让实时公开办公室成为焦点：实时画布运动、路由感知的侧边统计和触控设备上仍然可用的交互功能。',
      intro: '专注于实时公开办公室，没有其他营销内容。',
    },
    replay: {
      eyebrow: '回放',
      title: '回放工作区',
      body: '专用时间线控件、事件标记和播放速度，用于叙事性回顾。',
      kicker: '回放工作区',
      description: '此页面直接进入回放优先的上下文：缓存帧、事件标记、播放速度和可通过 URL 分享的历史新鲜度状态。',
      intro: '使用专用回放界面浏览历史变动。',
    },
    embed: {
      eyebrow: '嵌入',
      title: '嵌入工作室',
      body: '预览便携式摘要卡片并复制可分享的 iframe 代码片段。',
    },
    docs: {
      eyebrow: '文档',
      title: '文档与 API',
      body: '部署说明、公开契约边界和实施指南。',
    },
  },

  // 快捷键通知
  shortcutNotices: {
    guideHidden: '指南已隐藏',
    guideShown: '指南已显示',
    themeSwitched: '主题已切换',
    heatmapOff: '热力图已关闭',
    heatmapOn: '热力图已开启',
    jumpedToShare: '已跳转到分享面板',
    liveModeSelected: '已选择实时模式',
    replayModeSelected: '已选择回放模式',
    replayWindow1h: '回放窗口已设为 1 小时',
    replayWindow6h: '回放窗口已设为 6 小时',
    replayWindow24h: '回放窗口已设为 24 小时',
  },

  // 日志面板
  logs: {
    title: '日志',
    pause: '暂停',
    resume: '恢复',
    paused: '已暂停',
    newEntries: '{count} 条新日志',
    noLogsYet: '暂无日志',
    err: '错误',
    warn: '警告',
    logsCount: '{count} 条日志',
  },

  // 工具调用卡片
  toolCall: {
    parameters: '参数',
    collapseAll: '折叠全部',
    expandAll: '展开全部',
  },

  // 其他
  quietOffice: '安静的办公室',
  historyUnavailable: '历史记录不可用',
  replayRoster: '回放名单',
  liveRoster: '实时名单',
  replayNotes: '回放说明',
  whyThisSurface: '为什么这个界面有效',
  expandSidebar: '展开侧边栏',
  collapseSidebar: '折叠侧边栏',

  // 侧边栏标题
  sidebar: {
    replayTitle: '保留操作员可读性的历史上下文。',
    liveTitle: '作品集优先，操作员安全。',
    publicAliases: '公开别名和房间节奏',
  },

  // 文档区
  docsSection: {
    embedKicker: '嵌入工作室',
    docsKicker: '文档',
    embedTitle: '预览卡片，复制代码片段，保持 URL 可移植。',
    docsTitle: '保持公开契约精简，实现清晰可读。',
    embedBody: '摘要卡片是实时办公室的预览界面。使用专用预览路由进行操作员检查，然后将仅卡片路由放入作品集页面或 CMS 嵌入中。',
    docsBody: '这些说明涵盖部署边界、公开 API 形状，以及将实时、回放、嵌入和文档分离到各自路由的产品理念。',
    deploymentNotes: '部署说明',
    keepContractNarrow: '保持公开契约精简。',
    shareableUrls: '可分享的 URL',
    card: '卡片',
    openCardPreview: '打开仅卡片预览',
    openLiveOffice: '打开实时办公室',
  },

  // 聊天历史
  chatHistory: {
    empty: '暂无消息',
    role: {
      user: '用户',
      assistant: '助手',
      system: '系统',
    },
    status: {
      pending: '等待中',
      running: '运行中',
      completed: '已完成',
      error: '错误',
    },
    tool: {
      read: '读取',
      write: '写入',
      edit: '编辑',
      bash: '命令',
      grep: '搜索',
      glob: '文件',
      default: '工具',
    },
  },
}

export type I18n = typeof i18n
