# VulnCycleInsight

基于生命周期的漏洞研究报告编辑器

## 功能特性

- 🎨 **实时编辑预览**：左侧输入 Markdown，右侧实时显示生命周期样式
- 📊 **生命周期可视化**：自动识别9个漏洞生命周期阶段，以时间轴样式展示
- 💻 **代码高亮**：内置 CodeMirror 编辑器，支持 Markdown 语法高亮
- 📱 **响应式设计**：支持不同屏幕尺寸

## 快速开始

### 前置要求

- Docker 和 Docker Compose（推荐，容器化方式）
- 或 Node.js 16+ 和 npm（本地开发方式）

### 容器化方式（推荐）

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 构建镜像
docker compose build

# 进入容器 shell
docker compose exec app sh
```

服务启动后访问实际分配的端口：

- 本地开发：默认使用随机端口；如需固定端口可设置环境变量 `PORT`（例如 `PORT=5173 npm run dev`）
- Docker：宿主机会随机分配端口，使用 `docker compose ps` 或 `docker compose logs -f` 查看实际映射，容器内监听端口固定为 5173

### 本地开发方式（不使用容器）

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 容器化部署

项目使用 Docker Compose 进行容器化部署。

### 主要命令

```bash
# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 查看服务状态
docker compose ps

# 构建镜像
docker compose build

# 进入容器 shell
docker compose exec app sh

# 重新构建并启动服务
docker compose up -d --build
```

## 使用说明

在左侧编辑器中输入 Markdown 内容，系统会自动识别以下生命周期阶段：

1. **基本信息**
2. **漏洞引入**
3. **漏洞发现**
4. **漏洞上报**
5. **漏洞修复**
6. **漏洞公告**
7. **漏洞情报**
8. **漏洞利用**
9. **防护**

## 技术栈

- **Vite** - 现代化构建工具
- **CodeMirror** - 代码编辑器
- **Marked.js** - Markdown 解析器
- **ES6 模块** - 模块化开发
- **原生 JavaScript、HTML、CSS**

## 项目结构

```
VulnCycleInsight/
├── public/           # 静态资源
│   └── TEMPLATE.md   # 模板文件
├── src/              # 源代码
│   ├── js/           # JavaScript 模块
│   │   ├── config.js      # 配置文件
│   │   ├── parser.js      # Markdown 解析
│   │   ├── renderer.js    # 生命周期渲染
│   │   ├── editor.js      # 编辑器初始化
│   │   └── main.js        # 入口文件
│   └── styles/       # 样式文件
│       └── main.css  # 主样式
├── index.html        # HTML 入口
├── Dockerfile        # Dockerfile
├── docker-compose.yml # Docker Compose 配置
├── nginx.conf        # Nginx 配置
├── vite.config.js    # Vite 配置
└── package.json      # 项目配置
```
