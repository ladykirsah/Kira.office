// Server-component layout for the /checkout segment (covers /checkout and /checkout/done). The
// pages are Client Components, where `export const dynamic` is treated as a client reference and
// ignored as route config — so the render mode is pinned here instead. force-dynamic keeps them
// server-rendered per request (cache-control: no-store) so a redeploy (and the embedded OTP login
// widget) is picked up immediately and an old JS bundle can never be pinned by a year-long static
// edge cache. Matches the force-dynamic used by every server page.
export const dynamic = "force-dynamic";

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
