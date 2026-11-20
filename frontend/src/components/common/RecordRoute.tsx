import React from "react";
import RecordNotFound from "./RecordNotFound";

interface RecordRouteProps<T> {
  /** The collection this route resolves in — the array the shell already owns. */
  items: T[];
  id: string;
  /** What the URL names, spelled as the screen spells it: "Order", "Client", "Recipe". */
  kind: string;
  onBack: () => void;
  children: (item: T) => React.ReactNode;
}

/**
 * Resolves a record URL against a collection. The not-found panel and the back
 * contract live here once, so every record route states only what it renders.
 */
export default function RecordRoute<T extends { id: string }>({
  items,
  id,
  kind,
  onBack,
  children,
}: RecordRouteProps<T>) {
  const item = items.find((candidate) => candidate.id === id);

  if (!item) {
    return <RecordNotFound kind={kind} id={id} onBack={onBack} />;
  }

  return <>{children(item)}</>;
}
