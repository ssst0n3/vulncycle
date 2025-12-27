.PHONY: up down build shell

# ============================================
# Docker Compose 命令（主要命令）
# ============================================

up: ## 启动服务
	@echo "$(COLOR_YELLOW)启动服务...$(COLOR_RESET)"
	docker compose up -d
	@echo "$(COLOR_GREEN)服务已启动，访问 http://localhost:$(PORT)$(COLOR_RESET)"

down: ## 停止服务
	@echo "$(COLOR_YELLOW)停止服务...$(COLOR_RESET)"
	docker compose down

build: ## 构建镜像
	@echo "$(COLOR_YELLOW)构建镜像...$(COLOR_RESET)"
	docker compose build

shell: ## 进入容器 shell
	@echo "$(COLOR_YELLOW)进入容器 shell...$(COLOR_RESET)"
	@if docker compose ps app 2>/dev/null | grep -q "Up"; then \
		docker compose exec app sh; \
	else \
		echo "$(COLOR_YELLOW)容器未运行，正在启动...$(COLOR_RESET)"; \
		docker compose up -d; \
		sleep 2; \
		docker compose exec app sh; \
	fi
