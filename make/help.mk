.PHONY: help

# 默认目标
.DEFAULT_GOAL := help

help: ## 显示此帮助信息
	@echo "$(COLOR_BOLD)$(COLOR_BLUE)VulnCycleInsight - Makefile 命令$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_BOLD)容器化命令（推荐）:$(COLOR_RESET)"
	@echo "  $(COLOR_GREEN)make up$(COLOR_RESET)              启动服务"
	@echo "  $(COLOR_GREEN)make down$(COLOR_RESET)            停止服务"
	@echo "  $(COLOR_GREEN)make build$(COLOR_RESET)           构建镜像"
	@echo "  $(COLOR_GREEN)make shell$(COLOR_RESET)           进入容器 shell"
	@echo ""
	@echo "$(COLOR_BOLD)本地命令（不使用容器）:$(COLOR_RESET)"
	@echo "  $(COLOR_GREEN)make local-install$(COLOR_RESET)   本地安装依赖"
	@echo "  $(COLOR_GREEN)make local-dev$(COLOR_RESET)       本地启动开发服务器"
	@echo "  $(COLOR_GREEN)make local-build$(COLOR_RESET)     本地构建生产版本"
	@echo "  $(COLOR_GREEN)make local-preview$(COLOR_RESET)   本地预览生产构建"
