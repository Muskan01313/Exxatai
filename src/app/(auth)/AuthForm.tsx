"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "rounded-md border border-line bg-[#f7f7f5] px-3 py-2 text-sm outline-none focus:border-accent/60 focus:bg-white";

export function AuthForm({ mode, callbackUrl }: { mode: "login" | "signup"; callbackUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";
  const otherHref = `${isSignup ? "/login" : "/signup"}${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignup) {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError(isSignup ? "Your account was created, but logging in failed. Please log in." : "Wrong email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">{isSignup ? "Create your account" : "Log in"}</h1>
      <p className="mt-1 text-sm text-ink-2">
        {isSignup ? "You'll get your own workspace in a few seconds." : "Welcome back to your workspace."}
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {isSignup && (
          <label className="flex flex-col gap-1 text-sm text-ink-2">
            Name
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm text-ink-2">
          Email
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-2">
          Password
          <input
            id="password"
            type="password"
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-[#0077d4] disabled:opacity-50"
        >
          {loading ? (isSignup ? "Creating account…" : "Logging in…") : isSignup ? "Create account" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink-2">
        {isSignup ? "Already have an account? " : "Don't have an account? "}
        <Link href={otherHref} className="font-medium text-ink underline">
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}
