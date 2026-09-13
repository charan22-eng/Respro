import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  
  const dbPath = path.join(process.cwd(), 'respro.db');
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable WAL mode for better concurrency
  await dbInstance.exec('PRAGMA journal_mode = WAL;');

  // Create core tables for KV storage
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contributors (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      repo_id TEXT NOT NULL,
      text TEXT NOT NULL,
      vector_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS file_embeddings (
      id TEXT PRIMARY KEY,
      repo_id TEXT NOT NULL,
      filepath TEXT NOT NULL,
      content TEXT NOT NULL,
      vector_json TEXT NOT NULL
    );
  `);

  return dbInstance;
}
