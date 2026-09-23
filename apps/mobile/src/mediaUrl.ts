import { API_BASE_URL } from "./api";

export function resolveMediaUrl(
  value?: string | null
): string | null {
  if (!value) {
    return null;
  }

  const url = value.trim();

  if (!url) {
    return null;
  }

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  if (url.startsWith("r2://")) {
    return `${API_BASE_URL}/api/r2/proxy?url=${encodeURIComponent(url)}`;
  }

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  return `${API_BASE_URL}/${url}`;
}
