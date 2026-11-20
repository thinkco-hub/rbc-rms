/** Viewport classes shared by the app shells (App, Sidebar, Chams ledger). */

/** Below this width the POS ticket lives in the top bar instead of a side panel. */
const PHONE_MAX_PX = 768;

/** At or above this width a sidebar rail can stay pinned to the layout. */
const DESKTOP_RAIL_MIN_PX = 1024;

/**
 * True when the viewport may show the pinned, hover-to-expand sidebar rail.
 * Touch devices never qualify: they have no hover to trigger the expansion, and
 * iPadOS reports a desktop-sized viewport in landscape. They get the same
 * off-canvas drawer as the phone, opened from the hamburger.
 */
export function canUseSidebarRail(windowWidth: number): boolean {
  const isTouchDevice =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  return windowWidth >= DESKTOP_RAIL_MIN_PX && !isTouchDevice;
}

/** True while the phone POS layout (one column, ticket in the top bar) applies. */
export function isPhoneViewport(windowWidth: number): boolean {
  return windowWidth < PHONE_MAX_PX;
}
