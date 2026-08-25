import type { Phrase } from "./lang";

/** The two places a product can be sold. */
export type SalesChannel = "AirPlus" | "Shopee";

/**
 * The label on a row-menu action that moves a product between live and paused on one channel.
 *
 * Owner's wording, 2026-08-24. Kept here rather than inline so it cannot drift: two earlier
 * attempts ("Put back on AirPlus", "Mark listed on Shopee") each read differently from the tabs and
 * the Status column, which use the same vocabulary — a product is live on a channel, or paused on
 * it. One pair of words for one idea.
 *
 * The label names the state you are moving TO. A row offering "Pause on AirPlus" is live right now.
 *
 * @param live whether the product is live on that channel at the moment
 */
export function channelActionLabel(channel: SalesChannel, live: boolean): Phrase {
  // The channel's NAME is not translated — AirPlus and Shopee are names, not words. Only the verb
  // in front of it changes, which keeps this reading as one pair of words in either language.
  return live
    ? { th: `หยุดขายบน ${channel}`, en: `Pause on ${channel}` }
    : { th: `วางขายบน ${channel}`, en: `Live on ${channel}` };
}
