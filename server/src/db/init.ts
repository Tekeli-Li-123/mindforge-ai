import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "..", "data", "mindforge.db");

export function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function initDatabase(): void {
  const db = getDb();
  const schemaPath = join(__dirname, "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  console.log(`✅ Database initialized at ${DB_PATH}`);
  db.close();
}

// Run directly
if (process.argv[1]?.endsWith("init.ts") || process.argv[1]?.endsWith("init.js")) {
  initDatabase();
}
