// Basically do nothing but return a resolved promise.
export default (value) => Promise.resolve(value);

// Less promises.
export function empty (value) { return value; }
