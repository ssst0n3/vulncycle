# Makefile 模块说明

## 文件结构

- **config.mk** - 项目配置和常量定义
  - 项目名称、镜像名称等变量
  - 颜色定义
  - 端口配置

- **help.mk** - 帮助信息
  - 默认目标
  - 帮助命令输出

- **compose.mk** - Docker Compose 相关命令（**主要命令，推荐使用**）
  - `up` - 启动服务
  - `down` - 停止服务
  - `build` - 构建镜像
  - `shell` - 进入容器 shell

- **local.mk** - 本地开发命令（不使用容器）
  - `local-install` - 本地安装依赖
  - `local-dev` - 本地启动开发服务器
  - `local-build` - 本地构建生产版本
  - `local-preview` - 本地预览生产构建

## 使用方式

主 Makefile 会自动包含所有模块，容器化命令作为主要命令：

```bash
make help          # 查看帮助
make up            # 启动服务（容器化，推荐）
make build         # 构建镜像
make down          # 停止服务
make shell         # 进入容器 shell

# 如果需要在本地环境运行（不使用容器）
make local-dev     # 本地启动开发服务器
make local-build   # 本地构建
```

## 优势

1. **模块化** - 每个模块职责单一，易于理解
2. **可维护性** - 修改某个功能只需编辑对应的模块文件
3. **可扩展性** - 添加新功能只需创建新的模块文件并在主 Makefile 中引入
4. **可读性** - 文件结构清晰，查找特定命令更容易
5. **容器优先** - 容器化命令作为主要命令，更符合现代开发实践
