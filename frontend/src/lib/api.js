export const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
export const TOKEN_KEY = "access_token";

export async function fetchJson(path, signal) {
  const response = await fetch(`${API_URL}${path}`, { signal });
  if (!response.ok)
    throw new Error(`Request failed (${response.status}) for ${path}`);
  return response.json();
}

// FastAPI returns `detail` as a string, or as a list of objects for validation errors.
export const readError = (data) =>
  Array.isArray(data?.detail)
    ? data.detail.map((d) => d.msg).join(". ")
    : data?.detail || "Something went wrong. Please try again.";

export async function fetchCurrentUser(token) {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(readError(data));
  const name = [data.first_name, data.last_name]
    .filter((n) => n && n !== "-")
    .join(" ");
  return { name: name || data.email, email: data.email };
}
