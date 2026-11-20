import React from "react";
import { Link, useRouteError } from "react-router";
import { PATH_BY_TAB } from "../../routes";
import { DEFAULT_TAB } from "../../utils/permissions";

/**
 * The screen an uncaught render or lifecycle throw lands on, mounted as the
 * catch-all route's `errorElement` in src/router.tsx. It replaces the whole
 * shell, so it has to stand alone: no sidebar, no header, no session — `useAuth`
 * lived in `App` and unmounted with it, and every order, ticket and count the
 * device held in memory went with it. A throw from an event handler does not
 * reach this screen; the boundary only covers rendering.
 */
export default function CrashFallback() {
  const error = useRouteError();
  const detail =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#FDF9F3] px-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
        <h1 className="text-2xl font-bold text-[#121212] mb-1">Something went wrong</h1>
        <p className="text-gray-500 text-sm mb-6">
          This screen stopped responding. Sign in again to carry on — nothing from
          this session is kept.
        </p>

        <Link
          to={PATH_BY_TAB[DEFAULT_TAB]}
          className="block w-full text-center py-3 rounded-xl text-white font-bold bg-[#562D07] hover:bg-[#3a1d04] transition-colors"
        >
          Back to sign in
        </Link>

        {detail && (
          <p className="text-xs text-gray-500 font-mono mt-4 break-words">{detail}</p>
        )}
      </div>
    </div>
  );
}
