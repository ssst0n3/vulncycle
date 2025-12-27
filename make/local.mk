.PHONY: local-install local-dev local-build local-preview

# ============================================
# 本地开发命令（不使用容器）
# ============================================

local-install: ## 本地安装依赖
	@echo "$(COLOR_YELLOW)安装依赖...$(COLOR_RESET)"
	npm install

local-dev: ## 本地启动开发服务器（不使用容器）
	@echo "$(COLOR_YELLOW)启动本地开发服务器...$(COLOR_RESET)"
	npm run dev

local-build: ## 本地构建生产版本（不使用容器）
	@echo "$(COLOR_YELLOW)构建生产版本...$(COLOR_RESET)"
	npm run build

local-preview: ## 本地预览生产构建（不使用容器）
	@echo "$(COLOR_YELLOW)预览生产构建...$(COLOR_RESET)"
	npm run preview
