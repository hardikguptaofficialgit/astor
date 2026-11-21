import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { getDbName } from './config';

export interface UserDocument {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash?: string;
  googleId?: string;
  avatarUrl?: string;
  profession?: string;
  primaryGoals?: string[];
  customInstructions?: string;
  onboardingCompleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMemoryDocument {
  _id: ObjectId;
  userId: string;
  fact: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument {
  _id: ObjectId;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoIndexesPromise: Promise<void> | undefined;
}

const mongoOptions = {
  maxPoolSize: 20,
  minPoolSize: 2,
  maxIdleTimeMS: 60000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
};

export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined');
  }

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, mongoOptions);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, mongoOptions);
    global._mongoClientPromise = client.connect();
  }
  return global._mongoClientPromise;
}

async function ensureIndexes(db: Db): Promise<void> {
  if (!global._mongoIndexesPromise) {
    global._mongoIndexesPromise = (async () => {
      try {
        await Promise.all([
          db.collection<UserDocument>('users').createIndex({ email: 1 }, { unique: true }),
          db.collection<SessionDocument>('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
          db.collection<SessionDocument>('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
          db.collection<UserMemoryDocument>('user_memories').createIndex({ userId: 1 }),
        ]);
      } catch (err) {
        global._mongoIndexesPromise = undefined;
        throw err;
      }
    })();
  }
  return global._mongoIndexesPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  await ensureIndexes(db);
  return db;
}

export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const db = await getDb();
  return db.collection<UserDocument>('users');
}

export async function getSessionsCollection(): Promise<Collection<SessionDocument>> {
  const db = await getDb();
  return db.collection<SessionDocument>('sessions');
}

export async function getUserMemoriesCollection(): Promise<Collection<UserMemoryDocument>> {
  const db = await getDb();
  return db.collection<UserMemoryDocument>('user_memories');
}
