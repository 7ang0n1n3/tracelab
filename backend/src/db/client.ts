import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "tracelab.db");

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

export default db;
