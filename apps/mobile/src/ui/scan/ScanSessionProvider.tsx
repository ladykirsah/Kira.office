import { createContext, useContext, type ReactNode } from "react";
import { useScanSession, type ScanSession } from "./useScanSession";

const ScanSessionContext = createContext<ScanSession | null>(null);

/**
 * Holds Scan's lists above the pages, so a half-built bill or stock list is still there after a
 * look at another tab. Signing out unmounts it, and the lists go with it.
 */
export function ScanSessionProvider({ children }: { children: ReactNode }) {
  const session = useScanSession();
  return <ScanSessionContext.Provider value={session}>{children}</ScanSessionContext.Provider>;
}

export function useScan(): ScanSession {
  const session = useContext(ScanSessionContext);
  if (!session) throw new Error("useScan must be used inside ScanSessionProvider");
  return session;
}
