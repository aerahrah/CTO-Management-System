// src/api/sessionEvents.js
const listeners = new Set();

export function subscribeSessionExpired(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitSessionExpired(payload = {}) {
  for (const fn of listeners) fn(payload);
}
