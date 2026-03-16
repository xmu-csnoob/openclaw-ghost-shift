import { SNAPSHOT_REFRESH_MS } from '../surfaceConfig.js'

export interface SurfaceCardCopy {
  eyebrow: string
  title: string
  body: string
  note: string
  featured?: boolean
}

export interface CaseStudyCardCopy {
  title: string
  body: string
}

export const heroPills = [
  '隐私安全的公开遥测',
  '可嵌入的作品集卡片',
  '移动端友好的办公演示',
]

export const surfaceCards: SurfaceCardCopy[] = [
  {
    eyebrow: '核心展示',
    title: '公开办公演示',
    body:
      '一个实时像素办公室，把活跃的 Agent 工作转化为访客几秒钟就能看懂的内容：房间占用、信号强度、活动频段和公开节奏。',
    note: '用实时办公室开场，而不是空的仪表盘壳子。',
    featured: true,
  },
  {
    eyebrow: '作品集嵌入',
    title: '摘要卡片',
    body:
      '一个紧凑的卡片，专为作品集设计：标题、实时状态、可见数量、顶部区域和刷新节奏，在紧凑布局下也能正常显示。',
    note: '把它作为预告界面，再引导读者进入完整的办公室。',
  },
  {
    eyebrow: '边界层',
    title: '案例研究说明',
    body:
      '一个专门的解释层，告诉访客这个演示实际渲染了什么、什么被隐藏、以及为什么这个公开表面可以安全分享。',
    note: '隐私边界是产品故事的一部分，不是脚注。',
  },
]

export const caseStudyCards: CaseStudyCardCopy[] = [
  {
    title: '这个演示是什么',
    body:
      'Ghost Shift 读取一个隐私安全的公开快照，并将其渲染为实时办公室。访客看到的是房间级别的活动、公开别名、粗粒度角色、模型族和行为频段，而不是原始的后端状态。',
  },
  {
    title: '什么被隐藏了',
    body:
      '提示词、对话记录、审批、工具参数、精确的 token 计数、设备身份和内部会话密钥都不会出现在产品表面。办公室的设计目标是暴露叙事信号，而不是操作细节。',
  },
  {
    title: '更新节奏',
    body: `公开表面每 ${SNAPSHOT_REFRESH_MS / 1000} 秒刷新一次。这在作品集场景下足够实时，但又足够粗糙，不会让页面变成操作控制台。`,
  },
]

export const demoSidebarNotes = [
  '访客可以一眼理解产品，因为办公室场景本身就承担了解释工作。',
  '公开办公室在移动端依然有用：演示保持可读性，密集的遥测数据折叠到下方的辅助卡片中。',
  '摘要卡片和案例研究文案现在与实时表面使用相同的隐私协议。',
]

export const documentationPoints = [
  '在专门的 iframe 路径下嵌入摘要卡片，让作品集网站可以把它当作一个干净、可复用的表面。',
  '使用案例研究层解释这是一个公开渲染，而不是网关镜像。',
  '让办公室演示在作品集中保持视觉主导地位，让读者立即看到产品在工作。',
]
