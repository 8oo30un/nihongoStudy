import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Client, InValue } from '@libsql/client'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'data')
const dbPath = path.join(dataDir, 'nihongo.db')

function databaseUrl() {
  const remote = process.env.TURSO_DATABASE_URL?.trim()
  if (remote) return remote
  if (process.env.VERCEL) {
    throw new Error('Vercel 배포에는 TURSO_DATABASE_URL 이 필요합니다.')
  }
  fs.mkdirSync(dataDir, { recursive: true })
  return `file://${dbPath}`
}

let clientPromise: Promise<Client> | null = null
let ready: Promise<void> | null = null

function getClient() {
  clientPromise ??= (async () => {
    const url = databaseUrl()
    if (url.startsWith('file:')) {
      const { createClient } = await import('@libsql/client')
      return createClient({ url })
    }
    const { createClient } = await import('@libsql/client/web')
    return createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  })()
  return clientPromise
}

function asArgs(params: unknown[]): InValue[] {
  return params.map((value) => (value === undefined ? null : (value as InValue)))
}

function toPlain(row: unknown) {
  if (!row || typeof row !== 'object') return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (/^\d+$/.test(key)) continue
    out[key] = typeof value === 'bigint' ? Number(value) : value
  }
  return out
}

export const db = {
  async exec(sql: string) {
    await (await getClient()).execute(sql)
  },
  prepare(sql: string) {
    return {
      async get(...params: unknown[]) {
        const result = await (await getClient()).execute({ sql, args: asArgs(params) })
        return toPlain(result.rows[0])
      },
      async all(...params: unknown[]) {
        const result = await (await getClient()).execute({ sql, args: asArgs(params) })
        return Array.from(result.rows, (row) => toPlain(row)!)
      },
      async run(...params: unknown[]) {
        const result = await (await getClient()).execute({ sql, args: asArgs(params) })
        return { lastInsertRowid: Number(result.lastInsertRowid ?? 0), changes: Number(result.rowsAffected ?? 0) }
      },
    }
  },
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sentence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jp_kana TEXT NOT NULL,
  jp_kanji TEXT,
  ko_text TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',
  category_id INTEGER NOT NULL REFERENCES category(id),
  created_on TEXT NOT NULL,
  self_mark TEXT NOT NULL DEFAULT 'unset',
  due_on TEXT,
  last_reviewed_on TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS diary_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  jp_kana TEXT NOT NULL DEFAULT '',
  jp_kanji TEXT,
  ko_note TEXT NOT NULL DEFAULT '',
  correction_json TEXT
);

CREATE TABLE IF NOT EXISTS setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vocab (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surface TEXT NOT NULL,
  reading TEXT NOT NULL,
  romaji TEXT NOT NULL,
  ko_meaning TEXT NOT NULL DEFAULT '',
  context_ko TEXT NOT NULL DEFAULT '',
  context_jp TEXT NOT NULL DEFAULT '',
  source_sentence_id INTEGER,
  created_on TEXT NOT NULL,
  miss_count INTEGER NOT NULL DEFAULT 0,
  due_on TEXT,
  last_reviewed_on TEXT,
  UNIQUE(surface, reading)
);

CREATE TABLE IF NOT EXISTS meaning_cache (
  query TEXT PRIMARY KEY,
  ko_meaning TEXT NOT NULL,
  source TEXT NOT NULL
);
`

const CATEGORY_SEED = [
  ['일상', 'daily', '☕️', 1],
  ['사교', 'social', '👋', 2],
  ['연애', 'romance', '♡', 3],
  ['교통', 'transit', '🚃', 4],
  ['공항·입국', 'airport', '✈️', 5],
  ['숙소', 'stay', '🏠', 6],
  ['쇼핑', 'shopping', '🛍️', 7],
  ['음식점', 'food', '🍜', 8],
  ['회사', 'work', '🏢', 9],
  ['아르바이트', 'job', '💼', 10],
  ['관공서·비자', 'city-hall', '📋', 11],
  ['은행·세금', 'bank', '💴', 12],
  ['병원·약국', 'hospital', '🏥', 13],
  ['긴급', 'emergency', '🆘', 14],
] as const

async function tableColumns(table: string) {
  const rows = (await db.prepare(`PRAGMA table_info(${table})`).all()) as { name: string }[]
  return rows.map((row) => row.name)
}

async function ensureColumn(table: string, name: string, definition: string) {
  const columns = await tableColumns(table)
  if (columns.includes(name)) return
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
}

async function initSchema() {
  for (const statement of SCHEMA.split(';').map((part) => part.trim()).filter(Boolean)) {
    await db.exec(`${statement};`)
  }
  await ensureColumn('sentence', 'miss_count', 'INTEGER NOT NULL DEFAULT 0')
  await ensureColumn('vocab', 'miss_count', 'INTEGER NOT NULL DEFAULT 0')
  await ensureColumn('vocab', 'due_on', 'TEXT')
  await ensureColumn('vocab', 'last_reviewed_on', 'TEXT')

  const categoryCount = (await db.prepare('SELECT COUNT(*) AS n FROM category').get()) as { n: number } | undefined
  if (Number(categoryCount?.n ?? 0) === 0) {
    for (const [name, slug, emoji, order] of CATEGORY_SEED) {
      await db.prepare('INSERT INTO category (name, slug, emoji, sort_order) VALUES (?, ?, ?, ?)').run(
        name,
        slug,
        emoji,
        order,
      )
    }
  }

  const settingCount = (await db.prepare('SELECT COUNT(*) AS n FROM setting').get()) as { n: number } | undefined
  if (Number(settingCount?.n ?? 0) === 0) {
    await db.prepare('INSERT INTO setting (key, value) VALUES (?, ?)').run('dailySentenceGoal', '5')
    await db.prepare('INSERT INTO setting (key, value) VALUES (?, ?)').run('ttsEngine', 'web-speech')
    await db.prepare('INSERT INTO setting (key, value) VALUES (?, ?)').run('timezone', 'Asia/Seoul')
  }

  const demoCleared = (await db.prepare('SELECT value FROM setting WHERE key = ?').get('demoCleared')) as
    | { value: string }
    | undefined
  if (!demoCleared) {
    await db.exec('DELETE FROM sentence')
    await db.exec('DELETE FROM diary_entry')
    await db
      .prepare(
        'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run('demoCleared', '1')
  }
}

export function ensureReady() {
  ready ??= initSchema()
  return ready
}

export type SentenceRow = {
  id: number
  jp_kana: string
  jp_kanji: string | null
  ko_text: string
  keywords: string
  category_id: number
  created_on: string
  self_mark: 'unset' | 'ok' | 'wrong'
  due_on: string | null
  last_reviewed_on: string | null
  review_count: number
  miss_count: number
  category_name?: string
  category_emoji?: string
}

export function mapSentence(row: SentenceRow) {
  return {
    id: row.id,
    jpKana: row.jp_kana,
    jpKanji: row.jp_kanji,
    koText: row.ko_text,
    keywords: row.keywords,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryEmoji: row.category_emoji,
    createdOn: row.created_on,
    selfMark: row.self_mark,
    dueOn: row.due_on,
    lastReviewedOn: row.last_reviewed_on,
    reviewCount: row.review_count,
    missCount: row.miss_count ?? 0,
  }
}

export type VocabRow = {
  id: number
  surface: string
  reading: string
  romaji: string
  ko_meaning: string
  context_ko: string
  context_jp: string
  source_sentence_id: number | null
  created_on: string
  miss_count: number
  due_on: string | null
  last_reviewed_on: string | null
}

export function mapVocab(row: VocabRow) {
  return {
    id: row.id,
    surface: row.surface,
    reading: row.reading,
    romaji: row.romaji,
    koMeaning: row.ko_meaning,
    contextKo: row.context_ko,
    contextJp: row.context_jp,
    sourceSentenceId: row.source_sentence_id,
    createdOn: row.created_on,
    missCount: row.miss_count ?? 0,
    dueOn: row.due_on ?? null,
    lastReviewedOn: row.last_reviewed_on ?? null,
  }
}
