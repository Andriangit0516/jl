import { useEffect, useMemo, useState } from "react";
import { supabase, isConfigured, TABLE } from "./supabaseClient";
import Snow from "./components/Snow.jsx";
import WishForm from "./components/WishForm.jsx";
import WishCard from "./components/WishCard.jsx";
import SetupNotice from "./components/SetupNotice.jsx";
import AuthScreen from "./components/AuthScreen.jsx";

const PRIORITY_ORDER = { "Top pick": 0, "Would love": 1, "Nice to have": 2 };

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isConfigured);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState("Everyone");
  const [toast, setToast] = useState("");

  const me = session?.user?.id || null;
  const myName =
    session?.user?.user_metadata?.display_name ||
    session?.user?.email?.split("@")[0] ||
    "";

  // ── Session ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── Load + live-sync wishes (only once signed in) ───────────────────────────
  useEffect(() => {
    if (!isConfigured || !session) return;
    let active = true;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) setError(error.message);
      else setItems(data || []);
      setLoading(false);
    })();

    const channel = supabase
      .channel("wishlist-live")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
        setItems((prev) => {
          if (payload.eventType === "INSERT") {
            if (prev.some((i) => i.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          }
          if (payload.eventType === "UPDATE")
            return prev.map((i) => (i.id === payload.new.id ? payload.new : i));
          if (payload.eventType === "DELETE")
            return prev.filter((i) => i.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session]);

  const flash = (msg) => {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(""), 2600);
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  async function addWish(wish) {
    // user_id + person_name are stamped server-side by a trigger — we don't send them.
    const { data, error } = await supabase.from(TABLE).insert(wish).select().single();
    if (error) return flash("😬 Couldn't save: " + error.message);
    setItems((prev) => (prev.some((i) => i.id === data.id) ? prev : [data, ...prev]));
    setShowForm(false);
    flash("🎄 Wish added to the tree!");
  }

  async function removeWish(id) {
    if (!window.confirm("Remove this wish for good?")) return;
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== id)); // optimistic
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      setItems(snapshot);
      flash("😬 Couldn't remove: " + error.message);
    } else {
      flash("🗑️ Wish removed.");
    }
  }

  async function toggleClaim(item) {
    const claim = !item.claimed_by;
    const { error } = await supabase.rpc("claim_wish", { p_id: item.id, p_claim: claim });
    if (error) return flash("😬 " + error.message);
    // Optimistic; realtime will confirm for everyone else.
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, claimed_by: claim ? myName : null } : i))
    );
    flash(claim ? "🎁 You're on it! Thanks, Santa." : "↩️ Unclaimed.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setItems([]);
  }

  // ── Derived view ───────────────────────────────────────────────────────────
  const people = useMemo(() => {
    const names = [...new Set(items.map((i) => i.person_name).filter(Boolean))];
    names.sort((a, b) => a.localeCompare(b));
    return ["Everyone", ...names];
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => (person === "Everyone" ? true : i.person_name === person))
      .filter((i) => {
        if (!q) return true;
        return [i.title, i.details, i.person_name]
          .filter(Boolean)
          .some((f) => f.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const p = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        if (p !== 0) return p;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [items, person, search]);

  const stats = useMemo(
    () => ({
      wishes: items.length,
      dreamers: new Set(items.map((i) => i.person_name)).size,
      claimed: items.filter((i) => i.claimed_by).length,
    }),
    [items]
  );

  // ── Gates ────────────────────────────────────────────────────────────────
  if (!isConfigured)
    return (
      <div className="app">
        <Snow />
        <SetupHeader />
        <SetupNotice />
      </div>
    );

  if (!authReady)
    return (
      <div className="app">
        <Snow />
        <div className="empty" style={{ paddingTop: 120 }}>Loading… 🎄</div>
      </div>
    );

  if (!session) return <AuthScreen />;

  // ── Signed-in app ──────────────────────────────────────────────────────────
  return (
    <div className="app">
      <Snow />

      <div className="topbar">
        <span className="topbar-brand">🎄 Wishlist</span>
        <span className="topbar-user">
          🎅 Hi, <b>{myName}</b>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </span>
      </div>

      <header className="hero">
        <div className="hero-glow" />
        <p className="eyebrow">🔔 Brigada Christmas Party</p>
        <h1 className="title">The Wishlist Tree</h1>
        <p className="subtitle">
          Pin what you'd love this Christmas — drop a link, a photo, and the details,
          and let your workmates (and Secret Santa) know exactly what would make you smile. 🎅✨
        </p>

        <div className="stats">
          <span className="stat"><b>{stats.wishes}</b> wishes</span>
          <span className="dot" />
          <span className="stat"><b>{stats.dreamers}</b> dreamers</span>
          <span className="dot" />
          <span className="stat"><b>{stats.claimed}</b> being gifted</span>
        </div>

        <button className="btn btn-primary btn-big" onClick={() => setShowForm(true)}>
          🎁 Add my wish
        </button>
      </header>

      <main className="board">
        <div className="controls">
          <input
            className="search"
            type="search"
            placeholder="🔍 Search wishes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="people">
            {people.map((p) => (
              <button
                key={p}
                className={"chip" + (p === person ? " chip-active" : "")}
                onClick={() => setPerson(p)}
              >
                {p === "Everyone" ? "✨ Everyone" : p}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-banner">⚠️ {error}</div>}

        {loading ? (
          <div className="empty">Loading the wishlist tree… 🎄</div>
        ) : visible.length === 0 ? (
          <div className="empty">
            {items.length === 0 ? (
              <>
                <div className="empty-emoji">🎄</div>
                The tree is bare! Be the first to add a wish.
              </>
            ) : (
              <>No wishes match your search. Try clearing the filters.</>
            )}
          </div>
        ) : (
          <div className="grid">
            {visible.map((item) => (
              <WishCard
                key={item.id}
                item={item}
                me={me}
                myName={myName}
                onDelete={() => removeWish(item.id)}
                onToggleClaim={() => toggleClaim(item)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        Made with 🍪 &amp; ☕ for the office Christmas party · {new Date().getFullYear()}
      </footer>

      {showForm && <WishForm onAdd={addWish} onClose={() => setShowForm(false)} authorName={myName} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function SetupHeader() {
  return (
    <header className="hero">
      <p className="eyebrow">🔔 Brigada Christmas Party</p>
      <h1 className="title">The Wishlist Tree</h1>
    </header>
  );
}
