import "dotenv/config";

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const prismaDir = path.join(rootDir, "prisma");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl?.startsWith("file:")) {
  throw new Error("DATABASE_URL must be a SQLite file: URL.");
}

const rawPath = databaseUrl.slice("file:".length);
const resolvedDatabasePath = path.isAbsolute(rawPath)
  ? rawPath
  : path.resolve(prismaDir, rawPath);

fs.mkdirSync(path.dirname(resolvedDatabasePath), { recursive: true });

let existingTables = "";

if (fs.existsSync(resolvedDatabasePath)) {
  existingTables = execFileSync(
    "sqlite3",
    [resolvedDatabasePath, "SELECT name FROM sqlite_master WHERE type='table';"],
    {
      cwd: rootDir,
      encoding: "utf8",
    },
  ).trim();
}

if (existingTables) {
  console.log(`Database already initialized at ${resolvedDatabasePath}`);
  process.exit(0);
}

const schemaSql = execFileSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  {
    cwd: rootDir,
    encoding: "utf8",
  },
);

execFileSync("sqlite3", [resolvedDatabasePath], {
  cwd: rootDir,
  input: schemaSql,
  stdio: ["pipe", "inherit", "inherit"],
});

console.log(`Initialized SQLite database at ${resolvedDatabasePath}`);
