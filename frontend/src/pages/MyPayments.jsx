import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import { transportImage } from "../lib/transportImages";

function formatUSD(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function titleCase(value) {
  if (!value) return "Unknown";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PaymentStatus({ status }) {
  const normalized = String(status || "pending").toLowerCase();

  return (
    <span className={`my-payment-status status-${normalized}`}>
      {titleCase(normalized)}
    </span>
  );
}

export default function MyPayments({ user, onLogin, authReady = true }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setPayments([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadPayments() {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
          throw new Error(
            "Your login session has expired. Please log in again.",
          );
        }

        const response = await fetch(`${API_URL}/payments/`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        // Read the body once. If it is not JSON, use an empty object.
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          throw new Error("Your session has expired. Please log in again.");
        }
        if (!response.ok) throw new Error(readError(data));

        setPayments(Array.isArray(data) ? data : data.payments || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err instanceof TypeError
              ? "Cannot connect to the TovNa server. Make sure the backend is running."
              : err.message || "Unable to load your payments.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadPayments();
    return () => controller.abort();
  }, [user, authReady, attempt]);

  if (!authReady) {
    return (
      <section className="my-payments-page">
        <div className="container">
          <p className="my-payments-message">Checking your account...</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="my-payments-page">
        <div className="container">
          <div className="my-payments-empty">
            <h2>Please log in</h2>
            <p>You need to log in to view your payment history.</p>
            <button className="my-payments-primary-btn" onClick={onLogin}>
              Log in
            </button>
          </div>
        </div>
      </section>
    );
  }

  const paidCount = payments.filter(
    (payment) => payment.status?.toLowerCase() === "paid",
  ).length;

  const pendingCount = payments.filter(
    (payment) => payment.status?.toLowerCase() === "pending",
  ).length;

  const totalPaid = payments
    .filter((payment) => payment.status?.toLowerCase() === "paid")
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);

  return (
    <section className="my-payments-page">
      <div className="container">
        <div className="my-payments-header">
          <div>
            <span className="my-payments-eyebrow">YOUR ACCOUNT</span>
            <h1>My Payments</h1>
            <p>View your payment history and transaction details.</p>
          </div>

          <Link to="/my-bookings" className="my-payments-back-link">
            View My Bookings
          </Link>
        </div>

        <div className="my-payments-stats">
          <div className="my-payment-stat">
            <span>Total Payments</span>
            <strong>{payments.length}</strong>
          </div>

          <div className="my-payment-stat">
            <span>Paid Payments</span>
            <strong>{paidCount}</strong>
          </div>

          <div className="my-payment-stat">
            <span>Pending Payments</span>
            <strong>{pendingCount}</strong>
          </div>

          <div className="my-payment-stat">
            <span>Total Paid</span>
            <strong>{formatUSD(totalPaid)}</strong>
          </div>
        </div>

        {loading ? (
          <div className="my-payments-message">Loading your payments...</div>
        ) : error ? (
          <div className="my-payments-error">
            <p>{error}</p>
            <button
              className="my-payments-primary-btn"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="my-payments-empty">
            <h2>No payments yet</h2>
            <p>
              Once you make a payment for a confirmed booking, it will appear
              here.
            </p>
            <Link to="/my-bookings" className="my-payments-primary-btn">
              View My Bookings
            </Link>
          </div>
        ) : (
          <div className="my-payments-list">
            {payments.map((payment) => (
              <article className="my-payment-card" key={payment.id}>
                <div className="my-payment-card-top">
                  <div>
                    <span className="my-payment-label">PAYMENT</span>
                    <h3>Payment #{payment.id}</h3>
                    <p>
                      Booking reference:{" "}
                      <strong>
                        {payment.booking_reference || `#${payment.booking_id}`}
                      </strong>
                    </p>
                  </div>

                  <PaymentStatus status={payment.status} />
                </div>

                <div className="my-payment-details">
                  <div>
                    <span>Amount</span>
                    <strong>{formatUSD(payment.amount)}</strong>
                  </div>

                  <div>
                    <span>Payment Method</span>
                    <strong>{payment.method || "—"}</strong>
                  </div>

                  <div>
                    <span>Transaction Reference</span>
                    <strong>
                      {payment.transaction_reference || "Not submitted"}
                    </strong>
                  </div>

                  <div>
                    <span>Paid At</span>
                    <strong>{formatDate(payment.paid_at)}</strong>
                  </div>
                </div>

                <div className="my-payment-card-bottom">
                  <span>
                    Booking status:{" "}
                    <strong>{titleCase(payment.booking_status)}</strong>
                  </span>

                  <Link
                    to={`/my-bookings/${payment.booking_id}`}
                    className="my-payment-view-link"
                  >
                    View Booking
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
