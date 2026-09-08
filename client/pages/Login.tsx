import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { AuthResponse } from "@shared/api";
import { useAuth } from "@/hooks/useAuth";
import { safeInternalPath } from "@/lib/navigation";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateDestination = (location.state as { from?: string } | null)?.from;
  const queryDestination = new URLSearchParams(location.search).get("from");
  const destination = safeInternalPath(
    stateDestination || queryDestination,
    "/",
  );

  useEffect(() => {
    if (user) navigate(destination, { replace: true });
  }, [user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { username: identifier.trim(), password }
          : {
              username: username.trim(),
              email: email.trim(),
              phone: phone.trim(),
              password,
            };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || "Unable to continue");
      }
      login(data.data as AuthResponse);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1e8] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[36px] border border-black/10 bg-[#fffdf8] shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#111827] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 soft-grid opacity-30" />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#3157d5]/40 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#2a9d8f]/25 blur-3xl" />
          <Link to="/" className="relative flex w-fit items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3157d5]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="font-black tracking-[-0.03em]">Comic Library</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                Personal reading space
              </div>
            </div>
          </Link>

          <div className="relative max-w-xl">
            <div className="mb-5 flex items-center gap-2 text-[#e8a838]">
              <Sparkles className="h-4 w-4" />
              <span className="eyebrow">A better way to keep your place</span>
            </div>
            <h1 className="text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em]">
              Your library should feel like yours.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/60">
              Read private PDFs securely, save progress automatically, collect
              series and submit new material without losing your place.
            </p>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                "Private S3 reading",
                "Progress that follows you",
                "Curated submissions",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white/75"
                >
                  <CheckCircle2 className="mb-3 h-4 w-4 text-[#2a9d8f]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative text-xs font-semibold text-white/35">
            One browser tab, one session. Admin and reader accounts stay
            separate.
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <Link
              to="/"
              className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-[#667085] transition hover:text-[#111827] lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" /> Back to library
            </Link>

            <div className="mb-8">
              <div className="eyebrow text-[#3157d5]">
                {mode === "login" ? "Welcome back" : "Join the library"}
              </div>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.045em] text-[#111827]">
                {mode === "login"
                  ? "Sign in to continue"
                  : "Create your reader account"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#7b8493]">
                {mode === "login"
                  ? "Your progress, collection and submissions are waiting."
                  : "Use at least 8 characters for your password."}
              </p>
            </div>

            <div className="mb-7 grid grid-cols-2 rounded-2xl bg-black/5 p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${mode === "login" ? "bg-white text-[#111827] shadow-sm" : "text-[#7b8493]"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${mode === "register" ? "bg-white text-[#111827] shadow-sm" : "text-[#7b8493]"}`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "login" ? (
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                    Username or email
                  </span>
                  <div className="relative">
                    <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa2af]" />
                    <input
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      required
                      autoComplete="username"
                      className="focus-ring h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm font-semibold text-[#111827]"
                    />
                  </div>
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                      Username
                    </span>
                    <div className="relative">
                      <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa2af]" />
                      <input
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                        minLength={3}
                        maxLength={40}
                        autoComplete="username"
                        className="focus-ring h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm font-semibold text-[#111827]"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                      Email
                    </span>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa2af]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                        className="focus-ring h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm font-semibold text-[#111827]"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                      Phone
                    </span>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa2af]" />
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        required
                        autoComplete="tel"
                        className="focus-ring h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm font-semibold text-[#111827]"
                      />
                    </div>
                  </label>
                </>
              )}

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                  Password
                </span>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa2af]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={mode === "register" ? 8 : 1}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    className="focus-ring h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-12 text-sm font-semibold text-[#111827]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8a93a1]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="focus-ring mt-2 h-12 w-full rounded-2xl bg-[#3157d5] text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                {loading
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-[#8a93a1]">
              Sessions are isolated per browser tab so a reader and
              administrator can stay signed in side by side.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
