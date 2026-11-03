// Shown only when Supabase isn't configured yet, so the app never crashes on
// a fresh clone. Once .env has real values and the dev server restarts, the
// main board replaces this automatically.
export default function SetupNotice() {
  return (
    <main className="board">
      <div className="setup">
        <div className="setup-emoji">🎄🔌</div>
        <h2>Almost ready — connect Supabase</h2>
        <p>The wishlist needs a database so everyone's wishes are shared. Two quick steps:</p>
        <ol>
          <li>
            Copy <code>.env.example</code> to <code>.env</code> and paste your
            project's <b>URL</b> and <b>anon key</b>
            (<i>Supabase → Project Settings → API</i>).
          </li>
          <li>
            Open <b>Supabase → SQL Editor</b>, paste the contents of
            <code>sql/schema.sql</code>, and click <b>Run</b>.
          </li>
        </ol>
        <p className="setup-last">Then restart <code>npm run dev</code> — and the tree lights up. ✨</p>
      </div>
    </main>
  );
}
