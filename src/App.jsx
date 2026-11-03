import { useEffect, useMemo, useState } from "react";
import { supabase, isConfigured, TABLE } from "./supabaseClient";
import Snow from "./components/Snow.jsx";
import WishForm from "./components/WishForm.jsx";
import PersonCard from "./components/PersonCard.jsx";
import PersonModal from "./components/PersonModal.jsx";
import SetupNotice from "./components/SetupNotice.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import ProfileModal from "./components/ProfileModal.jsx";

const PRIORITY_ORDER = { "Top pick": 0, "Would love": 1, "Nice to have": 2 };

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isConfigured);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // item being edited, or null
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null); // open person's wishlist
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

  async function updateWish(id, patch) {
    // Only the owner's editable fields — user_id/person_name stay as-is (RLS enforces ownership).
    const { data, error } = await supabase.from(TABLE).update(patch).eq("id", id).select().single();
    if (error) return flash("😬 Couldn't update: " + error.message);
    setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
    setEditing(null);
    flash("✨ Wish updated!");
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

  // Edit the signed-in user's display name — syncs profile, account metadata,
  // and the name on all their existing wishes. Returns { error? }.
  async function saveProfileName(name) {
    const { error: pErr } = await supabase
      .from("profiles")
      .upsert({ id: me, display_name: name });
    if (pErr) return { error: pErr.message };

    const { error: uErr } = await supabase.auth.updateUser({ data: { display_name: name } });
    if (uErr) return { error: uErr.message };

    const { error: wErr } = await supabase
      .from(TABLE)
      .update({ person_name: name })
      .eq("user_id", me);
    if (wErr) return { error: wErr.message };

    setItems((prev) => prev.map((i) => (i.user_id === me ? { ...i, person_name: name } : i)));
    flash("✨ Name updated!");
    return {};
  }

  // ── Derived view — one group per person ─────────────────────────────────────
  const sortWishes = (ws) =>
    [...ws].sort((a, b) => {
      const p = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      if (p !== 0) return p;
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const groups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = it.user_id || "name:" + (it.person_name || "");
      if (!map.has(key))
        map.set(key, { key, userId: it.user_id || null, name: it.person_name || "Someone", wishes: [] });
      map.get(key).wishes.push(it);
    }
    const arr = [...map.values()].map((g) => ({
      ...g,
      wishes: sortWishes(g.wishes),
      claimedCount: g.wishes.filter((w) => w.claimed_by).length,
    }));
    arr.sort((a, b) => {
      if (a.userId === me && b.userId !== me) return -1;
      if (b.userId === me && a.userId !== me) return 1;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [items, me]);

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.wishes.some((w) =>
          [w.title, w.details].filter(Boolean).some((f) => f.toLowerCase().includes(q))
        )
    );
  }, [groups, search]);

  // Keep the open person's wishlist live (reflects edits/claims/deletes).
  const selectedGroup = useMemo(
    () => groups.find((g) => g.key === selectedKey) || null,
    [groups, selectedKey]
  );

  const stats = useMemo(
    () => ({
      wishes: items.length,
      dreamers: new Set(items.map((i) => i.person_name)).size,
      claimed: items.filter((i) => i.claimed_by).length,
    }),
    [items]
  );

  const myWishCount = useMemo(
    () => items.filter((i) => i.user_id && me && i.user_id === me).length,
    [items, me]
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
          <button className="btn btn-ghost btn-sm" onClick={() => setShowProfile(true)}>✏️ Edit name</button>
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

        <p className="nudge">
          {myWishCount === 0
            ? "🎯 Add at least 3 wishes so Santa has options!"
            : myWishCount < 3
            ? `🎯 You've added ${myWishCount} ${myWishCount === 1 ? "wish" : "wishes"} — aim for at least 3!`
            : `🌟 ${myWishCount} wishes added — you're all set! Add or edit anytime.`}
        </p>
      </header>

      <main className="board">
        <div className="controls">
          <input
            className="search"
            type="search"
            placeholder="🔍 Search people or wishes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <div className="error-banner">⚠️ {error}</div>}

        {loading ? (
          <div className="empty">Loading the wishlist tree… 🎄</div>
        ) : visibleGroups.length === 0 ? (
          <div className="empty">
            {items.length === 0 ? (
              <>
                <div className="empty-emoji">🎄</div>
                The tree is bare! Be the first to add a wish.
              </>
            ) : (
              <>No one matches your search. Try clearing it.</>
            )}
          </div>
        ) : (
          <div className="grid">
            {visibleGroups.map((g) => (
              <PersonCard
                key={g.key}
                group={g}
                isMe={g.userId === me}
                onOpen={() => setSelectedKey(g.key)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        Made with 🍪 &amp; ☕ for the office Christmas party · {new Date().getFullYear()}
      </footer>

      {showForm && (
        <WishForm onSubmit={addWish} onClose={() => setShowForm(false)} authorName={myName} />
      )}
      {editing && (
        <WishForm
          editing={editing}
          onSubmit={(patch) => updateWish(editing.id, patch)}
          onClose={() => setEditing(null)}
          authorName={myName}
        />
      )}
      {showProfile && (
        <ProfileModal
          currentName={myName}
          onSave={saveProfileName}
          onClose={() => setShowProfile(false)}
        />
      )}
      {selectedGroup && (
        <PersonModal
          group={selectedGroup}
          me={me}
          myName={myName}
          onEdit={(item) => setEditing(item)}
          onDelete={(id) => removeWish(id)}
          onToggleClaim={(item) => toggleClaim(item)}
          onClose={() => setSelectedKey(null)}
        />
      )}
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
