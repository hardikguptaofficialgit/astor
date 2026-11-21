import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  summary?: string | null;
  summary_upto_seq?: number | null;
  user_id?: string | null;
  pinned_at?: string | null;
}

export interface NumberedSource {
  n: number;
  url: string;
  title: string;
  domain: string;
  snippet?: string | null;
  published_date?: string | null;
  retrieved_at: number;
  score?: number | null;
  favicon?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  text?: string | null;
  created_at: string;
  parts_json?: string | null;
  model_text?: string | null;
  seq?: number | null;
  local_date?: string | null;
  mode?: string | null;
  finish?: string | null;
  tokens_in?: number | null;
  tokens_cached?: number | null;
  tokens_out?: number | null;
  tokens_reasoning?: number | null;
  tavily_credits?: number | null;
  sources?: NumberedSource[];
  feedback?: 'up' | 'down' | null;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface SearchResult {
  id: string;
  title: string;
  snippet?: string | null;
  updated_at: string;
}

export interface MemoryOutboxItem {
  message_id: string;
  payload_json: string;
  attempts: number;
  last_error?: string | null;
  supermemory_id?: string | null;
}

export interface Verification {
  id: string;
  message_id: string;
  verifies_message_id: string;
  verdict: string;
  created_at: number;
}

let dbInstance: DatabaseSync | null = null;

function safeAddColumn(db: DatabaseSync, table: string, colDef: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
  } catch {
    // Column already exists
  }
}

function resolveDbPath(customPath?: string): string {
  if (customPath) return customPath;
  if (process.env.ASTOR_DB_PATH) {
    const envPath = process.env.ASTOR_DB_PATH;
    const envDir = path.dirname(envPath);
    if (!fs.existsSync(envDir)) {
      try {
        fs.mkdirSync(envDir, { recursive: true });
      } catch {
        // ignore or fallback to tmp
      }
    }
    return envPath;
  }

  const standardPath = path.join(path.resolve(process.cwd(), 'data'), 'astor.db');
  const dataDir = path.dirname(standardPath);
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return standardPath;
  } catch {
    // Graceful fallback to tmp directory if process.cwd() is read-only (e.g. Cloud Run, Docker non-root)
    const tmpDir = path.join(os.tmpdir(), 'astor-data');
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch {
        return path.join(os.tmpdir(), 'astor.db');
      }
    }
    return path.join(tmpDir, 'astor.db');
  }
}

export function getDb(customPath?: string): DatabaseSync {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbPath = resolveDbPath(customPath);
  const db = new DatabaseSync(dbPath);

  // WAL mode for write/read concurrency, foreign keys, and busy timeout
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      summary TEXT,
      summary_upto_seq INTEGER,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      seq INTEGER,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      local_date TEXT,
      text TEXT,
      content TEXT NOT NULL,
      model_text TEXT,
      parts_json TEXT,
      mode TEXT,
      finish TEXT,
      tokens_in INTEGER,
      tokens_cached INTEGER,
      tokens_out INTEGER,
      tokens_reasoning INTEGER,
      tavily_credits INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      UNIQUE (conversation_id, seq)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_local_date ON messages(local_date);
    CREATE INDEX IF NOT EXISTS idx_messages_conv_seq ON messages(conversation_id, seq);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

    CREATE TABLE IF NOT EXISTS sources (
      message_id TEXT NOT NULL,
      n INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      domain TEXT NOT NULL,
      snippet TEXT,
      published_date TEXT,
      retrieved_at INTEGER NOT NULL,
      score REAL,
      favicon TEXT,
      PRIMARY KEY (message_id, n),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sources_message ON sources(message_id);

    CREATE TABLE IF NOT EXISTS search_cache (
      key TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      params_json TEXT,
      results_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      ttl_s INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_search_cache_fetched ON search_cache(fetched_at);

    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      verifies_message_id TEXT NOT NULL,
      verdict TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_outbox (
      message_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      supermemory_id TEXT
    );

    CREATE TABLE IF NOT EXISTS user_memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      fact TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_memories_user ON user_memories(user_id);
  `);

  // Migrate existing tables safely
  safeAddColumn(db, 'conversations', 'summary TEXT');
  safeAddColumn(db, 'conversations', 'summary_upto_seq INTEGER');
  safeAddColumn(db, 'conversations', 'user_id TEXT');
  safeAddColumn(db, 'conversations', 'pinned_at TEXT');

  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);');
  } catch {}

  safeAddColumn(db, 'messages', 'parts_json TEXT');
  safeAddColumn(db, 'messages', 'model_text TEXT');
  safeAddColumn(db, 'messages', 'seq INTEGER');
  safeAddColumn(db, 'messages', 'local_date TEXT');
  safeAddColumn(db, 'messages', 'mode TEXT');
  safeAddColumn(db, 'messages', 'finish TEXT');
  safeAddColumn(db, 'messages', 'tokens_in INTEGER');
  safeAddColumn(db, 'messages', 'tokens_cached INTEGER');
  safeAddColumn(db, 'messages', 'tokens_out INTEGER');
  safeAddColumn(db, 'messages', 'tokens_reasoning INTEGER');
  safeAddColumn(db, 'messages', 'tavily_credits INTEGER');
  safeAddColumn(db, 'messages', 'text TEXT');
  safeAddColumn(db, 'messages', 'feedback TEXT');

  // Backfill text <-> content to ensure both are populated
  try {
    db.exec(`UPDATE messages SET text = content WHERE text IS NULL AND content IS NOT NULL;`);
    db.exec(`UPDATE messages SET content = text WHERE content IS NULL AND text IS NOT NULL;`);
  } catch {}

  // Full-text search (FTS5) with triggers
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        text,
        content='messages',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, text) VALUES (new.rowid, coalesce(new.text, new.content));
      END;

      CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, text) VALUES ('delete', old.rowid, coalesce(old.text, old.content));
      END;

      CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, text) VALUES ('delete', old.rowid, coalesce(old.text, old.content));
        INSERT INTO messages_fts(rowid, text) VALUES (new.rowid, coalesce(new.text, new.content));
      END;
    `);

    // Ensure FTS table is populated
    const countRow = db.prepare('SELECT count(*) as count FROM messages_fts').get() as { count?: number };
    const msgCountRow = db.prepare('SELECT count(*) as count FROM messages').get() as { count?: number };
    if ((countRow?.count ?? 0) === 0 && (msgCountRow?.count ?? 0) > 0) {
      db.exec("INSERT INTO messages_fts(messages_fts) VALUES ('rebuild');");
    }
  } catch {
    // FTS5 extension is not available in this SQLite build (e.g. Windows Node 22 node:sqlite).
    // searchMessagesFTS will automatically fall back to deterministic LIKE queries.
  }

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

export function generateTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= 60) {
    return clean || 'New chat';
  }
  return clean.slice(0, 60).trim();
}

function toConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row.id as string,
    title: row.title as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    summary: (row.summary as string | null) ?? null,
    summary_upto_seq: (row.summary_upto_seq as number | null) ?? null,
    user_id: (row.user_id as string | null) ?? null,
    pinned_at: (row.pinned_at as string | null) ?? null,
  };
}

function toSource(row: Record<string, unknown>): NumberedSource {
  return {
    n: row.n as number,
    url: row.url as string,
    title: row.title as string,
    domain: row.domain as string,
    snippet: (row.snippet as string | null) ?? null,
    published_date: (row.published_date as string | null) ?? null,
    retrieved_at: row.retrieved_at as number,
    score: (row.score as number | null) ?? null,
    favicon: (row.favicon as string | null) ?? null,
  };
}

function toMessage(row: Record<string, unknown>, sources?: NumberedSource[]): Message {
  const content = (row.content as string) || (row.text as string) || '';
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    role: row.role as 'user' | 'assistant' | 'system',
    content,
    text: (row.text as string | null) ?? content,
    created_at: row.created_at as string,
    parts_json: (row.parts_json as string | null) ?? null,
    model_text: (row.model_text as string | null) ?? null,
    seq: (row.seq as number | null) ?? null,
    local_date: (row.local_date as string | null) ?? null,
    mode: (row.mode as string | null) ?? null,
    finish: (row.finish as string | null) ?? null,
    tokens_in: (row.tokens_in as number | null) ?? null,
    tokens_cached: (row.tokens_cached as number | null) ?? null,
    tokens_out: (row.tokens_out as number | null) ?? null,
    tokens_reasoning: (row.tokens_reasoning as number | null) ?? null,
    tavily_credits: (row.tavily_credits as number | null) ?? null,
    sources: sources && sources.length > 0 ? sources : undefined,
    feedback: (row.feedback as 'up' | 'down' | null) ?? null,
  };
}

function toSearchResult(row: Record<string, unknown>): SearchResult {
  return {
    id: row.id as string,
    title: row.title as string,
    snippet: (row.snippet as string | null) ?? null,
    updated_at: row.updated_at as string,
  };
}

function toSearchCache(row: Record<string, unknown>): { results_json: string; fetched_at: number; ttl_s: number } {
  return {
    results_json: row.results_json as string,
    fetched_at: row.fetched_at as number,
    ttl_s: row.ttl_s as number,
  };
}

export function getAllConversations(userId?: string | null): Conversation[] {
  const db = getDb();
  if (typeof userId === 'string') {
    const stmt = db.prepare(
      'SELECT id, title, created_at, updated_at, summary, summary_upto_seq, user_id, pinned_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC'
    );
    const rows = stmt.all(userId) as Record<string, unknown>[];
    return rows.map(toConversation);
  }
  if (userId === null) {
    const stmt = db.prepare(
      'SELECT id, title, created_at, updated_at, summary, summary_upto_seq, user_id, pinned_at FROM conversations WHERE user_id IS NULL ORDER BY updated_at DESC'
    );
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(toConversation);
  }
  const stmt = db.prepare(
    'SELECT id, title, created_at, updated_at, summary, summary_upto_seq, user_id, pinned_at FROM conversations ORDER BY updated_at DESC'
  );
  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(toConversation);
}

export function getConversationById(id: string, userId?: string | null): ConversationWithMessages | null {
  const db = getDb();
  let convStmt;
  let rawConv: Record<string, unknown> | undefined;

  if (typeof userId === 'string') {
    convStmt = db.prepare(
      'SELECT id, title, created_at, updated_at, summary, summary_upto_seq, user_id, pinned_at FROM conversations WHERE id = ? AND (user_id = ? OR user_id IS NULL)'
    );
    rawConv = convStmt.get(id, userId) as Record<string, unknown> | undefined;
  } else {
    convStmt = db.prepare(
      'SELECT id, title, created_at, updated_at, summary, summary_upto_seq, user_id, pinned_at FROM conversations WHERE id = ?'
    );
    rawConv = convStmt.get(id) as Record<string, unknown> | undefined;
  }

  if (!rawConv) {
    return null;
  }
  const conv = toConversation(rawConv);

  const msgStmt = db.prepare(
    'SELECT id, conversation_id, role, content, text, created_at, parts_json, model_text, seq, local_date, mode, finish, tokens_in, tokens_cached, tokens_out, tokens_reasoning, tavily_credits, feedback FROM messages WHERE conversation_id = ? ORDER BY seq ASC, created_at ASC'
  );
  const rawMessages = msgStmt.all(id) as Record<string, unknown>[];

  const sourcesStmt = db.prepare(
    'SELECT n, url, title, domain, snippet, published_date, retrieved_at, score, favicon FROM sources WHERE message_id = ? ORDER BY n ASC'
  );

  const messages: Message[] = rawMessages.map((m) => {
    const rawSources = sourcesStmt.all(m.id as string) as Record<string, unknown>[];
    const sources = rawSources.map(toSource);
    return toMessage(m, sources.length > 0 ? sources : undefined);
  });

  return {
    ...conv,
    messages,
  };
}

export function createConversation(
  id: string,
  title: string,
  createdAt?: string,
  userId?: string | null
): Conversation {
  const db = getDb();
  const now = createdAt || new Date().toISOString();
  const uid = userId ?? null;
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO conversations (id, title, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, title, now, now, uid);
  return { id, title, created_at: now, updated_at: now, user_id: uid };
}

export function getNextMessageSeq(conversationId: string): number {
  const db = getDb();
  const stmt = db.prepare('SELECT MAX(seq) as maxSeq FROM messages WHERE conversation_id = ?');
  const row = stmt.get(conversationId) as { maxSeq: number | null } | undefined;
  return (row?.maxSeq ?? -1) + 1;
}

export function saveMessage(
  id: string,
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  createdAt?: string,
  extra?: {
    parts_json?: string;
    model_text?: string;
    seq?: number;
    local_date?: string;
    mode?: string;
    finish?: string;
    tokens_in?: number;
    tokens_cached?: number;
    tokens_out?: number;
    tokens_reasoning?: number;
    tavily_credits?: number;
    text?: string;
    userId?: string | null;
  }
): Message {
  const db = getDb();
  const now = createdAt || new Date().toISOString();

  // Ensure conversation exists; if not, create it with auto-title
  const convStmt = db.prepare('SELECT id FROM conversations WHERE id = ?');
  const existingConv = convStmt.get(conversationId);
  if (!existingConv) {
    createConversation(conversationId, generateTitle(content), now, extra?.userId);
  } else {
    const updateStmt = db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?');
    updateStmt.run(now, conversationId);
  }

  const seq = extra?.seq !== undefined ? extra.seq : getNextMessageSeq(conversationId);
  const text = extra?.text ?? content;

  const msgStmt = db.prepare(`
    INSERT OR REPLACE INTO messages (
      id, conversation_id, seq, role, created_at, local_date,
      text, content, model_text, parts_json, mode, finish,
      tokens_in, tokens_cached, tokens_out, tokens_reasoning, tavily_credits
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  msgStmt.run(
    id,
    conversationId,
    seq,
    role,
    now,
    extra?.local_date ?? null,
    text,
    content,
    extra?.model_text ?? null,
    extra?.parts_json ?? null,
    extra?.mode ?? null,
    extra?.finish ?? null,
    extra?.tokens_in ?? null,
    extra?.tokens_cached ?? null,
    extra?.tokens_out ?? null,
    extra?.tokens_reasoning ?? null,
    extra?.tavily_credits ?? null
  );

  return {
    id,
    conversation_id: conversationId,
    role,
    content,
    text,
    created_at: now,
    seq,
    parts_json: extra?.parts_json,
    model_text: extra?.model_text,
    local_date: extra?.local_date,
    mode: extra?.mode,
    finish: extra?.finish,
    tokens_in: extra?.tokens_in,
    tokens_cached: extra?.tokens_cached,
    tokens_out: extra?.tokens_out,
    tokens_reasoning: extra?.tokens_reasoning,
    tavily_credits: extra?.tavily_credits,
  };
}

export function saveSources(messageId: string, sources: NumberedSource[]): void {
  if (!sources || sources.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sources (
      message_id, n, url, title, domain, snippet, published_date, retrieved_at, score, favicon
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of sources) {
    stmt.run(
      messageId,
      s.n,
      s.url,
      s.title,
      s.domain,
      s.snippet ?? null,
      s.published_date ?? null,
      s.retrieved_at,
      s.score ?? null,
      s.favicon ?? null
    );
  }
}

export function getSourcesByMessageId(messageId: string): NumberedSource[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT n, url, title, domain, snippet, published_date, retrieved_at, score, favicon FROM sources WHERE message_id = ? ORDER BY n ASC'
  );
  const rows = stmt.all(messageId) as Record<string, unknown>[];
  return rows.map(toSource);
}

export function getSearchCache(key: string): { results_json: string; fetched_at: number; ttl_s: number } | null {
  const db = getDb();
  const stmt = db.prepare('SELECT results_json, fetched_at, ttl_s FROM search_cache WHERE key = ?');
  const row = stmt.get(key) as Record<string, unknown> | undefined;
  if (!row) return null;
  return toSearchCache(row);
}

export function setSearchCache(
  key: string,
  query: string,
  paramsJson: string,
  resultsJson: string,
  ttlS: number
): void {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO search_cache (key, query, params_json, results_json, fetched_at, ttl_s)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(key, query, paramsJson, resultsJson, now, ttlS);
}

export function renameConversation(id: string, title: string, userId?: string | null): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  if (typeof userId === 'string') {
    const stmt = db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)');
    stmt.run(title.trim(), now, id, userId);
  } else {
    const stmt = db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?');
    stmt.run(title.trim(), now, id);
  }
  return true;
}

export function deleteConversation(id: string, userId?: string | null): boolean {
  const db = getDb();
  if (typeof userId === 'string') {
    const stmt = db.prepare('DELETE FROM conversations WHERE id = ? AND (user_id = ? OR user_id IS NULL)');
    stmt.run(id, userId);
  } else {
    const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
    stmt.run(id);
  }
  return true;
}

export function searchConversations(query: string, userId?: string | null): SearchResult[] {
  const clean = query.trim();
  if (!clean) return [];

  const db = getDb();
  const searchPattern = `%${clean}%`;

  let sql = `
    SELECT DISTINCT
      c.id,
      c.title,
      c.updated_at,
      (
        SELECT m.content 
        FROM messages m 
        WHERE m.conversation_id = c.id AND (m.content LIKE ? OR m.text LIKE ?) 
        ORDER BY m.created_at ASC 
        LIMIT 1
      ) AS snippet
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE (c.title LIKE ? OR m.content LIKE ? OR m.text LIKE ?)
  `;
  const params: (string | number | bigint | null | Uint8Array)[] = [
    searchPattern,
    searchPattern,
    searchPattern,
    searchPattern,
    searchPattern,
  ];

  if (typeof userId === 'string') {
    sql += ` AND (c.user_id = ? OR c.user_id IS NULL)`;
    params.push(userId);
  } else if (userId === null) {
    sql += ` AND c.user_id IS NULL`;
  }

  sql += ` ORDER BY c.updated_at DESC LIMIT 25`;

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as Record<string, unknown>[];
  return rows.map(toSearchResult);
}

/**
 * Pins or unpins a conversation without modifying its updated_at timestamp.
 */
export function setConversationPinned(
  id: string,
  pinned: boolean,
  userId?: string | null
): boolean {
  const db = getDb();
  let checkStmt;
  if (typeof userId === 'string') {
    checkStmt = db.prepare(
      'SELECT id FROM conversations WHERE id = ? AND (user_id = ? OR user_id IS NULL)'
    );
  } else {
    checkStmt = db.prepare('SELECT id FROM conversations WHERE id = ?');
  }
  const exists =
    typeof userId === 'string' ? checkStmt.get(id, userId) : checkStmt.get(id);
  if (!exists) return false;

  const pinnedAt = pinned ? new Date().toISOString() : null;
  const stmt = db.prepare('UPDATE conversations SET pinned_at = ? WHERE id = ?');
  stmt.run(pinnedAt, id);
  return true;
}

/**
 * Sets message feedback ('up', 'down', or null).
 */
export function setMessageFeedback(
  messageId: string,
  feedback: 'up' | 'down' | null
): boolean {
  const db = getDb();
  const checkStmt = db.prepare('SELECT id FROM messages WHERE id = ?');
  const exists = checkStmt.get(messageId);
  if (!exists) return false;

  const stmt = db.prepare('UPDATE messages SET feedback = ? WHERE id = ?');
  stmt.run(feedback, messageId);
  return true;
}

/**
 * Retrieves a single raw message row by id.
 */
export function getMessageRowById(id: string): Message | null {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, conversation_id, role, content, text, created_at, parts_json, model_text, seq, local_date, mode, finish, tokens_in, tokens_cached, tokens_out, tokens_reasoning, tavily_credits, feedback FROM messages WHERE id = ?'
  );
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return toMessage(row);
}

/**
 * Deletes all messages in a conversation with seq strictly greater than the given seq.
 * Used for regenerate / edit turn cleanup.
 */
export function deleteMessagesAfterSeq(conversationId: string, seq: number): number {
  const db = getDb();
  const countStmt = db.prepare(
    'SELECT count(*) as count FROM messages WHERE conversation_id = ? AND seq > ?'
  );
  const row = countStmt.get(conversationId, seq) as { count?: number };
  const count = row?.count ?? 0;

  const delStmt = db.prepare(
    'DELETE FROM messages WHERE conversation_id = ? AND seq > ?'
  );
  delStmt.run(conversationId, seq);
  return count;
}

// ==============================================================================
// M3 Memory & FTS5 Methods
// ==============================================================================

/**
 * Retrieves messages filtered by local_date range (YYYY-MM-DD IST).
 */
export function getMessagesByDateRange(
  fromDate: string,
  toDate: string,
  role: 'user' | 'assistant' = 'user'
): Message[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, conversation_id, seq, role, created_at, local_date, text, content, model_text, parts_json, mode, finish
    FROM messages
    WHERE local_date >= ? AND local_date <= ? AND role = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(fromDate, toDate, role) as Record<string, unknown>[];
  return rows.map((r) => toMessage(r));
}

/**
 * Searches messages using SQLite FTS5 bm25 ranking.
 */
export function searchMessagesFTS(
  query: string,
  options: {
    from?: string;
    to?: string;
    role?: 'user' | 'assistant';
    limit?: number;
  } = {}
): Array<Message & { rank: number }> {
  const clean = query.replace(/[^\w\s]/g, ' ').trim();
  if (!clean) return [];

  const db = getDb();
  const limit = options.limit || 10;

  // Build FTS5 match expression: e.g. "term1" OR "term2"
  const terms = clean.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const matchExpr = terms.map((t) => `"${t}"`).join(' OR ');

  let sql = `
    SELECT m.id, m.conversation_id, m.seq, m.role, m.created_at, m.local_date, m.text, m.content, m.model_text, m.parts_json, m.mode, m.finish,
           bm25(messages_fts) as rank
    FROM messages_fts
    JOIN messages m ON m.rowid = messages_fts.rowid
    WHERE messages_fts MATCH ?
  `;
  const params: (string | number | bigint | null | Uint8Array)[] = [matchExpr];

  if (options.role) {
    sql += ` AND m.role = ?`;
    params.push(options.role);
  }
  if (options.from) {
    sql += ` AND m.local_date >= ?`;
    params.push(options.from);
  }
  if (options.to) {
    sql += ` AND m.local_date <= ?`;
    params.push(options.to);
  }

  sql += ` ORDER BY rank ASC LIMIT ?`;
  params.push(limit);

  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as (Record<string, unknown> & { rank: number })[];
    return rows.map((r) => ({
      ...toMessage(r),
      rank: Number(r.rank),
    }));
  } catch {
    // Graceful fallback for environments where FTS5 is not compiled (e.g. Windows Node 22 node:sqlite)
    // Deterministic SQLite LIKE search over messages.content and messages.text joined with conversations
    const stopWords = new Set([
      'what', 'did', 'we', 'decide', 'about', 'earlier', 'the', 'a', 'an',
      'in', 'on', 'at', 'to', 'for', 'of', 'and', 'is', 'are', 'was',
      'were', 'i', 'me', 'my', 'you', 'your', 'our', 'it', 'its', 'tell',
      'can', 'please', 'with', 'from', 'as'
    ]);
    const salientTerms = terms.filter((t) => !stopWords.has(t.toLowerCase()) && t.length > 1);
    const searchTerms = salientTerms.length > 0 ? salientTerms : terms;

    const termConditions = searchTerms.map(() => '(m.content LIKE ? OR m.text LIKE ?)');
    const scoreClauses = searchTerms.map(() => '(CASE WHEN m.content LIKE ? OR m.text LIKE ? THEN 1 ELSE 0 END)');

    let fallbackSql = `
      SELECT m.id, m.conversation_id, m.seq, m.role, m.created_at, m.local_date, m.text, m.content, m.model_text, m.parts_json, m.mode, m.finish,
             (${scoreClauses.join(' + ')}) as score
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE (${termConditions.join(' OR ')})
    `;

    const scoreParams = searchTerms.flatMap((t) => [`%${t}%`, `%${t}%`]);
    const conditionParams = searchTerms.flatMap((t) => [`%${t}%`, `%${t}%`]);
    const fallbackParams: (string | number | bigint | null | Uint8Array)[] = [
      ...scoreParams,
      ...conditionParams,
    ];

    if (options.role) {
      fallbackSql += ` AND m.role = ?`;
      fallbackParams.push(options.role);
    }
    if (options.from) {
      fallbackSql += ` AND m.local_date >= ?`;
      fallbackParams.push(options.from);
    }
    if (options.to) {
      fallbackSql += ` AND m.local_date <= ?`;
      fallbackParams.push(options.to);
    }

    fallbackSql += ` ORDER BY score DESC, m.created_at DESC LIMIT ?`;
    fallbackParams.push(limit);

    try {
      const stmt = db.prepare(fallbackSql);
      const rows = stmt.all(...fallbackParams) as (Record<string, unknown> & { score: number })[];
      return rows.map((r) => ({
        ...toMessage(r),
        rank: -Number(r.score || 0),
      }));
    } catch (fallbackErr) {
      console.error('Fallback LIKE search error:', fallbackErr);
      return [];
    }
  }
}

/**
 * Fetches a complete turn (user message + following assistant message + sources + conv title).
 */
export function getTurnContext(userMessageId: string): {
  userMessage: Message;
  assistantMessage?: Message | null;
  sources: NumberedSource[];
  conversationTitle: string;
} | null {
  const db = getDb();
  const userStmt = db.prepare(`
    SELECT m.id, m.conversation_id, m.seq, m.role, m.created_at, m.local_date, m.text, m.content, m.model_text, m.parts_json, m.mode, m.finish,
           c.title as conv_title
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = ?
  `);
  const rawUser = userStmt.get(userMessageId) as (Record<string, unknown> & { conv_title: string }) | undefined;
  if (!rawUser) return null;

  const userMessage = toMessage(rawUser);
  const convTitle = rawUser.conv_title || 'Untitled';

  // Find assistant message for this turn: seq + 1 in the same conversation
  let assistantMessage: Message | null = null;
  const asstStmt = db.prepare(`
    SELECT id, conversation_id, seq, role, created_at, local_date, text, content, model_text, parts_json, mode, finish
    FROM messages
    WHERE conversation_id = ? AND role = 'assistant' AND seq > ?
    ORDER BY seq ASC LIMIT 1
  `);
  const rawAsst = asstStmt.get(userMessage.conversation_id, userMessage.seq ?? -1) as Record<string, unknown> | undefined;

  let sources: NumberedSource[] = [];
  if (rawAsst) {
    const rawSources = getSourcesByMessageId(rawAsst.id as string);
    sources = rawSources;
    assistantMessage = toMessage(rawAsst, sources);
  }

  return {
    userMessage,
    assistantMessage,
    sources,
    conversationTitle: convTitle,
  };
}

// ==============================================================================
// Memory Outbox & Verifications
// ==============================================================================

export function enqueueMemoryOutbox(messageId: string, payload: unknown): void {
  const db = getDb();
  const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO memory_outbox (message_id, payload_json, attempts, last_error, supermemory_id)
    VALUES (?, ?, 0, null, null)
  `);
  stmt.run(messageId, payloadJson);
}

export function getPendingMemoryOutbox(limit = 10): MemoryOutboxItem[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT message_id, payload_json, attempts, last_error, supermemory_id
    FROM memory_outbox
    WHERE supermemory_id IS NULL AND attempts < 5
    ORDER BY attempts ASC
    LIMIT ?
  `);
  const rows = stmt.all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    message_id: r.message_id as string,
    payload_json: r.payload_json as string,
    attempts: Number(r.attempts),
    last_error: (r.last_error as string | null) ?? null,
    supermemory_id: (r.supermemory_id as string | null) ?? null,
  }));
}

export function markMemoryOutboxSuccess(messageId: string, supermemoryId: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE memory_outbox
    SET supermemory_id = ?, last_error = null
    WHERE message_id = ?
  `);
  stmt.run(supermemoryId, messageId);
}

export function markMemoryOutboxFailure(messageId: string, error: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE memory_outbox
    SET attempts = attempts + 1, last_error = ?
    WHERE message_id = ?
  `);
  stmt.run(error, messageId);
}

export function saveVerification(
  id: string,
  messageId: string,
  verifiesMessageId: string,
  verdict: string,
  createdAt?: number
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO verifications (id, message_id, verifies_message_id, verdict, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, messageId, verifiesMessageId, verdict, createdAt || Date.now());
}

export function getVerification(messageId: string): Verification | null {
  const db = getDb();
  const stmt = db.prepare('SELECT id, message_id, verifies_message_id, verdict, created_at FROM verifications WHERE message_id = ?');
  const row = stmt.get(messageId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    message_id: row.message_id as string,
    verifies_message_id: row.verifies_message_id as string,
    verdict: row.verdict as string,
    created_at: Number(row.created_at),
  };
}

export interface UserMemoryItem {
  id: string;
  user_id: string;
  fact: string;
  category?: string;
  created_at: number;
  updated_at: number;
}

export function getUserMemories(userId: string): UserMemoryItem[] {
  if (!userId) return [];
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, user_id, fact, category, created_at, updated_at FROM user_memories WHERE user_id = ? ORDER BY created_at DESC'
  );
  const rows = stmt.all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    user_id: r.user_id as string,
    fact: r.fact as string,
    category: (r.category as string) || 'general',
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at),
  }));
}

export function saveUserMemory(
  id: string,
  userId: string,
  fact: string,
  category = 'general'
): UserMemoryItem {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO user_memories (id, user_id, fact, category, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, fact = excluded.fact, category = excluded.category, updated_at = excluded.updated_at
  `);
  stmt.run(id, userId, fact, category, now, now);
  return {
    id,
    user_id: userId,
    fact,
    category,
    created_at: now,
    updated_at: now,
  };
}

export function deleteUserMemory(id: string, userId: string): boolean {
  if (!id || !userId) return false;
  const db = getDb();
  const stmt = db.prepare('DELETE FROM user_memories WHERE id = ? AND user_id = ?');
  stmt.run(id, userId);
  return true;
}

export function clearUserMemories(userId: string): boolean {
  if (!userId) return false;
  const db = getDb();
  const stmt = db.prepare('DELETE FROM user_memories WHERE user_id = ?');
  stmt.run(userId);
  return true;
}
