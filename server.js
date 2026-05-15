/**
 * ============================================================
 * DocMind AI文档问答系统 - Express后端服务
 * ============================================================
 * 技术栈: Express + multer + pdf-parse + sqlite3 + cors + dotenv + uuid
 * 功能: 文档上传/解析/切片/存储 + AI流式问答(SSE)
 * 端口: 3458
 * ============================================================
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// ============================================================
// 配置常量
// ============================================================
const PORT = process.env.PORT || 3458;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10', 10) * 1024 * 1024; // 10MB
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '500', 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '100', 10);

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_DIR = path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'documents.db');

// ============================================================
// 确保必要目录存在
// ============================================================
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[初始化] 创建上传目录: ${UPLOAD_DIR}`);
}
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log(`[初始化] 创建数据库目录: ${DB_DIR}`);
}

// ============================================================
// 初始化Express应用
// ============================================================
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 前端静态文件服务
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  console.log(`[初始化] 静态文件服务目录: ${DIST_DIR}`);
}

// ============================================================
// 初始化SQLite数据库
// ============================================================
let db;

async function initDatabase() {
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  console.log(`[数据库] 已连接: ${DB_PATH}`);

  // 创建documents表：存储文档元数据、全文内容、摘要和切片
  await db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      originalName TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      mimeType TEXT NOT NULL DEFAULT 'application/octet-stream',
      content TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      chunks TEXT NOT NULL DEFAULT '[]',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建conversations表：存储对话历史
  await db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      docId TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (docId) REFERENCES documents(id) ON DELETE CASCADE
    )
  `);

  // 创建索引加速查询
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_docId ON conversations(docId)
  `);

  console.log('[数据库] 表结构初始化完成');
}

// ============================================================
// 配置multer文件上传
// ============================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // 使用UUID生成唯一文件名，保留原始扩展名
    const ext = path.extname(file.originalname) || '.bin';
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // 只允许PDF和TXT文件
  const allowedMimeTypes = ['application/pdf', 'text/plain'];
  const allowedExtensions = ['.pdf', '.txt'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型，仅支持PDF和TXT文件'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// ============================================================
// 核心功能函数
// ============================================================

/**
 * 从文件中提取文本内容
 * @param {string} filePath - 文件绝对路径
 * @param {string} mimeType - 文件MIME类型
 * @returns {Promise<string>} - 提取的文本内容
 */
async function extractText(filePath, mimeType) {
  try {
    const ext = path.extname(filePath).toLowerCase();

    if (mimeType === 'application/pdf' || ext === '.pdf') {
      // PDF文件：使用pdf-parse提取文本
      const buffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(buffer);
      return pdfData.text || '';
    } else if (mimeType === 'text/plain' || ext === '.txt') {
      // TXT文件：使用fs.readFile读取UTF-8文本
      const text = fs.readFileSync(filePath, 'utf-8');
      return text;
    } else {
      throw new Error(`不支持的文件类型: ${mimeType}`);
    }
  } catch (error) {
    console.error(`[extractText] 文本提取失败: ${error.message}`);
    throw error;
  }
}

/**
 * 将文本切片为固定大小的块（带重叠）
 * @param {string} text - 原始文本
 * @param {number} chunkSize - 每块最大字符数（默认500）
 * @param {number} overlap - 相邻块重叠字符数（默认100）
 * @returns {string[]} - 文本块数组
 */
function chunkText(text, chunkSize = 500, overlap = 100) {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);
    // 下一块的起始位置 = 当前结束位置 - 重叠大小
    start = end - overlap;
    // 如果下一块和当前块起始位置相同，说明已经到末尾，退出循环
    if (start <= 0 || start >= text.length || end === text.length) {
      break;
    }
  }

  return chunks;
}

/**
 * 调用DeepSeek API生成文档摘要
 * @param {string} text - 文档全文（前2000字符用于摘要）
 * @returns {Promise<string>} - 生成的摘要
 */
async function generateSummary(text) {
  try {
    if (!DEEPSEEK_API_KEY) {
      console.warn('[generateSummary] 未配置DeepSeek API密钥，返回默认摘要');
      return '（未配置API密钥，无法生成摘要）';
    }

    // 截取前2000字符用于生成摘要，避免超出token限制
    const truncatedText = text.slice(0, 2000);

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个文档摘要助手。请用2-3句话概括以下文档的核心内容，语言简洁。'
          },
          {
            role: 'user',
            content: `请为以下文档生成摘要（50字以内）：\n\n${truncatedText}`
          }
        ],
        max_tokens: 200,
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || '（摘要生成失败）';
    return summary;
  } catch (error) {
    console.error(`[generateSummary] 摘要生成失败: ${error.message}`);
    return '（摘要生成失败）';
  }
}

/**
 * 关键词匹配检索：根据问题找到最相关的文本块
 * 简化BM25算法：基于关键词匹配度排序
 * @param {string} question - 用户问题
 * @param {string[]} chunks - 文本块数组
 * @param {number} topK - 返回最相关的K个块（默认3）
 * @returns {string[]} - 最相关的文本块数组
 */
function findRelevantChunks(question, chunks, topK = 3) {
  if (!chunks || chunks.length === 0) {
    return [];
  }

  if (!question || question.trim().length === 0) {
    return chunks.slice(0, topK);
  }

  // 提取问题中的关键词（去除停用词，保留中文字符、英文单词、数字）
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '什么', '怎么', '吗', '呢', '吧', '啊', '嗯', '哦', '的', '地', '得', '之', '与', '及', '或', '但', '而', '因', '于', '则', '却', '以', '为', '被', '把', '让', '向', '从', '比', '对', '关于', '根据', '按照', '通过', '为了', '为着', '除了', '除开', '除去', '有关', '相关', '涉及', '至于', '就是', '即', '便', '即使', '即便', '哪怕', '尽管', '虽然', '虽说', '如此', '这样', '那样', '这里', '那里', '哪里', '这边', '那边', '那边', '哪里', '谁', '哪', '哪个', '哪些', '哪里', '几时', '多少', '几', '怎么', '怎样', '如何', '为什么', '为何', '干什么', '干嘛', '干吗', 'who', 'what', 'when', 'where', 'why', 'how', 'which', 'this', 'that', 'these', 'those', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'ought', 'need', 'dare', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'and', 'but', 'or', 'yet', 'so', 'if', 'because', 'although', 'though', 'while', 'where', 'when', 'that', 'which', 'who', 'whom', 'whose', 'what', 'whatever', 'whoever', 'whomever', 'whichever', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'now', 'then', 'here', 'there', 'once', 'again', 'further'
  ]);

  // 提取关键词：中文字符（2字以上）、英文单词、数字
  const keywords = [];

  // 匹配中文词汇（连续中文字符，至少2个字）
  const chineseMatches = question.match(/[\u4e00-\u9fff]{2,}/g) || [];
  keywords.push(...chineseMatches);

  // 匹配英文单词（2字符以上）
  const englishMatches = question.match(/[a-zA-Z]{2,}/g) || [];
  keywords.push(...englishMatches.map(w => w.toLowerCase()));

  // 匹配数字
  const numberMatches = question.match(/\d+/g) || [];
  keywords.push(...numberMatches);

  // 去重并过滤停用词
  const uniqueKeywords = [...new Set(keywords)].filter(k => !stopWords.has(k));

  // 如果没有提取到有效关键词，返回前topK个块
  if (uniqueKeywords.length === 0) {
    return chunks.slice(0, topK);
  }

  // 计算每个chunk的相关性得分
  const scoredChunks = chunks.map((chunk, index) => {
    const lowerChunk = chunk.toLowerCase();
    let score = 0;

    for (const keyword of uniqueKeywords) {
      const lowerKeyword = keyword.toLowerCase();
      // 计算关键词在chunk中出现的次数
      let pos = 0;
      let count = 0;
      while ((pos = lowerChunk.indexOf(lowerKeyword, pos)) !== -1) {
        count++;
        pos += lowerKeyword.length;
      }

      if (count > 0) {
        // 基础分：关键词出现一次得10分
        score += count * 10;
        // 标题/开头加权：关键词出现在chunk前50字符额外加5分
        if (lowerChunk.slice(0, 50).includes(lowerKeyword)) {
          score += 5;
        }
      }
    }

    // 长度归一化：较短的chunk如果包含关键词，权重更高
    if (score > 0) {
      score = score / (1 + Math.log(lowerChunk.length + 1));
    }

    return { chunk, score, index };
  });

  // 按得分降序排序，取前topK个
  scoredChunks.sort((a, b) => b.score - a.score);
  const topChunks = scoredChunks.slice(0, topK).map(item => item.chunk);

  return topChunks;
}

// ============================================================
// API路由
// ============================================================

/**
 * POST /api/documents — 上传文件
 * 接收PDF/TXT文件，提取文本，切片，生成摘要，存入数据库
 */
app.post('/api/documents', upload.single('file'), async (req, res) => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件（支持PDF/TXT）'
      });
    }

    const file = req.file;
    console.log(`[上传] 文件: ${file.originalname} (${file.size} bytes)`);

    // 提取文本内容
    const text = await extractText(file.path, file.mimetype);

    if (!text || text.trim().length === 0) {
      // 删除空文件
      fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        error: '无法从文件中提取文本内容，请检查文件是否有效'
      });
    }

    // 文本切片
    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

    // 生成摘要（异步，不阻塞响应）
    const summary = await generateSummary(text);

    // 生成文档ID
    const docId = uuidv4();

    // 存入数据库
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO documents (id, filename, originalName, size, mimeType, content, summary, chunks, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [docId, file.filename, file.originalname, file.size, file.mimetype, text, summary, JSON.stringify(chunks), now, now]
    );

    console.log(`[上传] 文档已保存: id=${docId}, chunks=${chunks.length}`);

    res.status(201).json({
      success: true,
      data: {
        id: docId,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        summary: summary,
        chunkCount: chunks.length,
        createdAt: now
      }
    });
  } catch (error) {
    console.error(`[POST /api/documents] 上传失败: ${error.message}`);
    // 清理上传的文件
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: `文件上传失败: ${error.message}`
    });
  }
});

/**
 * GET /api/documents — 获取文档列表
 * 返回所有文档的简要信息（不含全文和切片）
 */
app.get('/api/documents', async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, filename, originalName, size, summary, createdAt
       FROM documents
       ORDER BY createdAt DESC`
    );

    res.json({
      success: true,
      data: rows || []
    });
  } catch (error) {
    console.error(`[GET /api/documents] 查询失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `获取文档列表失败: ${error.message}`
    });
  }
});

/**
 * GET /api/documents/:id — 获取文档详情
 * 包含全文内容和解析后的chunks数组
 */
app.get('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const row = await db.get(
      `SELECT id, filename, originalName, size, mimeType, content, summary, chunks, createdAt, updatedAt
       FROM documents
       WHERE id = ?`,
      [id]
    );

    if (!row) {
      return res.status(404).json({
        success: false,
        error: '文档不存在'
      });
    }

    // 解析chunks JSON字符串为数组
    let chunksArray = [];
    try {
      chunksArray = JSON.parse(row.chunks || '[]');
    } catch (e) {
      console.warn(`[GET /api/documents/:id] chunks解析失败: ${e.message}`);
      chunksArray = [];
    }

    res.json({
      success: true,
      data: {
        ...row,
        chunks: chunksArray
      }
    });
  } catch (error) {
    console.error(`[GET /api/documents/:id] 查询失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `获取文档详情失败: ${error.message}`
    });
  }
});

/**
 * DELETE /api/documents/:id — 删除文档
 * 删除数据库记录、关联对话、上传的文件
 */
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 查询文档信息（获取文件名以便删除文件）
    const row = await db.get(
      `SELECT filename FROM documents WHERE id = ?`,
      [id]
    );

    if (!row) {
      return res.status(404).json({
        success: false,
        error: '文档不存在'
      });
    }

    // 删除关联的对话记录
    await db.run(`DELETE FROM conversations WHERE docId = ?`, [id]);

    // 删除数据库记录
    await db.run(`DELETE FROM documents WHERE id = ?`, [id]);

    // 删除上传的文件
    const filePath = path.join(UPLOAD_DIR, row.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[删除] 文件已删除: ${filePath}`);
    }

    console.log(`[删除] 文档已删除: id=${id}`);

    res.json({
      success: true,
      message: '文档删除成功'
    });
  } catch (error) {
    console.error(`[DELETE /api/documents/:id] 删除失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `删除文档失败: ${error.message}`
    });
  }
});

/**
 * POST /api/chat — SSE流式问答
 * 基于文档内容进行AI问答，使用SSE流式返回回答
 */
app.post('/api/chat', async (req, res) => {
  const { docId, question } = req.body;

  // 参数校验
  if (!docId || !question || question.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: docId 和 question'
    });
  }

  try {
    // 1. 从数据库获取文档信息和chunks
    const row = await db.get(
      `SELECT content, chunks FROM documents WHERE id = ?`,
      [docId]
    );

    if (!row) {
      return res.status(404).json({
        success: false,
        error: '文档不存在'
      });
    }

    // 2. 解析chunks
    let chunks = [];
    try {
      chunks = JSON.parse(row.chunks || '[]');
    } catch (e) {
      console.warn(`[POST /api/chat] chunks解析失败: ${e.message}`);
    }

    if (chunks.length === 0) {
      return res.status(400).json({
        success: false,
        error: '文档内容为空，无法进行问答'
      });
    }

    // 3. 关键词匹配选取最相关的chunks
    const relevantChunks = findRelevantChunks(question, chunks, 3);
    const context = relevantChunks.join('\n\n---\n\n');

    // 4. 构造systemPrompt
    const systemPrompt = `你是文档问答助手DocMind。基于以下文档片段回答问题，请遵循以下规则：
1. 只根据提供的文档片段回答，不要编造信息
2. 如果文档片段中没有相关信息，请诚实告知"根据文档内容，我无法找到相关答案"
3. 回答要简洁、准确、有条理
4. 如果涉及多个方面，请分点说明

以下是相关文档片段：

${context}`;

    // 5. 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲

    // 6. 调用DeepSeek API（流式模式）
    if (!DEEPSEEK_API_KEY) {
      res.write(`data: {"error":"未配置DeepSeek API密钥，无法回答提问"}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API请求失败: ${response.status} - ${errorText}`);
    }

    // 7. 使用reader.read() + decoder解析SSE流
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // 解码收到的字节数据
      buffer += decoder.decode(value, { stream: true });

      // 按行分割处理
      const lines = buffer.split('\n');
      // 保留最后一行（可能不完整）
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        // 跳过空行和注释行
        if (!trimmedLine || trimmedLine.startsWith(':')) {
          continue;
        }

        // 处理data:前缀的行
        if (trimmedLine.startsWith('data: ')) {
          const dataContent = trimmedLine.slice(6);

          // 流结束标记
          if (dataContent === '[DONE]') {
            // 转发结束标记给客户端
            res.write(`data: [DONE]\n\n`);
            continue;
          }

          // 8. 解析JSON提取delta.content
          try {
            const parsed = JSON.parse(dataContent);
            const deltaContent = parsed.choices?.[0]?.delta?.content;

            if (deltaContent) {
              // 9. 用res.write()发送SSE格式数据
              const payload = JSON.stringify({ content: deltaContent });
              res.write(`data: ${payload}\n\n`);
            }

            // 处理finish_reason表示流结束
            if (parsed.choices?.[0]?.finish_reason === 'stop') {
              res.write(`data: [DONE]\n\n`);
            }
          } catch (parseError) {
            // JSON解析失败，跳过该行
            console.warn(`[SSE] JSON解析失败: ${parseError.message}, 原始数据: ${dataContent.slice(0, 100)}`);
          }
        }
      }
    }

    // 处理缓冲区中剩余的数据
    if (buffer.trim()) {
      const trimmedLine = buffer.trim();
      if (trimmedLine.startsWith('data: ')) {
        const dataContent = trimmedLine.slice(6);
        if (dataContent === '[DONE]') {
          res.write(`data: [DONE]\n\n`);
        } else {
          try {
            const parsed = JSON.parse(dataContent);
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              const payload = JSON.stringify({ content: deltaContent });
              res.write(`data: ${payload}\n\n`);
            }
          } catch (e) {
            // 忽略解析失败的最后一段
          }
        }
      }
    }

    // 确保发送结束标记
    res.write(`data: [DONE]\n\n`);
    res.end();

    console.log(`[SSE] 问答完成: docId=${docId}, question="${question.slice(0, 50)}..."`);

  } catch (error) {
    console.error(`[POST /api/chat] 问答失败: ${error.message}`);

    // 10. 错误时发送SSE格式错误
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: `问答失败: ${error.message}`
      });
    } else {
      // 如果SSE已经开始，用SSE格式发送错误
      const errorPayload = JSON.stringify({ error: error.message || '处理过程中发生错误' });
      res.write(`data: ${errorPayload}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  }
});

// ============================================================
// 全局错误处理中间件
// ============================================================

// multer文件大小超限错误处理
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: `文件大小超过限制（最大${MAX_FILE_SIZE / 1024 / 1024}MB）`
      });
    }
    return res.status(400).json({
      success: false,
      error: `文件上传错误: ${error.message}`
    });
  }

  // 其他错误
  if (error) {
    console.error(`[全局错误] ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }

  next();
});

// ============================================================
// 健康检查端点（必须在 * 通配路由之前定义）
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'docmind-server',
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// SPA支持：通配路由返回index.html（必须放在所有路由最后）
// ============================================================
app.get('*', (req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      success: false,
      error: '请求的资源不存在'
    });
  }
});

// ============================================================
// 启动服务器
// ============================================================
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();

    // 启动HTTP服务
    app.listen(PORT, '0.0.0.0', () => {
      console.log('============================================================');
      console.log('  DocMind AI文档问答系统 - 后端服务已启动');
      console.log('============================================================');
      console.log(`  服务地址: http://localhost:${PORT}`);
      console.log(`  数据库  : ${DB_PATH}`);
      console.log(`  上传目录: ${UPLOAD_DIR}`);
      console.log(`  环境模式: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  API密钥 : ${DEEPSEEK_API_KEY ? '已配置' : '未配置'}`);
      console.log('============================================================');
    });
  } catch (error) {
    console.error(`[启动失败] ${error.message}`);
    process.exit(1);
  }
}

// 启动
startServer();

// 进程退出时关闭数据库连接
process.on('SIGINT', async () => {
  console.log('\n[关闭] 正在关闭数据库连接...');
  if (db) {
    await db.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[关闭] 正在关闭数据库连接...');
  if (db) {
    await db.close();
  }
  process.exit(0);
});
