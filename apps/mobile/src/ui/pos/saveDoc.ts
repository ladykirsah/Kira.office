/**
 * Saving or sending the bill as a file needs modules the phone app does not carry yet (web first,
 * owner 2026-10-26). Until then the button says so instead of doing nothing.
 */
export async function saveDoc(
  _kind: "pdf" | "png",
  _node: unknown,
  _fileName: string,
): Promise<void> {
  throw new Error("Saving the bill works in the web version for now");
}

export async function shareDoc(_node: unknown, _fileName: string): Promise<"shared" | "saved"> {
  throw new Error("Sending the bill works in the web version for now");
}
