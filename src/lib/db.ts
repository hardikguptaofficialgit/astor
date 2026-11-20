import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  summary?: string | null;
  summary_upto_seq?: number | null;
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

let dbInstance: DatabaseSync | null = null;

function safeAddColumn(db: DatabaseSync, table: string, colDef: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
  } catch {
    // Column already exists or table doesn't support it
  }
}

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'astor.db');
  const db = new DatabaseSync(dbPath);

  // WAL mode for write/read concurrency and foreign keys
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON messages(conversation_id);
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
  `);

  // Migrate additional columns safely
  safeAddColumn(db, 'conversations', 'summary TEXT');
  safeAddColumn(db, 'conversations', 'summary_upto_seq INTEGER');

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

  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_local_date ON messages(local_date);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conv_seq ON messages(conversation_id, seq);');
  } catch {}

  dbInstance = db;
  return db;
}

export function generateTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= 60) {
    return clean || 'New chat';
  }
  return clean.slice(0, 60).trim();
}

export function getAllConversations(): Conversation[] {
  const db = getDb();
  const stmt = db.prepare('SELECT id, title, created_at, updated_at, summary, summary_upto_seq FROM conversations ORDER BY updated_at DESC');
  return stmt.all() as unknown as Conversation[];
}

export function getConversationById(id: string): ConversationWithMessages | null {
  const db = getDb();
  const convStmt = db.prepare('SELECT id, title, created_at, updated_at, summary, summary_upto_seq FROM conversations WHERE id = ?');
  const conv = convStmt.get(id) as unknown as Conversation | undefined;
  if (!conv) {
    return null;
  }

  const msgStmt = db.prepare(
    'SELECT id, conversation_id, role, content, created_at, parts_json, model_text, seq, local_date, mode, finish, tokens_in, tokens_cached, tokens_out, tokens_reasoning, tavily_credits FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  );
  const rawMessages = msgStmt.all(id) as unknown as Message[];

  // Fetch sources for each message
  const sourcesStmt = db.prepare(
    'SELECT n, url, title, domain, snippet, published_date, retrieved_at, score, favicon FROM sources WHERE message_id = ? ORDER BY n ASC'
  );

  const messages: Message[] = rawMessages.map((m) => {
    const sources = sourcesStmt.all(m.id) as unknown as NumberedSource[];
    return {
      ...m,
      sources: sources && sources.length > 0 ? sources : undefined,
    };
  });

  return {
    ...conv,
    messages,
  };
}

export function createConversation(id: string, title: string, createdAt?: string): Conversation {
  const db = getDb();
  const now = createdAt || new Date().toISOString();
  const stmt = db.prepare('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)');
  stmt.run(id, title, now, now);
  return { id, title, created_at: now, updated_at: now };
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
  }
): Message {
  const db = getDb();
  const now = createdAt || new Date().toISOString();

  // Ensure conversation exists; if not, create it with auto-title
  const convStmt = db.prepare('SELECT id FROM conversations WHERE id = ?');
  const existingConv = convStmt.get(conversationId);
  if (!existingConv) {
    createConversation(conversationId, generateTitle(content), now);
  } else {
    const updateStmt = db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?');
    updateStmt.run(now, conversationId);
  }

  const seq = extra?.seq !== undefined ? extra.seq : getNextMessageSeq(conversationId);

  const msgStmt = db.prepare(`
    INSERT OR REPLACE INTO messages (
      id, conversation_id, role, content, created_at,
      parts_json, model_text, seq, local_date, mode, finish,
      tokens_in, tokens_cached, tokens_out, tokens_reasoning, tavily_credits
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  msgStmt.run(
    id,
    conversationId,
    role,
    content,
    now,
    extra?.parts_json ?? null,
    extra?.model_text ?? null,
    seq,
    extra?.local_date ?? null,
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
  return stmt.all(messageId) as unknown as NumberedSource[];
}

export function getSearchCache(key: string): { results_json: string; fetched_at: number; ttl_s: number } | null {
  const db = getDb();
  const stmt = db.prepare('SELECT results_json, fetched_at, ttl_s FROM search_cache WHERE key = ?');
  const row = stmt.get(key) as { results_json: string; fetched_at: number; ttl_s: number } | undefined;
  if (!row) return null;
  return row;
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

export function renameConversation(id: string, title: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?');
  stmt.run(title.trim(), now, id);
  return true;
}

export function deleteConversation(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
  stmt.run(id);
  return true;
}

export function searchConversations(query: string): SearchResult[] {
  const clean = query.trim();
  if (!clean) return [];

  const db = getDb();
  const searchPattern = `%${clean}%`;

  const stmt = db.prepare(`
    SELECT DISTINCT
      c.id,
      c.title,
      c.updated_at,
      (
        SELECT m.content 
        FROM messages m 
        WHERE m.conversation_id = c.id AND m.content LIKE ? 
        ORDER BY m.created_at ASC 
        LIMIT 1
      ) AS snippet
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.title LIKE ? OR m.content LIKE ?
    ORDER BY c.updated_at DESC
    LIMIT 25
  `);

  return stmt.all(searchPattern, searchPattern, searchPattern) as unknown as SearchResult[];
}
