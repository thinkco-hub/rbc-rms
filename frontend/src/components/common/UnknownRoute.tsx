import React from "react";
import { Link, useLocation } from "react-router";
import { PATH_BY_TAB } from "../../routes";
import { DEFAULT_TAB } from "../../utils/permissions";

/**
 * The screen a signed-in staff member reaches when no route matched. It is the
 * sibling of `RecordNotFound`, not a reuse of it: that one reports an id inside
 * a route that did match, and a path is not an id. A tab the role cannot see is
 * neither of them — `RequireTab` bounces it, because "no such screen" and "not
 * yours" are different facts and conflating them tells a cashier which routes
 * exist behind their role.
 *
 * The path is echoed exactly as the router holds it. Unlike the segments
 * `useParams` decodes for a record route, `useLocation().pathname` stays
 * percent-encoded, so a pasted link with `%23` in it reads here as it reads in
 * the address bar instead of as a third spelling.
 */
export default function UnknownRoute() {
  const { pathname } = useLocation();

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-10 w-full">
      <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 md:p-8">
        <h2 className="text-3xl font-bold text-[#121212]">Page not found</h2>
        <p className="text-gray-500 mt-2">
          There is no screen at <code className="font-mono break-all">{pathname}</code>
        </p>

        {/* Every role's ROLE_TABS includes dashboard, so this exit always lands. */}
        <Link
          to={PATH_BY_TAB[DEFAULT_TAB]}
          className="inline-flex mt-6 px-4 py-2.5 rounded-lg bg-[#562D07] hover:bg-[#3a1d04] text-white font-bold text-sm shadow-sm transition-colors"
        >
          Go to Dashboard
        </Link>
      </section>
    </div>
  );
}
