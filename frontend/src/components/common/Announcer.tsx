import { createContext, memo, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type Announce = (message: string) => void;

interface Message {
  text: string;
  seq: number;
}

const AnnouncerContext = createContext<Announce | null>(null);

/**
 * One polite live region for the whole shell, so a mutation that only changes a
 * number on screen still reaches a screen reader.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message>({ text: "", seq: 0 });

  const announce = useCallback<Announce>((text) => {
    setMessage((prev) => ({ text, seq: prev.seq + 1 }));
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <LiveRegion message={message} />
    </AnnouncerContext.Provider>
  );
}

// Memoised: the shell re-renders on every keystroke, and reconciling a portal
// into body on each of those renders costs more than the region is worth.
const LiveRegion = memo(function LiveRegion({ message }: { message: Message }) {
  // Portalled out of #root: an open dialog sets #root inert, which would
  // otherwise silence every announcement made from inside it.
  return createPortal(
    <div role="status" aria-live="polite" className="sr-only">
      {/* Keyed so repeating the same message still mutates the region. */}
      <span key={message.seq}>{message.text}</span>
    </div>,
    document.body
  );
});

export function useAnnounce(): Announce {
  const announce = useContext(AnnouncerContext);
  if (!announce) throw new Error("useAnnounce must be used inside AnnouncerProvider");
  return announce;
}