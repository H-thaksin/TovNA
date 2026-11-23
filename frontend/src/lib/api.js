export const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export const TOKEN_KEY = "access_token";

// =========================================================
// Fetch JSON
// =========================================================

export async function fetchJson(path, signal) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(readError(data));
  }

  return data;
}

// =========================================================
// POST JSON
// =========================================================

export async function postJson(path, body, signal) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(readError(data));
  }

  return data;
}

export async function postJsonAuth(path, body, token, signal) {
  if (!token) {
    throw new Error("Please log in to use the AI Assistant.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(readError(data));
    error.status = response.status;
    throw error;
  }

  return data;
}

// =========================================================
// Read API Error
// =========================================================

export const readError = (data) =>
  Array.isArray(data?.detail)
    ? data.detail.map((d) => d.msg || "Invalid input").join(". ")
    : data?.detail || "Something went wrong. Please try again.";

// =========================================================
// Fetch Current User
// GET /auth/me
// =========================================================

export async function fetchCurrentUser(token) {
  if (!token) {
    throw new Error("Authentication token is missing.");
  }

  const response = await fetch(`${API_URL}/auth/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(readError(data));
  }

  const name = [data.first_name, data.last_name]
    .filter((n) => n && n !== "-")
    .join(" ");

  return {
    id: data.id,
    name: name || data.email || "User",
    email: data.email,
    role: data.role,
    role_id: data.role_id,
    is_active: data.is_active,
  };
}
