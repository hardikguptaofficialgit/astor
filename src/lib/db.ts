import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
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
  `);

  dbInstance = db;
  return db;
}

/**
 * Auto-title a conversation from the first user message, stored up to ~60 chars with no ellipsis.
 * CSS handles truncation/ellipsis at display time.
 */
export function generateTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= 60) {
    return clean || 'New chat';
  }
  return clean.slice(0, 60).trim();
}

export function getAllConversations(): Conversation[] {
  const db = getDb();
  const stmt = db.prepare('SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC');
  return stmt.all() as unknown as Conversation[];
}

export function getConversationById(id: string): ConversationWithMessages | null {
  const db = getDb();
  const convStmt = db.prepare('SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?');
  const conv = convStmt.get(id) as unknown as Conversation | undefined;
  if (!conv) {
    return null;
  }

  const msgStmt = db.prepare('SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC');
  const messages = msgStmt.all(id) as unknown as Message[];

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

export function saveMessage(
  id: string,
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  createdAt?: string
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

  // Insert or replace message
  const msgStmt = db.prepare(
    'INSERT OR REPLACE INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  msgStmt.run(id, conversationId, role, content, now);

  return {
    id,
    conversation_id: conversationId,
    role,
    content,
    created_at: now,
  };
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

/**
 * Search conversation titles and message content using SQLite LIKE.
 */
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
