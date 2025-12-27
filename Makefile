# VulnCycleInsight Makefile
# 主 Makefile - 导入所有子模块

# 包含配置文件
include make/config.mk

# 包含所有子模块（compose 在前，作为主要命令）
include make/help.mk
include make/compose.mk
include make/local.mk
