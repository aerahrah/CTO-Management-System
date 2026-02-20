const defaultApiBaseUrl = "https://cto.dictr2.online";

export const API_BASE_URL = String(defaultApiBaseUrl).replace(/\/$/, "");

export const buildApiUrl = (path = "") => {
  if (!path) {
    return API_BASE_URL;
  }

  const rawPath = String(path);
  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
