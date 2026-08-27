import { Hono } from 'hono'
import { db, mapSentence, mapVocab, type SentenceRow, type VocabRow } from './db.ts'
import { suggestMeaning, suggestSentence } from './suggest.ts'
import { addDays, escapeLike, searchVariants, todaySeoul } from './util.ts'

const sentenceSelect = `
  SELECT s.*, c.name AS category_name, c.emoji AS category_emoji
  FROM sentence s
  JOIN category c ON c.id = s.category_id
`

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM setting').all() as { key: string; value: string }[]
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    dailySentenceGoal: Number(map.dailySentenceGoal ?? 5),
    ttsEngine: (map.ttsEngine === 'piper' ? 'piper' : 'web-speech') as 'piper' | 'web-speech',
    timezone: map.timezone ?? 'Asia/Seoul',
  }
}

export function createApp() {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ ok: true }))

  app.get('/api/settings', (c) => c.json(getSettings()))

  app.put('/api/settings', async (c) => {
    const body = await c.req.json<{
      dailySentenceGoal?: number
      ttsEngine?: string
      timezone?: string
    }>()
    const upsert = db.prepare('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    if (body.dailySentenceGoal != null) upsert.run('dailySentenceGoal', String(body.dailySentenceGoal))
    if (body.ttsEngine) upsert.run('ttsEngine', body.ttsEngine)
    if (body.timezone) upsert.run('timezone', body.timezone)
    return c.json(getSettings())
  })

  app.get('/api/stats', (c) => {
    const settings = getSettings()
    const today = todaySeoul(settings.timezone)
    const saved = (
      db.prepare('SELECT COUNT(*) AS n FROM sentence WHERE created_on = ?').get(today) as { n: number }
    ).n
    const reviewCount = (
      db.prepare(`SELECT COUNT(*) AS n FROM sentence WHERE due_on IS NOT NULL AND due_on <= ?`).get(today) as {
        n: number
      }
    ).n
    const diary = db.prepare('SELECT id FROM diary_entry WHERE date = ?').get(today)
    return c.json({
      today,
      saved,
      goal: settings.dailySentenceGoal,
      reviewCount,
      diarySaved: Boolean(diary),
    })
  })

  app.get('/api/categories', (c) => {
    const rows = db
      .prepare('SELECT id, name, slug, emoji, sort_order AS sortOrder FROM category ORDER BY sort_order, id')
      .all()
    return c.json(rows)
  })

  app.post('/api/categories', async (c) => {
    const body = await c.req.json<{ name: string; emoji?: string }>()
    const name = body.name?.trim()
    if (!name) return c.json({ error: '이름이 필요합니다.' }, 400)
    const slug = `custom-${Date.now()}`
    const max = db.prepare('SELECT MAX(sort_order) AS n FROM category').get() as { n: number | null }
    const info = db
      .prepare('INSERT INTO category (name, slug, emoji, sort_order) VALUES (?, ?, ?, ?)')
      .run(name, slug, body.emoji ?? '✏️', (max.n ?? 0) + 1)
    const row = db
      .prepare('SELECT id, name, slug, emoji, sort_order AS sortOrder FROM category WHERE id = ?')
      .get(info.lastInsertRowid)
    return c.json(row, 201)
  })

  app.get('/api/sentences', (c) => {
    const date = c.req.query('date')
    const categoryId = c.req.query('categoryId')
    const due = c.req.query('due')
    let sql = sentenceSelect
    const params: (string | number)[] = []
    const where: string[] = []
    if (date) {
      where.push('s.created_on = ?')
      params.push(date)
    }
    if (categoryId) {
      where.push('s.category_id = ?')
      params.push(Number(categoryId))
    }
    if (due) {
      where.push('s.due_on IS NOT NULL AND s.due_on <= ?')
      params.push(due)
    }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ' ORDER BY s.id DESC'
    const rows = db.prepare(sql).all(...params) as SentenceRow[]
    return c.json(rows.map(mapSentence))
  })

  app.post('/api/sentences', async (c) => {
    const body = await c.req.json<{
      jpKana: string
      jpKanji?: string | null
      koText: string
      keywords?: string
      categoryId: number
    }>()
    const jpKana = body.jpKana?.trim()
    const koText = body.koText?.trim()
    if (!jpKana || !koText || !body.categoryId) {
      return c.json({ error: '가나, 한글, 카테고리가 필요합니다.' }, 400)
    }
    const today = todaySeoul(getSettings().timezone)
    const info = db
      .prepare(
        `INSERT INTO sentence (jp_kana, jp_kanji, ko_text, keywords, category_id, created_on)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(jpKana, body.jpKanji?.trim() || null, koText, body.keywords?.trim() ?? '', body.categoryId, today)
    const row = db.prepare(`${sentenceSelect} WHERE s.id = ?`).get(info.lastInsertRowid) as SentenceRow
    return c.json(mapSentence(row), 201)
  })

  app.patch('/api/sentences/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const existing = db.prepare('SELECT * FROM sentence WHERE id = ?').get(id) as SentenceRow | undefined
    if (!existing) return c.json({ error: '없는 문장입니다.' }, 404)
    const body = await c.req.json<{
      jpKana?: string
      jpKanji?: string | null
      koText?: string
      keywords?: string
      categoryId?: number
      selfMark?: 'unset' | 'ok' | 'wrong'
    }>()
    const today = todaySeoul(getSettings().timezone)
    let dueOn = existing.due_on
    let lastReviewed = existing.last_reviewed_on
    let reviewCount = existing.review_count
    if (body.selfMark === 'wrong') {
      dueOn = addDays(today, 1, getSettings().timezone)
      lastReviewed = today
      reviewCount += 1
    }
    if (body.selfMark === 'ok') {
      dueOn = null
      lastReviewed = today
      reviewCount += 1
    }
    db.prepare(
      `UPDATE sentence SET
        jp_kana = ?,
        jp_kanji = ?,
        ko_text = ?,
        keywords = ?,
        category_id = ?,
        self_mark = ?,
        due_on = ?,
        last_reviewed_on = ?,
        review_count = ?
      WHERE id = ?`,
    ).run(
      body.jpKana?.trim() ?? existing.jp_kana,
      body.jpKanji !== undefined ? body.jpKanji?.trim() || null : existing.jp_kanji,
      body.koText?.trim() ?? existing.ko_text,
      body.keywords ?? existing.keywords,
      body.categoryId ?? existing.category_id,
      body.selfMark ?? existing.self_mark,
      dueOn,
      lastReviewed,
      reviewCount,
      id,
    )
    const row = db.prepare(`${sentenceSelect} WHERE s.id = ?`).get(id) as SentenceRow
    return c.json(mapSentence(row))
  })

  app.delete('/api/sentences/:id', (c) => {
    const id = Number(c.req.param('id'))
    db.prepare('DELETE FROM sentence WHERE id = ?').run(id)
    return c.json({ ok: true })
  })

  app.get('/api/search', (c) => {
    const q = c.req.query('q')?.trim() ?? ''
    if (!q) return c.json([])
    const variants = searchVariants(q)
    const clauses: string[] = []
    const params: string[] = []
    for (const v of variants) {
      const like = `%${escapeLike(v)}%`
      clauses.push(`(
        s.ko_text LIKE ? ESCAPE '\\'
        OR s.jp_kana LIKE ? ESCAPE '\\'
        OR IFNULL(s.jp_kanji,'') LIKE ? ESCAPE '\\'
        OR s.keywords LIKE ? ESCAPE '\\'
        OR c.name LIKE ? ESCAPE '\\'
      )`)
      params.push(like, like, like, like, like)
    }
    const rows = db
      .prepare(
        `${sentenceSelect} WHERE ${clauses.join(' OR ')} ORDER BY s.id DESC LIMIT 50`,
      )
      .all(...params) as SentenceRow[]
    return c.json(rows.map(mapSentence))
  })

  app.get('/api/diary/:date', (c) => {
    const date = c.req.param('date')
    const row = db.prepare('SELECT * FROM diary_entry WHERE date = ?').get(date) as
      | {
          id: number
          date: string
          jp_kana: string
          jp_kanji: string | null
          ko_note: string
          correction_json: string | null
        }
      | undefined
    if (!row) {
      return c.json({
        id: 0,
        date,
        jpKana: '',
        jpKanji: null,
        koNote: '',
        correctionJson: null,
      })
    }
    return c.json({
      id: row.id,
      date: row.date,
      jpKana: row.jp_kana,
      jpKanji: row.jp_kanji,
      koNote: row.ko_note,
      correctionJson: row.correction_json,
    })
  })

  app.get('/api/suggest', async (c) => {
    const q = c.req.query('q')?.trim() ?? ''
    if (!q) return c.json({ query: '', primary: '', alternatives: [], source: '' })
    if (c.req.query('kind') === 'sentence') {
      return c.json(await suggestSentence(q))
    }
    return c.json(await suggestMeaning(q))
  })

  app.get('/api/vocab', (c) => {
    const q = c.req.query('q')?.trim() ?? ''
    let sql = 'SELECT * FROM vocab'
    const params: string[] = []
    if (q) {
      sql += ` WHERE surface LIKE ? ESCAPE '\\' OR reading LIKE ? ESCAPE '\\' OR romaji LIKE ? ESCAPE '\\' OR ko_meaning LIKE ? ESCAPE '\\' OR context_ko LIKE ? ESCAPE '\\'`
      const like = `%${escapeLike(q)}%`
      params.push(like, like, like, like, like)
    }
    sql += ' ORDER BY id DESC'
    const rows = db.prepare(sql).all(...params) as VocabRow[]
    return c.json(rows.map(mapVocab))
  })

  app.post('/api/vocab', async (c) => {
    const body = await c.req.json<{
      surface: string
      reading?: string
      romaji: string
      koMeaning?: string
      contextKo?: string
      contextJp?: string
      sourceSentenceId?: number | null
    }>()
    const surface = body.surface?.trim()
    const romaji = body.romaji?.trim()
    if (!surface || !romaji) {
      return c.json({ error: '단어와 로마자가 필요합니다.' }, 400)
    }
    const reading = body.reading?.trim() || surface
    let koMeaning = body.koMeaning?.trim() ?? ''
    if (!koMeaning) {
      const suggested = await suggestMeaning(surface)
      koMeaning = suggested.primary
    }
    const today = todaySeoul(getSettings().timezone)
    const existing = db
      .prepare('SELECT * FROM vocab WHERE surface = ? AND reading = ?')
      .get(surface, reading) as VocabRow | undefined
    if (existing) {
      return c.json({ ...mapVocab(existing), already: true })
    }
    const info = db
      .prepare(
        `INSERT INTO vocab (surface, reading, romaji, ko_meaning, context_ko, context_jp, source_sentence_id, created_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        surface,
        reading,
        romaji,
        koMeaning,
        body.contextKo?.trim() ?? '',
        body.contextJp?.trim() ?? '',
        body.sourceSentenceId ?? null,
        today,
      )
    const row = db.prepare('SELECT * FROM vocab WHERE id = ?').get(info.lastInsertRowid) as VocabRow
    return c.json(mapVocab(row), 201)
  })

  app.patch('/api/vocab/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const existing = db.prepare('SELECT * FROM vocab WHERE id = ?').get(id) as VocabRow | undefined
    if (!existing) return c.json({ error: '없는 단어입니다.' }, 404)
    const body = await c.req.json<{ koMeaning?: string }>()
    db.prepare('UPDATE vocab SET ko_meaning = ? WHERE id = ?').run(
      body.koMeaning?.trim() ?? existing.ko_meaning,
      id,
    )
    const row = db.prepare('SELECT * FROM vocab WHERE id = ?').get(id) as VocabRow
    return c.json(mapVocab(row))
  })

  app.delete('/api/vocab/:id', (c) => {
    const id = Number(c.req.param('id'))
    db.prepare('DELETE FROM vocab WHERE id = ?').run(id)
    return c.json({ ok: true })
  })

  app.put('/api/diary/:date', async (c) => {
    const date = c.req.param('date')
    const body = await c.req.json<{ jpKana?: string; jpKanji?: string | null; koNote?: string }>()
    db.prepare(
      `INSERT INTO diary_entry (date, jp_kana, jp_kanji, ko_note)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         jp_kana = excluded.jp_kana,
         jp_kanji = excluded.jp_kanji,
         ko_note = excluded.ko_note`,
    ).run(date, body.jpKana ?? '', body.jpKanji ?? null, body.koNote ?? '')
    const row = db.prepare('SELECT * FROM diary_entry WHERE date = ?').get(date) as {
      id: number
      date: string
      jp_kana: string
      jp_kanji: string | null
      ko_note: string
      correction_json: string | null
    }
    return c.json({
      id: row.id,
      date: row.date,
      jpKana: row.jp_kana,
      jpKanji: row.jp_kanji,
      koNote: row.ko_note,
      correctionJson: row.correction_json,
    })
  })

  return app
}
