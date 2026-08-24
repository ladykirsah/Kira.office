/**
 * The status a product should be saved with, given the "Live on AirPlus" switch.
 *
 * ON is simple. OFF is the half that needs care, because "not live" has two meanings:
 *
 *   draft  — never finished
 *   paused — deliberately taken off the shop
 *
 * Switching AirPlus off only ever moves a LIVE product to `paused`. Anything already not-live keeps
 * exactly the status it has, so a half-written draft is never quietly promoted into something that
 * looks like a deliberate decision — and an unrecognised status is left alone rather than replaced
 * with a state we invented for it.
 *
 * Added 2026-08-24 with the AirPlus switch itself. Before that there was no AirPlus control on the
 * edit page at all: "Active on Shopee" doubled as the publish button, which is why turning Shopee on
 * also put a product in front of AirPlus customers without saying so.
 */
export function nextProductStatus(current: string, live: boolean): string {
  if (live) return "active";
  return current === "active" ? "paused" : current;
}
