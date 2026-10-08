import { useState } from "react";
import { API_URL, TOKEN_KEY, fetchCurrentUser, readError } from "../lib/api";
import { Modal } from "./ui";

export default function AuthModal({ mode, onSwitch, onClose, onSuccess }) {
  const isSignup = mode === "signup";
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      // Same request format as your backend expects: values travel as URL parameters.
      const params = new URLSearchParams({
        email: form.get("email"),
        password: form.get("password"),
      });
      if (isSignup) {
        const [firstName, ...rest] = String(form.get("name") || "")
          .trim()
          .split(/\s+/);
        params.append("first_name", firstName);
        params.append("last_name", rest.join(" ") || "-");
      }

      const response = await fetch(
        `${API_URL}/auth/${isSignup ? "register" : "login"}?${params}`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setError(readError(data));

      if (isSignup) {
        setNotice("Registration successful. Please log in.");
        return onSwitch();
      }

      localStorage.setItem(TOKEN_KEY, data.access_token);
      onSuccess(await fetchCurrentUser(data.access_token));
    } catch (err) {
      console.error("Authentication error:", err);
      setError(
        err instanceof TypeError
          ? "Cannot connect to the TovNa server. Make sure your FastAPI backend is running."
          : err.message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isSignup ? "Create your account" : "Log in"}
      onClose={onClose}
      size="modal-sm"
    >
      <form className="p-4" onSubmit={handleSubmit}>
        <h2 className="h4 fw-bold mb-1">
          {isSignup ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-secondary small mb-4">
          {isSignup
            ? "Start planning your Cambodia trip."
            : "Log in to continue planning."}
        </p>

        {notice && (
          <div className="alert alert-success py-2 small" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="alert alert-danger py-2 small" role="alert">
            {error}
          </div>
        )}

        {isSignup && (
          <div className="mb-3">
            <label className="form-label" htmlFor="auth-name">
              Full name
            </label>
            <input
              id="auth-name"
              name="name"
              className="form-control"
              autoComplete="name"
              required
            />
          </div>
        )}
        <div className="mb-3">
          <label className="form-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            className="form-control"
            autoComplete="email"
            required
          />
        </div>
        <div className="mb-4">
          <label className="form-label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            className="form-control"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary w-100"
          disabled={submitting}
        >
          {submitting ? "Please wait…" : isSignup ? "Create account" : "Log in"}
        </button>
        <p className="text-center small text-secondary mt-3 mb-0">
          {isSignup ? "Already have an account? " : "New to TovNa? "}
          <button
            type="button"
            className="btn btn-link p-0 align-baseline small"
            onClick={onSwitch}
          >
            {isSignup ? "Log in" : "Create account"}
          </button>
        </p>
      </form>
    </Modal>
  );
}
