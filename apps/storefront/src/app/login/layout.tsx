// Server-component layout for the /login segment. The page itself is a Client Component, where
// `export const dynamic` is treated as a client reference and ignored as route config — so the
// render mode is pinned here instead. force-dynamic keeps the page server-rendered per request
// (cache-control: no-store) so a redeploy is picked up immediately and an old JS bundle can never
// be pinned by a year-long static edge cache. Matches the force-dynamic used by every server page.
export const dynamic = "force-dynamic";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
