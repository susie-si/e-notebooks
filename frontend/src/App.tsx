import { useEffect, useState, useMemo } from 'react'
import './App.css'

type Note = {
  id: string
  title: string
  content: string
  createdAt: string
  tags: string[]
  notebook?: string
  project?: string
}

type Notebook = { id: string; name: string }

type AiSearchResult = {
  query: string
  answer: string
  notes: Note[]
}

// 解析 "YYYY-MM-DD HH:mm" 为 Date
function parseNoteDate(s: string): Date {
  const [datePart, timePart] = s.split(' ')
  const [y, m, d] = (datePart || '').split('-').map(Number)
  const [h, min] = (timePart || '0:0').split(':').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0)
}

// 时间线分组：今天、本周、本月、更早
function groupByTimeline(notes: Note[]): { label: string; notes: Note[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const groups: { label: string; notes: Note[] }[] = [
    { label: '今天', notes: [] },
    { label: '本周', notes: [] },
    { label: '本月', notes: [] },
    { label: '更早', notes: [] },
  ]

  notes.forEach((note) => {
    const d = parseNoteDate(note.createdAt)
    if (d >= today) groups[0].notes.push(note)
    else if (d >= weekStart) groups[1].notes.push(note)
    else if (d >= monthStart) groups[2].notes.push(note)
    else groups[3].notes.push(note)
  })

  return groups.filter((g) => g.notes.length > 0)
}

// 按标签主题聚类
function groupByTheme(notes: Note[]): { tag: string; notes: Note[] }[] {
  const map = new Map<string, Note[]>()
  notes.forEach((note) => {
    const tags = note.tags?.length ? note.tags : ['未分类']
    tags.forEach((tag) => {
      if (!map.has(tag)) map.set(tag, [])
      map.get(tag)!.push(note)
    })
  })
  return Array.from(map.entries()).map(([tag, list]) => ({ tag, notes: list }))
}

// 按项目分组
function groupByProject(notes: Note[]): { project: string; notes: Note[] }[] {
  const map = new Map<string, Note[]>()
  notes.forEach((note) => {
    const p = (note.project && note.project.trim()) || '未分类'
    if (!map.has(p)) map.set(p, [])
    map.get(p)!.push(note)
  })
  return Array.from(map.entries()).map(([project, list]) => ({ project, notes: list }))
}

type ViewMode = 'list' | 'timeline' | 'theme' | 'project'

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [notebooks, setNotebooks] = useState<Notebook[]>([
    { id: 'all', name: '全部笔记' },
    { id: '默认', name: '默认' },
    { id: '工作', name: '工作' },
    { id: '学习', name: '学习' },
    { id: '生活', name: '生活' },
  ])
  const [currentNotebook, setCurrentNotebook] = useState<string>('all')
  const [currentView, setCurrentView] = useState<ViewMode>('list')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [notebook, setNotebook] = useState('默认')
  const [project, setProject] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResult, setSearchResult] = useState<AiSearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // 拉取笔记本列表
  useEffect(() => {
    const fetchNotebooks = async () => {
      try {
        const res = await fetch('/api/notebooks')
        if (!res.ok) return
        const data: Notebook[] = await res.json()
        setNotebooks(data)
      } catch {
        setNotebooks([{ id: 'all', name: '全部笔记' }, { id: '默认', name: '默认' }, { id: '工作', name: '工作' }, { id: '学习', name: '学习' }, { id: '生活', name: '生活' }])
      }
    }
    fetchNotebooks()
  }, [])

  // 拉取笔记列表（按当前笔记本筛选）
  const fetchNotes = async () => {
    try {
      setLoadingNotes(true)
      setError(null)
      const url = currentNotebook === 'all' ? '/api/notes' : `/api/notes?notebook=${encodeURIComponent(currentNotebook)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('获取笔记失败')
      const data: Note[] = await res.json()
      setNotes(data)
      if (data.length > 0 && (!selectedNoteId || !data.some((n) => n.id === selectedNoteId))) {
        setSelectedNoteId(data[0].id)
        setTitle(data[0].title)
        setContent(data[0].content)
        setNotebook(data[0].notebook || '默认')
        setProject(data[0].project || '')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingNotes(false)
    }
  }

  useEffect(() => {
    fetchNotes()
  }, [currentNotebook])

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null

  // 当前列表展示的笔记（按笔记本已由接口筛选）；用于智能视图分组
  const filteredNotes = notes

  const timelineGroups = useMemo(() => groupByTimeline(filteredNotes), [filteredNotes])
  const themeGroups = useMemo(() => groupByTheme(filteredNotes), [filteredNotes])
  const projectGroups = useMemo(() => groupByProject(filteredNotes), [filteredNotes])

  // 新建笔记（使用当前选中的笔记本）
  const handleCreateNote = async () => {
    try {
      setError(null)
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || '无标题笔记',
          content,
          notebook: currentNotebook === 'all' ? undefined : currentNotebook,
          project: project || undefined,
        }),
      })
      if (!res.ok) throw new Error('新建笔记失败')
      const created: Note = await res.json()
      setNotes((prev) => [created, ...prev])
      setSelectedNoteId(created.id)
      setTitle(created.title)
      setContent(created.content)
      setNotebook(created.notebook || '默认')
      setProject(created.project || '')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // 更新笔记（含笔记本、项目）
  const handleUpdateNote = async () => {
    if (!selectedNoteId) return
    try {
      setError(null)
      setAutoSaveStatus('saving')
      const res = await fetch(`/api/notes/${selectedNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, notebook, project: project || '' }),
      })
      if (!res.ok) throw new Error('更新笔记失败')
      const updated: Note = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      setAutoSaveStatus('saved')
    } catch (e) {
      setError((e as Error).message)
      setAutoSaveStatus('idle')
    }
  }

  // 删除笔记
  const handleDeleteNote = async () => {
    if (!selectedNoteId) return
    try {
      setError(null)
      const res = await fetch(`/api/notes/${selectedNoteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除笔记失败')
      setNotes((prev) => prev.filter((n) => n.id !== selectedNoteId))
      const remaining = notes.filter((n) => n.id !== selectedNoteId)
      if (remaining.length > 0) {
        const next = remaining[0]
        setSelectedNoteId(next.id)
        setTitle(next.title)
        setContent(next.content)
        setNotebook(next.notebook || '默认')
        setProject(next.project || '')
      } else {
        setSelectedNoteId(null)
        setTitle('')
        setContent('')
        setNotebook('默认')
        setProject('')
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // AI 搜索
  const handleAiSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      setSearchLoading(true)
      setError(null)
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })
      if (!res.ok) throw new Error('AI 搜索失败')
      const data: AiSearchResult = await res.json()
      setSearchResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearchLoading(false)
    }
  }

  // 自动保存：当当前笔记内容变化并停顿一小会儿时，自动触发更新（含 notebook、project）
  useEffect(() => {
    if (!selectedNoteId) return
    if (!selectedNote) return

    if (
      title === selectedNote.title &&
      content === selectedNote.content &&
      (notebook || '默认') === (selectedNote.notebook || '默认') &&
      (project || '') === (selectedNote.project || '')
    ) {
      return
    }

    setAutoSaveStatus('saving')
    const timer = setTimeout(() => {
      void handleUpdateNote()
    }, 1000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId, title, content, notebook, project])

  const selectNote = (note: Note) => {
    setSelectedNoteId(note.id)
    setTitle(note.title)
    setContent(note.content)
    setNotebook(note.notebook || '默认')
    setProject(note.project || '')
  }

  const renderNoteItem = (note: Note) => (
    <li
      key={note.id}
      className={`note-item ${note.id === selectedNoteId ? 'note-item-active' : ''}`}
      onClick={() => selectNote(note)}
    >
      <div className="note-title">{note.title}</div>
      <div className="note-meta">
        <span>{note.createdAt}</span>
        <span>{(note.tags || []).join(' · ') || '—'}</span>
      </div>
      <div className="note-preview">{note.content}</div>
    </li>
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">AI Notebook</div>
        <button className="primary-btn" onClick={handleCreateNote}>
          新建笔记
        </button>
        <div className="sidebar-section">
          <h3>笔记本</h3>
          <ul>
            {notebooks.map((nb) => (
              <li
                key={nb.id}
                className={currentNotebook === nb.id ? 'active' : ''}
                onClick={() => setCurrentNotebook(nb.id)}
              >
                {nb.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-section">
          <h3>智能视图</h3>
          <ul>
            <li className={currentView === 'list' ? 'active' : ''} onClick={() => setCurrentView('list')}>
              列表
            </li>
            <li className={currentView === 'timeline' ? 'active' : ''} onClick={() => setCurrentView('timeline')}>
              时间线
            </li>
            <li className={currentView === 'theme' ? 'active' : ''} onClick={() => setCurrentView('theme')}>
              主题聚类
            </li>
            <li className={currentView === 'project' ? 'active' : ''} onClick={() => setCurrentView('project')}>
              项目视图
            </li>
          </ul>
        </div>
      </aside>

      <main className="main">
        <header className="main-header">
          <input
            className="search-input"
            placeholder="在所有笔记中搜索或直接提问，例如：上周会议的行动项？"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="secondary-btn" onClick={handleAiSearch} disabled={searchLoading}>
            {searchLoading ? '搜索中…' : 'AI 搜索'}
          </button>
        </header>

        <section className="content">
          <div className="note-list">
            <h2>
              {currentView === 'list' && '笔记列表'}
              {currentView === 'timeline' && '时间线'}
              {currentView === 'theme' && '主题聚类'}
              {currentView === 'project' && '项目视图'}
            </h2>
            {loadingNotes && <div className="note-hint">正在加载笔记…</div>}
            {currentView === 'list' && (
              <ul>
                {notes.map((note) => renderNoteItem(note))}
              </ul>
            )}
            {currentView === 'timeline' && (
              <div className="view-groups">
                {timelineGroups.length === 0 && !loadingNotes && (
                  <div className="view-empty">暂无笔记</div>
                )}
                {timelineGroups.map((g) => (
                  <div key={g.label} className="view-group">
                    <div className="view-group-title">{g.label}</div>
                    <ul>{g.notes.map((note) => renderNoteItem(note))}</ul>
                  </div>
                ))}
              </div>
            )}
            {currentView === 'theme' && (
              <div className="view-groups">
                {themeGroups.length === 0 && !loadingNotes && (
                  <div className="view-empty">暂无笔记</div>
                )}
                {themeGroups.map((g) => (
                  <div key={g.tag} className="view-group">
                    <div className="view-group-title">#{g.tag}</div>
                    <ul>{g.notes.map((note) => renderNoteItem(note))}</ul>
                  </div>
                ))}
              </div>
            )}
            {currentView === 'project' && (
              <div className="view-groups">
                {projectGroups.length === 0 && !loadingNotes && (
                  <div className="view-empty">暂无笔记</div>
                )}
                {projectGroups.map((g) => (
                  <div key={g.project} className="view-group">
                    <div className="view-group-title">{g.project}</div>
                    <ul>{g.notes.map((note) => renderNoteItem(note))}</ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="editor-panel">
            <div className="editor-header">
              <input
                className="editor-title"
                placeholder="无标题笔记"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="editor-actions">
                <span className="autosave-hint">
                  {autoSaveStatus === 'saving'
                    ? '自动保存中…'
                    : autoSaveStatus === 'saved'
                      ? '已自动保存'
                      : ''}
                </span>
                <button className="secondary-btn" onClick={handleDeleteNote} disabled={!selectedNoteId}>
                  删除
                </button>
              </div>
            </div>
            <div className="editor-meta">
              <label className="editor-meta-label">
                笔记本
                <select
                  className="editor-select"
                  value={notebook}
                  onChange={(e) => setNotebook(e.target.value)}
                >
                  {notebooks.filter((nb) => nb.id !== 'all').map((nb) => (
                    <option key={nb.id} value={nb.id}>
                      {nb.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="editor-meta-label">
                项目
                <input
                  className="editor-project-input"
                  placeholder="可选，如：产品需求、前端学习"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                />
              </label>
            </div>
            <textarea
              className="editor-body"
              placeholder="在这里随便记点什么，比如今天学到了什么、开会的结论、灵感碎片……"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {error && <div className="error-text">{error}</div>}
            {searchResult && (
              <div className="ai-panel">
                <div className="ai-answer">{searchResult.answer}</div>
                {searchResult.notes.length > 0 && (
                  <ul className="ai-note-list">
                    {searchResult.notes.map((n) => (
                      <li
                        key={`ai-${n.id}`}
                        onClick={() => {
                          setSelectedNoteId(n.id)
                          setTitle(n.title)
                          setContent(n.content)
                        }}
                      >
                        <span className="ai-note-title">{n.title}</span>
                        <span className="ai-note-meta">{n.createdAt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
