const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function resolveAssetUrl(value) {
  if (!value) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_URL}${value}`;
  }

  return value;
}

export default resolveAssetUrl;
