import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const data = JSON.parse(fs.readFileSync('data/public-archive.json', 'utf8'));
if (data.schemaVersion !== 1 || !data.entries.length) throw new Error('Public archive required');
async function main() {
await prisma.tournamentTeam.createMany({ data: data.teams });
await prisma.tournamentMatch.createMany({ data: data.matches });
await prisma.groupTableSnapshot.createMany({ data: data.groupTableRows });
if (data.order) {
  await prisma.officialQualifiedOrder.create({ data: { id: data.order.id, source: 'Preserved public archive', publishedAt: data.order.publishedAt, items: { create: data.order.items } } });
}
for (const [index, entry] of data.entries.entries()) {
  if (!['SUBMITTED','LOCKED'].includes(entry.status)) throw new Error('Non-public entry');
  const { owner, picks, ...fields } = entry;
  await prisma.entry.create({ data: { ...fields, owner: { create: { name: owner.name, email: `archive-${index}@example.invalid` } }, picks: { create: picks } } });
}
}
main().catch(() => { console.error("Public archive seed failed"); process.exitCode=1; }).finally(() => prisma.$disconnect());
