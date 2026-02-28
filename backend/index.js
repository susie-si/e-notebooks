const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 4000
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const isProduction = process.env.NODE_ENV === 'production'

app.use(cors())
app.use(express.json())

// 笔记本可选值（用于分类）
const NOTEBOOK_IDS = ['默认', '工作', '学习', '生活']

// 简单的内存笔记数据，真实项目可换成数据库
let notes = [
  {
    id: '1',
    title: 'React 学习笔记',
    content: '记录了 React 的基础概念和 Hooks 使用方式。',
    createdAt: '2026-02-24 10:00',
    tags: ['前端', 'React', '学习'],
    notebook: '学习',
    project: '前端学习',
  },
  {
    id: '2',
    title: '会议纪要 - 产品讨论',
    content: '整理了本周产品需求评审的关键结论和待办。',
    createdAt: '2026-02-23 15:30',
    tags: ['工作', '会议', 'ToDo'],
    notebook: '工作',
    project: '产品需求',
  },
]

// 简单自动标签示例：根据关键词打标签（代替真实 AI）
function autoTagsFromContent(content = '') {
  const lower = content.toLowerCase()
  const tags = new Set()
  if (lower.includes('react')) tags.add('React')
  if (lower.includes('vue')) tags.add('Vue')
  if (lower.includes('meeting') || lower.includes('会议')) tags.add('会议')
  if (lower.includes('todo') || lower.includes('待办')) tags.add('ToDo')
  if (lower.includes('learn') || lower.includes('学习')) tags.add('学习')
  return Array.from(tags)
}

// 根据内容简单推断建议笔记本
function suggestNotebookFromContent(content = '', title = '') {
  const text = `${title} ${content}`.toLowerCase()
  if (text.includes('会议') || text.includes('需求') || text.includes('工作') || text.includes('todo')) return '工作'
  if (text.includes('学习') || text.includes('react') || text.includes('vue') || text.includes('笔记')) return '学习'
  if (text.includes('生活') || text.includes('旅行') || text.includes('读书')) return '生活'
  return '默认'
}

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// 获取笔记本列表（含「全部」）
app.get('/api/notebooks', (req, res) => {
  res.json([
    { id: 'all', name: '全部笔记' },
    ...NOTEBOOK_IDS.map((id) => ({ id, name: id })),
  ])
})

// 获取全部笔记，可选按笔记本筛选
app.get('/api/notes', (req, res) => {
  const { notebook } = req.query
  let list = notes
  if (notebook && notebook !== 'all') {
    list = notes.filter((n) => (n.notebook || '默认') === notebook)
  }
  res.json(list)
})

// 新建笔记
app.post('/api/notes', (req, res) => {
  const { title = '无标题笔记', content = '', notebook, project } = req.body || {}
  const now = new Date()
  const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`

  const suggestedNotebook = notebook || suggestNotebookFromContent(content, title)

  const newNote = {
    id: String(Date.now()),
    title,
    content,
    createdAt,
    tags: autoTagsFromContent(content),
    notebook: NOTEBOOK_IDS.includes(suggestedNotebook) ? suggestedNotebook : '默认',
    project: project || '',
  }

  notes.unshift(newNote)
  res.status(201).json(newNote)
})

// 更新笔记
app.put('/api/notes/:id', (req, res) => {
  const { id } = req.params
  const { title, content, notebook, project } = req.body || {}

  const idx = notes.findIndex((n) => n.id === id)
  if (idx === -1) {
    return res.status(404).json({ error: 'Note not found' })
  }

  const updated = {
    ...notes[idx],
    title: title ?? notes[idx].title,
    content: content ?? notes[idx].content,
    tags: autoTagsFromContent(content ?? notes[idx].content),
    notebook: notebook !== undefined
      ? (NOTEBOOK_IDS.includes(notebook) ? notebook : '默认')
      : (notes[idx].notebook || '默认'),
    project: project !== undefined ? String(project) : (notes[idx].project || ''),
  }
  notes[idx] = updated
  res.json(updated)
})

// 删除笔记
app.delete('/api/notes/:id', (req, res) => {
  const { id } = req.params
  const before = notes.length
  notes = notes.filter((n) => n.id !== id)
  if (notes.length === before) {
    return res.status(404).json({ error: 'Note not found' })
  }
  res.status(204).end()
})

// 示例：AI 搜索接口（先在本地笔记中筛选，再可选调用大模型生成回答）
app.post('/api/ai/search', async (req, res) => {
  const { query = '' } = req.body || {}
  const q = String(query).trim().toLowerCase()

  if (!q) {
    return res.json({
      query,
      answer: '请输入你想搜索的问题或关键词。',
      notes: [],
    })
  }

  const matched = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q)),
  )

  let answer =
    matched.length === 0
      ? '在当前笔记中没有找到明显相关的内容。'
      : `在你的 ${matched.length} 篇笔记中找到了与「${query}」相关的内容，请查看下方列出的笔记。`

  // 如果没有配置 OPENAI_API_KEY，则只返回基础结果
  if (!OPENAI_API_KEY) {
    return res.json({
      query,
      answer,
      notes: matched,
    })
  }

  try {
    const promptNotes =
      matched
        .slice(0, 10)
        .map(
          (n, idx) =>
            `【笔记${idx + 1}】标题：${n.title}\n时间：${n.createdAt}\n标签：${(n.tags || []).join(
              '，',
            )}\n内容：${n.content}`,
        )
        .join('\n\n') || '当前没有匹配到任何笔记。'

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content:
              '你是一个中文知识整理助手，根据用户的查询和提供的多篇个人笔记内容，给出简洁的总结和行动建议，尽量引用笔记中的结论，不要编造不存在的内容。',
          },
          {
            role: 'user',
            content: `用户问题：${query}\n\n以下是和问题相关的个人笔记，请综合这些内容，用 2~5 句话用中文回答，并在最后给出 1~3 条可执行的行动建议（如有）：\n\n${promptNotes}`,
          },
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content
    if (message) {
      answer = message
    }
  } catch (e) {
    console.error('调用 OpenAI 失败：', e)
    // 失败时退回本地 answer
  }

  res.json({
    query,
    answer,
    notes: matched,
  })
})

// 生产环境：托管前端静态文件，并做 SPA 回退
if (isProduction) {
  const publicDir = path.join(__dirname, 'public')
  app.use(express.static(publicDir))
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}${isProduction ? ' (production)' : ''}`)
})

