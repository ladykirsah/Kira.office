/**
 * Saves run one after another, in the order they were asked for. A failed one reports to its own
 * caller and the next still runs; idle() says when nothing is left, so the page can read back what
 * the server really holds.
 */
export function oneAtATime() {
  let tail: Promise<unknown> = Promise.resolve();
  let waiting = 0;
  const run = <T>(save: () => Promise<T>): Promise<T> => {
    waiting += 1;
    const done = tail.then(save).finally(() => {
      waiting -= 1;
    });
    tail = done.catch(() => undefined);
    return done;
  };
  return { run, idle: () => waiting === 0 };
}
