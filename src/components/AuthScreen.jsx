import { useState } from "react";
import { supabase } from "../supabaseClient";
import Snow from "./Snow.jsx";

export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const isSignup = mode === "signup";

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      if (isSignup) {
        const displayName = name.trim();
        if (!displayName) throw new Error("Please enter your name.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
        // With email confirmation OFF, signUp returns a session → App logs in.
        // If no session came back, try an immediate sign-in: it succeeds when
        // confirmation is off, and only fails (needs email) when it's on.
        if (!data.session) {
          const { error: siErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (siErr) {
            setNotice("Account created! Check your email to confirm, then sign in. 📧");
            setMode("signin");
          }
          // on success, onAuthStateChange in App takes over automatically.
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (e2) {
      setErr(e2.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <Snow />
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="modal-ribbon" />
          <div className="auth-emoji">🎄🎁</div>
          <h1 className="auth-title">Christmas Wishlist</h1>
          <p className="auth-sub">
            {isSignup
              ? "Create your account so your wishes are truly yours."
              : "Welcome back — sign in to see the wishlist tree."}
          </p>

          <form onSubmit={submit} className="form">
            {isSignup && (
              <label className="field">
                <span>Your name <i>*</i></span>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Andrian Dayag" maxLength={60} autoComplete="name" required />
              </label>
            )}
            <label className="field">
              <span>Email <i>*</i></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com" autoComplete="email" required />
            </label>
            <label className="field">
              <span>Password <i>*</i></span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? "At least 6 characters" : "Your password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={6} required />
            </label>

            {err && <div className="auth-err">⚠️ {err}</div>}
            {notice && <div className="auth-notice">✅ {notice}</div>}

            <button type="submit" className="btn btn-primary btn-big auth-submit" disabled={busy}>
              {busy ? "Please wait…" : isSignup ? "🎅 Create account" : "🔑 Sign in"}
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => { setMode(isSignup ? "signin" : "signup"); setErr(""); setNotice(""); }}
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
