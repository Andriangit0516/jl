# 🎁 Christmas Party Wishlist

A festive little web app for the office Christmas party. Everyone **creates an
account**, then posts what they'd love as a gift — with a **link**, a **photo or
screenshot**, and **details** — and coworkers (or Secret Santa) can **claim** a
wish so no gift gets bought twice. New wishes appear **live** for everyone.

Built with **React + Vite** and **Supabase** (database + auth).

---

## Features

- 🔐 **Accounts** — sign up with your name, email & password. Your name comes from
  your account, so **nobody can post fake wishes under someone else's name**, and
  you can only edit/remove **your own** wishes.
- 📝 Post a wish: the item, a shop link, a **photo/screenshot**, priority, details.
- 📸 **Add a photo** by uploading, dragging in, or **pasting a screenshot** (Ctrl/⌘+V).
- 🎄 Browse everyone's wishlist as festive cards; filter by person; search.
- 🎅 **"I'll gift this"** — reserve a wish **anonymously** (Secret-Santa safe).
  Others just see it's reserved so no one double-buys; the gifter's identity is
  never shown — not even to the wisher, who can't see which of their wishes are
  taken. Claims are stored in a separate table only the claimer can read.
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

## Database & accounts

The full schema is in [`sql/schema.sql`](sql/schema.sql):

- **`profiles`** — one row per account (display name), auto-created on signup.
- **`wishlist_items`** — each wish, bound to its owner via `user_id`.
- **Row-Level Security** — everyone signed in can *read* all wishes; you can only
  *add/edit/remove your own*. Owner + name are stamped **server-side** by a trigger,
  so a user can't post under another person's name.
- **`claim_wish()`** — lets any signed-in user claim/unclaim a wish (a gift pledge)
  without being able to edit the wish itself.

### Auth setup (one time, in Supabase)

1. Run `sql/schema.sql` in the **SQL Editor**.
2. **Authentication → Providers → Email** is on by default.
   - For a smooth party sign-up, consider turning **"Confirm email" off**
     (Authentication → Providers → Email) so people can sign in immediately.
     If you leave it on, users must click the email link before their first sign-in
     (the app shows a "check your email" message).

---

## Deploy (optional)

Deploys cleanly to Vercel/Netlify as a static Vite site. Add the two
`VITE_SUPABASE_*` variables in the host's Environment Variables settings, then
build with `npm run build` (output in `dist/`).
