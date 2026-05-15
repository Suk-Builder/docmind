# DocMind - AI 文档问答系统

上传 PDF/TXT 文档，AI 自动生成摘要，基于文档内容进行 SSE 流式问答。

## 在线访问

```
http://116.62.53.136:443
```

## 功能

- **文档上传**：拖拽或点击上传 PDF/TXT，10MB 限制
- **AI 摘要**：DeepSeek API 自动生成文档摘要
- **文本切片**：500 字符/块，100 字符重叠
- **SSE 流式问答**：基于文档内容实时回答，逐字显示
- **关键词检索**：简化 BM25 匹配最相关文本片段

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/api/documents` | 上传文档（multipart/form-data） |
| GET | `/api/documents` | 文档列表 |
| GET | `/api/documents/:id` | 文档详情 |
| DELETE | `/api/documents/:id` | 删除文档 |
| POST | `/api/chat` | SSE 流式问答 |

## 技术栈

- 后端：Express + multer + pdf-parse + sqlite3
- 前端：React 19 + Vite + Tailwind CSS + TypeScript
- AI：DeepSeek API（SSE 流式）

## 部署

```bash
git clone https://github.com/Suk-Builder/docmind.git
cd docmind
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY
npm install
npm run build
npm start
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` | 服务端口（默认 443） |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `DB_PATH` | SQLite 数据库路径 |

## pm2 管理

```bash
pm2 start ecosystem.config.js
pm2 save
```
