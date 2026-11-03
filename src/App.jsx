import { useEffect, useMemo, useState } from "react";
import { supabase, isConfigured, TABLE } from "./supabaseClient";
import Snow from "./components/Snow.jsx";
import WishForm from "./components/WishForm.jsx";
import PersonCard from "./components/PersonCard.jsx";
import PersonModal from "./components/PersonModal.jsx";
import SetupNotice from "./components/SetupNotice.jsx";
import AuthModal from "./components/AuthModal.jsx";
import ProfileModal from "./components/ProfileModal.jsx";

const PRIORITY_ORDER = { "Top pick": 0, "Would love": 1, "Nice to have": 2 };

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isConfigured);

  const [items, setItems] = useState([]);
  const [myClaims, setMyClaims] = useState(() => new Set()); // wish_ids I'm secretly gifting
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // item being edited, or null
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null); // open person's wishlist
  const [authPrompt, setAuthPrompt] = useState(null); // { intent: 'add' | 'claim', item? } | null
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

  // ── Load + live-sync wishes (PUBLIC — works signed in or out) ───────────────
  useEffect(() => {
    if (!isConfigured) return;
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
  }, []);

  // ── My secret claims — loaded only when signed in ───────────────────────────
  useEffect(() => {
    if (!isConfigured || !session) {
      setMyClaims(new Set());
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase.from("wish_claims").select("wish_id"); // RLS → only mine
      if (active) setMyClaims(new Set((data || []).map((c) => c.wish_id)));
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const flash = (msg) => {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(""), 2600);
  };

  // Gate an action behind sign-in. Returns true if already signed in; otherwise
  // opens the auth modal and remembers the intent to resume after login.
  function requireAuth(prompt) {
    if (session) return true;
    setAuthPrompt(prompt);
    return false;
  }

  // Resume the pending action once the visitor signs in.
  useEffect(() => {
    if (!session || !authPrompt) return;
    const p = authPrompt;
    setAuthPrompt(null);
    if (p.intent === "add") setShowForm(true);
    else if (p.intent === "claim" && p.item) toggleClaim(p.item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, authPrompt]);

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
    if (!requireAuth({ intent: "claim", item })) return;
    const mineNow = myClaims.has(item.id);
    const setClaimed = (v) =>
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_claimed: v } : i)));

    if (mineNow) {
      // Un-reserve — optimistic.
      setMyClaims((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
      setClaimed(false);
      const { error } = await supabase.from("wish_claims").delete().eq("wish_id", item.id);
      if (error) {
        setMyClaims((prev) => new Set(prev).add(item.id));
        setClaimed(true);
        flash("😬 " + error.message);
      } else flash("↩️ Unclaimed.");
    } else {
      // Reserve it (secretly). The table's PK means only one gifter per wish.
      const { error } = await supabase.from("wish_claims").insert({ wish_id: item.id });
      if (error) {
        if (error.code === "23505" || /duplicate|unique/i.test(error.message))
          flash("🎁 Someone already reserved this one.");
        else flash("😬 " + error.message);
      } else {
        setMyClaims((prev) => new Set(prev).add(item.id));
        setClaimed(true);
        flash("🎁 You're on it — it's a secret! 🤫");
      }
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setItems([]);
    setMyClaims(new Set());
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
      claimedCount: g.wishes.filter((w) => w.is_claimed).length,
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
      claimed: items.filter((i) => i.is_claimed).length,
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

  // ── Public app (board visible to everyone; sign-in only to add/claim) ────────
  return (
    <div className="app">
      <Snow />

      <div className="topbar">
        <span className="topbar-brand">🎄 Wishlist</span>
        {session ? (
          <span className="topbar-user">
            🎅 Hi, <b>{myName}</b>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowProfile(true)}>✏️ Edit name</button>
            <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
          </span>
        ) : (
          <span className="topbar-user">
            <button className="btn btn-primary btn-sm" onClick={() => setAuthPrompt({ intent: "signin" })}>
              🔑 Sign in
            </button>
          </span>
        )}
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

        <button
          className="btn btn-primary btn-big"
          onClick={() => { if (requireAuth({ intent: "add" })) setShowForm(true); }}
        >
          🎁 Add my wish
        </button>

        <p className="nudge">
          {!session
            ? "👀 Browsing as a guest — sign in to add your own wishes."
            : myWishCount === 0
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
      {authPrompt && (
        <AuthModal
          reason={
            authPrompt.intent === "claim"
              ? "Sign in to secretly gift this wish 🎁"
              : authPrompt.intent === "add"
              ? "Sign in to add your wish 🎄"
              : ""
          }
          onClose={() => setAuthPrompt(null)}
        />
      )}
      {selectedGroup && (
        <PersonModal
          group={selectedGroup}
          me={me}
          myClaims={myClaims}
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
