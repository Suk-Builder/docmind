#!/bin/bash
# ============================================================
# DocMind AI文档问答系统 - 一键部署脚本
# 用法: ./deploy.sh
# ============================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

# 配置
PROJECT_NAME="docmind"
PM2_APP_NAME="docmind-server"
PORT=3458

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  DocMind AI文档问答系统 - 部署脚本${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# --------------------------------------------------------
# 步骤1: 拉取最新代码
# --------------------------------------------------------
echo -e "${YELLOW}[步骤1/5] 拉取最新代码...${NC}"
if [ -d ".git" ]; then
    git pull origin main || git pull origin master || echo -e "${YELLOW}警告: git pull失败，使用本地代码继续${NC}"
else
    echo -e "${YELLOW}警告: 不是git仓库，跳过git pull${NC}"
fi
echo -e "${GREEN}✓ 代码更新完成${NC}"
echo ""

# --------------------------------------------------------
# 步骤2: 安装依赖
# --------------------------------------------------------
echo -e "${YELLOW}[步骤2/5] 安装后端依赖...${NC}"
npm install
echo -e "${GREEN}✓ 依赖安装完成${NC}"
echo ""

# --------------------------------------------------------
# 步骤3: 构建前端（如果存在前端目录）
# --------------------------------------------------------
echo -e "${YELLOW}[步骤3/5] 构建前端...${NC}"
if [ -d "../web" ]; then
    cd ../web
    npm install 2>/dev/null || true
    npm run build 2>/dev/null || true
    if [ -d "dist" ]; then
        cp -r dist ../docmind/
        echo -e "${GREEN}✓ 前端构建完成，已复制dist目录${NC}"
    else
        echo -e "${YELLOW}警告: 前端构建输出目录不存在${NC}"
    fi
    cd ../docmind
elif [ -d "./web" ]; then
    cd web
    npm install 2>/dev/null || true
    npm run build 2>/dev/null || true
    if [ -d "dist" ]; then
        cp -r dist ../
        echo -e "${GREEN}✓ 前端构建完成，已复制dist目录${NC}"
    fi
    cd ..
else
    echo -e "${YELLOW}警告: 未找到前端目录，跳过前端构建${NC}"
fi
echo ""

# --------------------------------------------------------
# 步骤4: 确保目录结构存在
# --------------------------------------------------------
echo -e "${YELLOW}[步骤4/5] 检查目录结构...${NC}"
mkdir -p db uploads dist
echo -e "${GREEN}✓ 目录结构检查完成${NC}"
echo ""

# --------------------------------------------------------
# 步骤5: PM2重启/启动服务
# --------------------------------------------------------
echo -e "${YELLOW}[步骤5/5] PM2部署服务...${NC}"

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}错误: PM2未安装，正在全局安装...${NC}"
    npm install -g pm2
fi

# 如果服务已在运行，先删除旧进程（避免端口冲突）
if pm2 describe "$PM2_APP_NAME" &> /dev/null; then
    echo "检测到已有PM2进程，先停止并删除..."
    pm2 delete "$PM2_APP_NAME" || true
fi

# 启动新服务
pm2 start server.js --name "$PM2_APP_NAME" -- --port "$PORT"

# 保存PM2进程列表，确保重启后自动恢复
pm2 save

echo -e "${GREEN}✓ 服务已启动${NC}"
echo ""

# --------------------------------------------------------
# 部署状态
# --------------------------------------------------------
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}  部署成功!${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "  ${BLUE}服务名称:${NC} $PM2_APP_NAME"
echo -e "  ${BLUE}服务端口:${NC} $PORT"
echo -e "  ${BLUE}PM2状态 :${NC}"
pm2 describe "$PM2_APP_NAME" 2>/dev/null || true
echo ""
echo -e "  ${BLUE}健康检查:${NC} curl http://localhost:$PORT/health"
echo -e "  ${BLUE}查看日志:${NC} pm2 logs $PM2_APP_NAME"
echo -e "  ${BLUE}重启服务:${NC} pm2 restart $PM2_APP_NAME"
echo -e "  ${BLUE}停止服务:${NC} pm2 stop $PM2_APP_NAME"
echo ""
echo -e "${BLUE}============================================================${NC}"

# 如果PM2未配置开机自启，给出提示
if ! command -v systemctl &> /dev/null || ! systemctl is-active --quiet pm2-root 2>/dev/null; then
    echo -e "${YELLOW}提示: 可运行 'pm2 startup' 配置开机自启${NC}"
fi
