// Basically do nothing but return a resolved promise.
export default () => Promise.resolve();

// Even simpler, don't return anything.
export function empty () { return undefined; }
