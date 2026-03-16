# Ghost Shift - 白橙像素风 UI 设计指南

## 🎨 设计理念

这次重设计参考了真正优秀的像素风游戏 UI（Stardew Valley、Celeste、Hyper Light Drifter），摒弃了之前"太像素"的生硬设计，转而采用**现代感 + 像素装饰**的融合风格。

### 核心原则

1. **温暖友好** - 米白色背景营造舒适感
2. **简洁现代** - 现代字体 + 像素风格装饰元素
3. **层次分明** - 通过橙色系统的明度变化构建视觉层级
4. **硬边阴影** - 4px-6px 的像素风格硬边阴影（而非模糊阴影）

---

## 🎨 配色系统

### 背景层级（米白色系）

```css
--bg-primary: #fff8f0;      /* 温暖的米白 - 主背景 */
--bg-secondary: #fffbf7;    /* 浅暖白 - 次级背景 */
--bg-card: #ffffff;         /* 纯白卡片 */
--bg-hover: #fff4eb;        /* 悬停暖色 */
--bg-active: #ffe8d6;       /* 激活状态 */
```

**设计意图**：
- 从纯黑/深灰背景改为温暖的米白色
- 营造类似 Stardew Valley 的温馨感
- 背景层级通过温度（暖色）而非明度（黑灰）区分

### 橙色系统（主色调）

```css
--orange-primary: #ff6b35;  /* 主橙 - 品牌色 */
--orange-light: #ff8c5a;    /* 浅橙 - hover */
--orange-dark: #e55a2b;     /* 深橙 - active */
--orange-muted: #ffb299;    /* 柔和橙 - 阴影颜色 */
--orange-subtle: #fff0e6;   /* 极浅橙 - 背景 */
```

**设计意图**：
- 主橙色 `#ff6b35` 作为品牌色和主要强调色
- 通过明度变化（light/dark）构建交互状态
- `orange-muted` 用于硬边阴影，避免黑色阴影的生硬感

### 文字层级

```css
--text-primary: #2d2d2d;    /* 深灰 - 主文字 */
--text-secondary: #666666;  /* 中灰 - 次要文字 */
--text-muted: #999999;      /* 浅灰 - 辅助文字 */
--text-inverse: #ffffff;    /* 白色 - 反色文字（用于橙色背景） */
```

**设计意图**：
- 放弃纯黑 `#000000`，使用深灰 `#2d2d2d` 提升可读性
- 三层文字层级清晰，避免视觉混乱

### 边框系统

```css
--border-light: #ffeee6;    /* 浅橙边框 */
--border-normal: #ffd4c4;   /* 橙色边框 */
--border-strong: #ff6b35;   /* 强调边框 */
--border-subtle: rgba(255, 107, 53, 0.15); /* 半透明橙边框 */
```

**设计意图**：
- 所有边框都是橙色系，而非冷色调的蓝/灰色
- `border-strong` 用于 hover/active 状态，与品牌色一致

---

## 🔲 像素风格要点

### 1. 字体策略

**主字体**：现代无衬线字体（系统字体）
```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**辅助字体**：等宽字体（代码/数据）
```css
--font-mono: "JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, monospace;
```

**装饰字体**：像素字体（仅用于标题装饰，不用于正文）
```css
--font-pixel: "Press Start 2P", var(--font-mono);
```

**为什么不用像素字体？**
- "Press Start 2P" 等像素字体在小尺寸下可读性极差
- 参考的像素风游戏（Stardew Valley）也使用现代字体 + 像素装饰
- 保留像素感的关键在于**边框、阴影、图标**而非字体

### 2. 边框规则

```css
/* 统一 2px 实线，无圆角 */
border: 2px solid var(--border-normal);
border-radius: 0;
```

**设计意图**：
- 2px 足够醒目但不粗重
- 0 圆角保持像素风格
- 避免 1px（太细）或 3px+（太粗）

### 3. 阴影系统（核心像素元素）

```css
/* 小元素 */
--pixel-shadow-sm: 2px 2px 0 var(--orange-muted);

/* 中等元素 */
--pixel-shadow-md: 4px 4px 0 var(--orange-muted);

/* 大元素 */
--pixel-shadow-lg: 6px 6px 0 var(--orange-muted);

/* Hover 状态 */
--pixel-shadow-hover: 6px 6px 0 var(--orange-primary);
```

**关键点**：
- `硬边阴影`：`0` blur 值，产生清晰的像素感
- `橙色阴影`：而非黑色阴影，与主题协调
- `偏移量 = blur`：2px 2px 0, 4px 4px 0, 6px 6px 0

### 4. 图标策略

推荐使用：
- **Emoji** - 天然像素友好（🎮 ✨ 🔥 💎）
- **几何图形** - 简单的方块、圆点、线条
- **像素图标集** - 如 Feather Icons 的直线风格

避免：
- 复杂的矢量图标
- 带渐变的图标
- 细节过多的图标

### 5. 间距系统（8px 网格）

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
```

**设计意图**：
- 所有间距为 8 的倍数，保持网格对齐
- 4px 用于微调，8px 是基础单位

---

## 🎯 参考设计

### Supabase 的简洁现代风
- **借鉴点**：清晰的卡片设计、克制的配色、优秀的留白
- **应用**：`.card` 基础样式、背景层级

### Linear 的精致 UI
- **借鉴点**：精致的细节处理、优雅的过渡动画
- **应用**：按钮交互、hover 效果

### 像素游戏的温暖配色
- **借鉴点**：Stardew Valley 的温馨感、Celeste 的清新风格
- **应用**：米白色背景、橙色系统

---

## 📝 组件示例

### 基础按钮

```css
/* 主按钮 */
.primary {
  background: #ff6b35;
  color: #ffffff;
  border: 2px solid #e55a2b;
  box-shadow: 4px 4px 0 #ffb299;
}

.primary:hover {
  background: #ff8c5a;
  border-color: #ff6b35;
  box-shadow: 6px 6px 0 #ff6b35;
  transform: translate(-2px, -2px);
}

/* 次级按钮 */
.secondary {
  background: #ffffff;
  color: #ff6b35;
  border: 2px solid #ffd4c4;
  box-shadow: 3px 3px 0 #ffb299;
}
```

### 卡片样式

```css
.card {
  background: #ffffff;
  border: 2px solid #ffd4c4;
  box-shadow: 4px 4px 0 #ffb299;
  padding: 24px;
}

.card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #ff6b35;
  border-color: #ff6b35;
}
```

### 标签（Tags）

```css
.tag-primary {
  background: #fff0e6;
  color: #ff6b35;
  border: 2px solid #ffd4c4;
  padding: 4px 8px;
}
```

---

## ⚡ 动画原则

```css
/* 快速响应 */
--transition-fast: 0.15s ease;

/* 正常过渡 */
--transition-normal: 0.2s ease;

/* 慢速过渡 */
--transition-slow: 0.3s ease;
```

**设计意图**：
- 0.15s 用于即时反馈（hover）
- 0.2s 用于正常交互（点击）
- 0.3s 用于页面过渡

**关键动画**：
- `translate(-2px, -2px)` - hover 时元素上浮
- `box-shadow` 增强 - hover 时阴影加深
- `border-color` 变化 - hover 时边框变亮

---

## 🚫 设计禁忌

1. **不要使用圆角** - `border-radius: 0` 是像素风格的核心
2. **不要使用模糊阴影** - `box-shadow: 0 0 10px rgba()` 是反像素的
3. **不要用纯黑阴影** - 黑色阴影与温暖的橙色主题冲突
4. **不要滥用像素字体** - 仅用于装饰，不用于正文
5. **不要用冷色调** - 避免蓝/紫色作为主色调

---

## 📦 文件清单

### 主要文件
- `src/index.css` - 全局样式和 CSS 变量
- `src/ghostShiftSurface.css` - 组件样式（已全面适配白橙主题）

### 已移除文件
- `src/ghostShiftPixel.css` - 旧版本（配色生硬）

### 备份文件
- `src/ghostShiftSurface.css.backup-before-orange` - 改造前备份

---

## 🎉 总结

这次重设计的核心是**温暖感 + 像素装饰**：

1. **温暖的米白背景** - 而非冷色黑灰
2. **橙色系统** - 一套颜色，多种用法
3. **硬边阴影** - 像素风格的核心
4. **现代字体** - 可读性优先
5. **简洁组件** - 不过度装饰

**参考灵感**：
- Stardew Valley 的温馨感
- Supabase 的简洁性
- Linear 的精致度

**最终效果**：既保留像素风格的趣味性，又具备现代 UI 的可用性。
