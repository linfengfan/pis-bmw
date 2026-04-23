#!/bin/bash
# 一键启动脚本（Node.js 后端 + Next.js 前端）

set -e

cd "$(dirname "$0")"

echo "📦 安装后端依赖..."
cd backend
npm install

echo "🚀 启动后端服务 (http://localhost:8000) ..."
npm run dev &
BACKEND_PID=$!

sleep 2

echo "📦 安装前端依赖..."
cd ../frontend
npm install

echo "🚀 启动前端服务 (http://localhost:3000) ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动:"
echo "   后端: http://localhost:8000"
echo "   前端: http://localhost:3000"
echo ""
echo "⚠️  首次运行需要先安装 Ollama + Embedding 模型："
echo "   1. brew install ollama          # 或从 ollama.com 下载"
echo "   2. ollama serve                 # 启动 Ollama 服务"
echo "   3. ollama pull nomic-embed-text # 下载中文Embedding模型"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait