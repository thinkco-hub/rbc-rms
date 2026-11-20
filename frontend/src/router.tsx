import { createBrowserRouter } from "react-router";
import App from "./App";
import CrashFallback from "./components/common/CrashFallback";

/**
 * The whole app sits under one catch-all route so the shell can keep the feature
 * hooks above the outlet. Changing the history implementation for a host that
 * cannot rewrite paths is a swap in this file alone.
 *
 * The `errorElement` is why that shape is also the crash seam: one route means
 * one boundary over the whole shell, and the fallback has to stand alone because
 * reaching it means `App` unmounted.
 */
export const router = createBrowserRouter([
  { path: "/*", element: <App />, errorElement: <CrashFallback /> },
]);
