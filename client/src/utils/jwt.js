// src/utils/jwt.js
export function decodeJwt(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getJwtExpMs(token) {
  const decoded = decodeJwt(token);
  const exp = decoded?.exp;
  if (!exp) return null;
  return exp * 1000;
}
