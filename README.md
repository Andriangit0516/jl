# 🎁 Christmas Party Wishlist

A festive little web app for the office Christmas party. Everyone posts what
they'd love as a gift — with a **link**, a **rough price**, and **details** —
and coworkers (or Secret Santa) can **claim** a wish so no gift gets bought
twice. New wishes appear **live** for everyone.

Built with **React + Vite** and a **Supabase** database.

---

## Features

- 📝 Post a wish: your name, the item, a shop link, rough price, priority, details.
- 🎄 Browse everyone's wishlist as festive cards; filter by person; search.
- 🎅 **"I'll gift this"** — claim a wish so others know it's covered (with undo).
- ⚡ **Realtime** — wishes pop in/update/vanish live during the party.
- ❄️ Snow, Christmas colors, and a Google-font holiday headline.
- 🔌 Runs even before Supabase is wired — shows a friendly setup screen.

---

## Quick start

```bash
npm install

# 1) connect your database
cp .env.example .env          # then paste your Supabase URL + anon key
# 2) create the table: open Supabase → SQL Editor → paste sql/schema.sql → Run

npm run dev                   # open the printed localhost URL
```

Build for production:

```bash
npm run build
npm run preview
```

---

## Configuration

Set these in `.env` (never commit it — it's gitignored):

| Variable                 | Where to find it                                   |
| ------------------------ | -------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL    |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/publishable key |

The anon/publishable key is safe in a frontend app. **Never** put the
`service_role` key here.

---

## Database

The full schema is in [`sql/schema.sql`](sql/schema.sql) — one table
(`wishlist_items`), permissive Row-Level-Security policies suited to an
internal trust-based party app, and realtime enabled.

> ⚠️ The RLS policies let anyone with the app read/add/claim/remove wishes.
> That's intentional for an internal party. Tighten them before any public use.

---

## Deploy (optional)

Deploys cleanly to Vercel/Netlify as a static Vite site. Add the two
`VITE_SUPABASE_*` variables in the host's Environment Variables settings, then
build with `npm run build` (output in `dist/`).
