# 版本号展示功能实现计划

## 目标

在页面标题旁边显示版本号，格式为 `${git tag}-[commit]-[dirty]`，如果没有 git tag 则只显示 commit。

## 实现步骤

### 1. 修改 vite.config.ts

**文件**: `/home/st0n3/research_project/VulnCycleInsight/vite.config.ts`

**添加内容**:

- 导入 `child_process` 模块
- 创建 `getVersion()` 函数，执行以下 git 命令：
  - `git rev-parse --short HEAD` - 获取短 commit hash
  - `git describe --tags --always` - 获取最近 tag（如果有）
  - `git diff --quiet` - 检查是否有未提交修改
- 格式化版本号：`${tag}-${commit}${dirty}` 或 `${commit}${dirty}`
- 使用 Vite 的 `define` 配置注入 `__APP_VERSION__` 全局变量

### 2. 修改 index.html

**文件**: `/home/st0n3/research_project/VulnCycleInsight/index.html`

**修改内容**:
在 `<header>` 的 `<h1>` 标题旁边添加版本号展示元素：

```html
<span id="app-version" class="app-version"></span>
```

### 3. 修改 src/style.css

**文件**: `/home/st0n3/research_project/VulnCycleInsight/src/style.css`

**添加样式**:
为版本号添加小字样式：

- font-size: 0.7em
- color: 灰色
- margin-left: 8px
- font-weight: normal

### 4. 修改 src/js/main.ts

**文件**: `/home/st0n3/research_project/VulnCycleInsight/src/js/main.ts`

**添加内容**:

- 声明 `__APP_VERSION__` 全局变量类型
- 在 DOM 加载完成后，将版本号渲染到 `#app-version` 元素

### 5. 创建类型声明文件

**文件**: `/home/st0n3/research_project/VulnCycleInsight/src/types/version.d.ts`

**内容**:

```typescript
declare const __APP_VERSION__: string;
```

## 预期效果

**版本号格式规则**：

- 有 tag + 干净工作区: `v1.0.0-a1b2c3d`
- 有 tag + 脏工作区: `v1.0.0-a1b2c3d-dirty`
- 无 tag + 干净工作区: `a1b2c3d`
- 无 tag + 脏工作区: `a1b2c3d-dirty`

**说明**：`-dirty` 后缀只在有未提交修改时才会添加

**展示位置**: 页面标题 VulnCycleInsight 旁边，使用较小的灰色字体

## 相关文件清单

1. vite.config.ts - 版本号生成逻辑
2. index.html - HTML 结构
3. src/style.css - 样式
4. src/js/main.ts - 版本号渲染
5. src/types/version.d.ts - 类型声明（可能需要创建）
