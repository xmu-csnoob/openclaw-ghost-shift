# Ghost Shift 中文化重构任务

## 背景
Ghost Shift 是一个对外发布的公开遥测产品，需要全面中文化。

## 要求

### 1. 文案风格
- 产品级中文，面向外部用户
- 简洁、专业、友好
- 避免开发者术语和注释风格
- 统一的术语翻译

### 2. 技术要求
- 统计当前中英文比例
- 系统性替换，不是零散修改
- 所有文案集中到 `src/content/i18n.ts` 管理
- 保持代码可维护性

### 3. 关键组件（按优先级）
1. **主页面** `src/pages/GhostShiftSurface.tsx`
2. **导航和路由** 所有页面的标题和按钮
3. **状态显示** `src/replay.ts`, `src/publicDisplay.ts`
4. **控制面板** `src/components/ReplayControlBar.tsx`, `ExperiencePanel.tsx`
5. **分享面板** `src/components/SharePanel.tsx`
6. **摘要卡片** `src/components/GhostShiftSummaryCard.tsx`
7. **仪表盘** `src/components/ProductDashboard.tsx`

### 4. 配色已改
- 主色：`#ff5c5c` (OpenClaw 红)
- 辅助色：`#14b8a6` (青绿)
- 已修改：`index.css`, `ghostShiftSurface.css`

### 5. 服务配置
- 域名：`office.wenfei4288.com`
- 前端：3001
- 后端：3002
- `vite.config.js` 已配置 allowedHosts

## 输出要求
1. 先统计每个文件中的英文文案数量
2. 给出完整的中英文对照表
3. 逐个文件替换，确保措辞统一
4. 构建测试通过

## 注意
- 这是面向外部用户的产品，措辞要专业
- 不要用"开发中"、"测试"等内部术语
- 使用产品提供商的口吻
