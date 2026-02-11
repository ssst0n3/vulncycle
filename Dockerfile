# Dockerfile
FROM node:18-alpine

# Install git for version generation
RUN apk add --no-cache git

# Configure git to trust /app directory (required for Docker volume mounts)
RUN git config --global --add safe.directory /app

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm install

# 复制所有文件
COPY . .

# 暴露 Vite 开发服务器端口
# EXPOSE 3000

# 启动开发服务器
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

