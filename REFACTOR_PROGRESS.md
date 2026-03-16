# Ghost Shift UI 重构进度报告

## ✅ 已完成的工作

### 1. 核心组件创建
- ✅ 创建 Modal 组件 (`src/components/Modal.tsx`)
  - 支持基本的弹窗功能
  - 支持 ESC 键关闭
  - 支持点击背景关闭

### 2. 中文化进展
- ✅ **AppShell.tsx** - 完成
  - 导航链接全部中文化（首页、实时、回放、嵌入、文档、关于）
  - Loading 文案改为中文
  
- ✅ **LiveOfficeStage.tsx** - 部分完成
  - 添加了 i18n 导入
  - 连接状态改为中文（已连接、连接中、已断开）

### 3. 构建验证
- ✅ npm run build 成功通过

## 🔄 待完成的中文化工作

以下文件仍有英文文案需要替换：

### 1. CaseStudyLayer.tsx
- FAQ 问答内容
- 流程步骤标签
- 字段说明文本
- 卡片内容

### 2. ExperiencePanel.tsx
- 快捷键说明
- 指南提示
- 设置面板文本

### 3. GhostShiftSummaryCard.tsx
- 状态标签（Live snapshot, Offline等）
- 卡片标题和描述
- 指标标签

### 4. SharePanel.tsx
- 分享面板所有文案

### 5. ProductDashboard.tsx
- 仪表盘标题和描述
- 图表标签

## ⏳ UI 简化工作（主要任务）

### 1. 分享面板重构
- 当前：完整的分享面板直接显示
- 目标：改为一个"分享"按钮 + Modal 弹窗

### 2. 设置面板重构
- 当前：设置面板直接显示
- 目标：改为一个"设置"图标 + Modal 弹窗

### 3. 产品仪表盘处理
- 当前：雷达图、散点图、柱状图等占大量空间
- 目标：移除或折叠到"统计"按钮

### 4. 案例研究层重构
- 当前：案例研究层直接显示
- 目标：折叠到"帮助"按钮

## 📊 统计数据

- 扫描的 .tsx 文件数：42 个
- 已中文化的文件：2 个
- 待中文化的文件：约 5-10 个
- 剩余英文文案估算：约 100-200 处

## 🎯 下一步建议

由于 UI 简化是主要目标，建议优先完成：

1. **立即完成**：创建悬浮按钮组
   - 分享按钮（触发分享 Modal）
   - 设置按钮（触发设置 Modal）
   - 帮助按钮（触发案例研究 Modal）

2. **其次完成**：修改主页面布局
   - 移除/折叠现有面板
   - 让办公室画布占据主要空间

3. **最后完成**：继续中文化剩余文件

## 💡 实现建议

### 悬浮按钮组实现
```tsx
// 在 LiveOfficeStage 或 App 组件中添加
<div className="gs-floating-buttons">
  <button onClick={() => setShowShareModal(true)}>
    📤 分享
  </button>
  <button onClick={() => setShowSettingsModal(true)}>
    ⚙️ 设置
  </button>
  <button onClick={() => setShowHelpModal(true)}>
    ❓ 帮助
  </button>
</div>

<Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="分享">
  <SharePanel {...shareProps} />
</Modal>

<Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="设置">
  <ExperiencePanel {...experienceProps} />
</Modal>

<Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="帮助">
  <CaseStudyLayer {...caseStudyProps} />
</Modal>
```

### CSS 样式建议
```css
.gs-floating-buttons {
  position: fixed;
  top: 80px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
}

.gs-floating-buttons button {
  padding: 10px 16px;
  background: rgba(255, 92, 92, 0.9);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.gs-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.gs-modal {
  background: #1e1e2e;
  border-radius: 12px;
  max-width: 800px;
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}
```

## ⚠️ 注意事项

1. 中文化需要确保 i18n.ts 中有对应的翻译键
2. UI 重构需要保持现有功能不变
3. Modal 组件需要处理键盘事件和无障碍访问
4. 移动端需要考虑悬浮按钮的布局

---

**生成时间**：2026-03-16
**状态**：进行中
