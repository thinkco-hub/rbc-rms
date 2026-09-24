import React, { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { LoginCredentials } from "../../types/domain";
import type { LoginResult } from "../../hooks/useAuth";

const LAST_EMAIL_KEY = "bakery.lastLoginEmail";

function loadLastEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

interface LoginPageProps {
  onLogin: (credentials: LoginCredentials) => Promise<LoginResult>;
  getLockedUntil: (email: string) => number | null;
}

export default function LoginPage({ onLogin, getLockedUntil }: LoginPageProps) {
  // Seeded from localStorage (not the password) so a lockout is visible
  // immediately on reload, without retyping the email first.
  const [email, setEmail] = useState(loadLastEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Ticks every second so an in-progress lockout (persisted in localStorage,
  // read live below) keeps counting down correctly even right after a
  // page refresh — not just after the next submit attempt.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      if (email) localStorage.setItem(LAST_EMAIL_KEY, email);
      else localStorage.removeItem(LAST_EMAIL_KEY);
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [email]);

  const lockedUntil = getLockedUntil(email);
  const secondsLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const isLocked = secondsLeft > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await onLogin({ email, password });
    setSubmitting(false);
    setError(result.ok ? null : result.error);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#FDF9F3] px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn"
      >
        <h1 className="text-2xl font-bold text-[#121212] mb-1">Bakery Command Center</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to continue</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
              autoComplete="username"
              disabled={isLocked}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F17D0C] focus:border-[#F17D0C] outline-none text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
              autoComplete="current-password"
              disabled={isLocked}
              required
            />
          </div>
        </div>

        {(isLocked || error) && (
          <p className="mt-4 text-sm font-semibold text-red-600">
            {isLocked ? `Too many failed attempts. Try again in ${secondsLeft}s.` : error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || isLocked}
          className="w-full mt-6 py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLocked ? "Locked" : submitting ? "Signing in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
