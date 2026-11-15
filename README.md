# Scottie’s World Cup Pool archive

A static archive of the 2026 pool, published at https://worldcup.michaelsparre.com.

`data/public-archive.json` contains only public tournament results and submitted
entries. Accounts, credentials, payment details, drafts, and admin notes are
not part of this repository. The original database is retained privately.

Run `npm ci` and `npm run build`. The build creates a disposable database from
the public JSON, exports Next.js pages and share images into `out/`, then removes
the disposable database. No database or runtime server is deployed.

GitHub Pages publishes pushes to `main`.
