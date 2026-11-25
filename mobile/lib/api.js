import * as SecureStore from "expo-secure-store";

// On a phone "localhost" is the phone itself, so set your Mac's IP in mobile/.env
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const TOKEN_KEY = "access_token";
const TIMEOUT_MS = 15000;

export const readError = (data) =>
  Array.isArray(data?.detail)
    ? data.detail.map((d) => d.msg || "Invalid input").join(". ")
    : data?.detail || "Something went wrong. Please try again.";

// ---------- Token storage (replaces localStorage from the website) ----------
export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const saveToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

// ---------- One request helper used by everything below ----------
// - network problems get a clear message (error.network = true)
// - HTTP errors keep the status code (error.status)
// - a caller cancelling (AbortController) still throws AbortError
async function request(path, { method = "GET", body, token, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  if (signal?.aborted) controller.abort();
  signal?.addEventListener?.("abort", () => controller.abort());

  let response;
  try {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error; // cancelled by the caller
    const failure = new Error(
      error?.name === "AbortError"
        ? "The server took too long to respond. Please try again."
        : `Cannot connect to the TovNa server (${API_URL}). Check that the backend is running and your phone is on the same Wi-Fi.`,
    );
    failure.network = true;
    throw failure;
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const failure = new Error(readError(data));
    failure.status = response.status;
    throw failure;
  }
  return data;
}

const notLoggedIn = (message) => {
  const error = new Error(message);
  error.status = 401;
  return error;
};

// ---------- Public API ----------
export const fetchJson = (path, signal) => request(path, { signal });

export const postJson = (path, body, signal) =>
  request(path, { method: "POST", body, signal });

export async function postJsonAuth(path, body, token, signal) {
  if (!token) throw notLoggedIn("Please log in before booking.");
  return request(path, { method: "POST", body, token, signal });
}

// Any request with the saved login token (GET by default).
// Used by My bookings, booking details, cancel, payments, ...
export async function authFetch(path, { method = "GET", body, signal } = {}) {
  const token = await getToken();
  if (!token) throw notLoggedIn("Please log in to continue.");
  return request(path, { method, body, token, signal });
}

export const fetchAuthJson = (path, signal) => authFetch(path, { signal });

export async function fetchCurrentUser(token) {
  if (!token) throw notLoggedIn("Authentication token is missing.");
  const data = await request("/auth/me", { token });

  const name = [data.first_name, data.last_name]
    .filter((n) => n && n !== "-")
    .join(" ");

  return {
    id: data.id,
    name: name || data.email || "User",
    email: data.email,
    role: String(data.role ?? "")
      .trim()
      .toLowerCase(),
    role_id: data.role_id,
  };
}

// Turn "/images/x.jpg" into a full URL the phone can load
export function imageUrl(item) {
  const raw =
    item?.image_url ??
    item?.image ??
    item?.thumbnail ??
    item?.photo ??
    item?.cover_image ??
    item?.images?.[0]?.url ??
    item?.images?.[0];
  if (!raw || typeof raw !== "string") return null;
  if (raw.startsWith("http")) {
    // The database may store localhost URLs that a phone cannot open
    return raw.replace(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, API_URL);
  }
  return `${API_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
}
