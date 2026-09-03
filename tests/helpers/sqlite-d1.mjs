import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

export function createTestDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const directory = new URL("../../drizzle/", import.meta.url);
  for (const name of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(name, directory), "utf8"));
  }
  const queries = [];
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      const wrapper = {
        bind(...input) { values = input; return wrapper; },
        async first() { queries.push(sql); return statement.get(...values) ?? null; },
        async all() { queries.push(sql); return { results: statement.all(...values), success: true }; },
        async run() { queries.push(sql); return { results: [], success: true, meta: statement.run(...values) }; },
      };
      return wrapper;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { db, sqlite, queries };
}

export function seedAccount(sqlite, id, publicCode, nickname = "Тестовый игрок") {
  sqlite.prepare("INSERT INTO users (id, created_at, updated_at) VALUES (?, 1, 1)").run(id);
  sqlite.prepare("INSERT INTO profiles (user_id, public_code, nickname, created_at, updated_at) VALUES (?, ?, ?, 1, 1)").run(id, publicCode, nickname);
  sqlite.prepare("INSERT INTO wallets (user_id, coins, updated_at) VALUES (?, 100, 1)").run(id);
}
