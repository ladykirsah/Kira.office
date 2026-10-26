/**
 * The web build of prefs.ts. Language and theme go in localStorage, like the web back office's theme.
 *
 * THE SESSION TOKEN DOES NOT. Anything in localStorage can be read by any script that ever runs on
 * the page, so on the web the token lives in memory only and a reload asks to sign in again. When the
 * web build is hosted for real it gets the web back office's arrangement instead: a small relay on
 * its own origin holding the token in an httpOnly cookie.
 */
export async function readPref(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writePref(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice is simply not remembered.
  }
}

let memoryToken: string | null = null;
export const readToken = async () => memoryToken;
export const writeToken = async (token: string | null) => {
  memoryToken = token;
};
