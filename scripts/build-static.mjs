import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const db = path.resolve('prisma/public-build.db');
// This build never accepts a production database or caller-supplied database URL.
const env = { ...process.env, DATABASE_URL: `file:${db}` };
fs.rmSync(db, { force: true });
for (const args of [['prisma','generate'], ['prisma','db','push'], ['tsx','scripts/seed-public.ts'], ['next','build']]) {
  execFileSync('npx', args, { env, stdio: 'inherit' });
}
const archive = JSON.parse(fs.readFileSync('data/public-archive.json', 'utf8'));
for (const entry of archive.entries) {
  if (!/^[a-zA-Z0-9_-]+$/.test(entry.id)) throw new Error('Invalid entry identifier');
  const entryDir = path.join('out','entries',entry.id);
  // Keep previously shared image URLs as actual PNG bytes, not an HTML redirect.
  fs.copyFileSync(path.join(entryDir, 'share-image.png'), path.join(entryDir, 'share-image'));
}
fs.writeFileSync('out/.nojekyll','');
fs.rmSync(db, { force: true });
