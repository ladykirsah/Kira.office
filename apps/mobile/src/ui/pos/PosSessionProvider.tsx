import { createContext, useContext, type ReactNode } from "react";
import { usePosSession, type PosSession } from "./usePosSession";

const PosSessionContext = createContext<PosSession | null>(null);

/**
 * Holds the bill above the pages, so a half-made bill is still there after a look at another tab,
 * and the bills waiting for the internet keep going out whatever page is open.
 */
export function PosSessionProvider({ children }: { children: ReactNode }) {
  const session = usePosSession();
  return <PosSessionContext.Provider value={session}>{children}</PosSessionContext.Provider>;
}

export function usePos(): PosSession {
  const session = useContext(PosSessionContext);
  if (!session) throw new Error("usePos must be used inside PosSessionProvider");
  return session;
}
