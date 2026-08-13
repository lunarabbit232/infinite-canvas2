#!/bin/bash

echo "🚀 启动无限画布开发环境 (防卡死模式)"

# 1. 启动 Go 后端 (监听 8080)
echo "📦 启动后端..."
go run . &
BACKEND_PID=$!

# 2. 进入前端目录，限制 Node 内存，启动开发服务器
echo "🎨 启动前端 (限制内存 2GB)..."
cd web
NODE_OPTIONS="--max-old-space-size=2048" npm run dev &
FRONTEND_PID=$!

# 3. 捕获 Ctrl+C 信号，同时关闭两个进程
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT

# 4. 保持脚本前台运行，展示日志
wait
