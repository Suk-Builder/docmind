# DocMind

> RAG-powered document Q&A system. Upload PDF/TXT documents, get AI-generated summaries, and ask questions with SSE streaming responses grounded in your documents.

[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek_API-purple)](https://platform.deepseek.com/)

## Overview

**DocMind** demonstrates practical implementation of **Retrieval-Augmented Generation (RAG)** — a pattern essential for enterprise AI applications. It processes uploaded documents, chunks them for efficient retrieval, and answers questions strictly based on document content.

## Features

- **Document upload**: Drag-and-drop PDF/TXT (up to 10MB)
- **AI summarization**: Automatic document abstract via DeepSeek API
- **Smart chunking**: 500-character chunks with 100-character overlap for optimal retrieval
- **SSE streaming Q&A**: Real-time, grounded answers that cite document sources
- **Keyword retrieval**: Simplified BM25-based relevance matching
- **Document management**: List, view, and delete uploaded documents

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, TypeScript |
| Backend | Express, multer (upload), pdf-parse |
| Database | SQLite (document metadata + chunk storage) |
| AI | DeepSeek API (SSE streaming) |
| Retrieval | Custom BM25-style keyword matching |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/documents` | Upload document (multipart) |
| `GET` | `/api/documents` | List all documents |
| `GET` | `/api/documents/:id` | Get document details |
| `DELETE` | `/api/documents/:id` | Remove document |
| `POST` | `/api/chat` | SSE streaming Q&A |

## Quick Start

```bash
git clone https://github.com/Suk-Builder/docmind.git
cd docmind
cp .env.example .env
# Add your DEEPSEEK_API_KEY
npm install
npm run build
npm start
# http://localhost:443 (or PORT in .env)
```

## RAG Pipeline

```
PDF/TXT Upload
    → Text extraction (pdf-parse)
    → Chunking (500 chars, 100 overlap)
    → BM25 keyword indexing
    → SQLite storage

User Question
    → Keyword matching → Retrieve top-k chunks
    → DeepSeek API (context + question)
    → SSE stream response with source references
```

## Why This Matters for Germany

RAG architecture is a core requirement for **DiGA-compliant** medical documentation systems and enterprise knowledge management in GDPR-regulated environments. DocMind demonstrates practical implementation of:

- Document ingestion and processing pipelines
- Vector/text hybrid retrieval
- Streaming AI responses with source attribution
- Data privacy (on-premise deployment, no external data leakage)

## Deployment

```bash
# PM2
pm2 start ecosystem.config.js
pm2 save

# Docker (if available)
docker-compose up -d
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `443` | Server port |
| `DEEPSEEK_API_KEY` | — | DeepSeek API key |
| `DB_PATH` | `./db/docmind.db` | SQLite database path |

## About

Built by [Ying Momo](https://github.com/Suk-Builder) — Computer Science undergraduate, targeting Germany's AI and digital health market.

## License

MIT

---

## 与Builder-System的关系

本项目属于Builder-System **域II — AI认知**：AI文档问答系统。FastAPI+React 19，Builder-System文档知识库。

Builder-System（V4.3，104篇文本、35元概念）→ [了解更多](https://github.com/Suk-Builder/Builder-System)
