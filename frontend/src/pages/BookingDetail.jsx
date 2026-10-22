import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import { SafeImage } from "../components/ui";
import CopyButton from "../components/CopyButton";
import { usd } from "../lib/pricing";
import { STATUS_TEXT, formatDate, normalize, parseDate } from "../lib/bookings";

function Message({ children }) {
  return (
    <div className="my-bookings booking-detail">
      <div className="booking-empty">{children}</div>
    </div>
  );
}

export default function BookingDetail({ user, onLogin }) {
  const { id } = useParams();
  const [state, setState] = useState({
    status: "loading",
    booking: null,
    error: "",
  });
  const [attempt, setAttempt] = useState(0);

  // Loads the one booking named in the address. Runs again after login or "Try again".
  useEffect(() => {
    // Only numbers can be booking IDs, so never ask the server about anything else.
    if (!/^\d+$/.test(id)) {
      setState({ status: "notfound", booking: null, error: "" });
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState({ status: "login", booking: null, error: "" });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", booking: null, error: "" });

    fetch(`${API_URL}/bookings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setState({
            status: "login",
            booking: null,
            error: "Your session has expired. Please log in again.",
          });
          return;
        }
        if (response.status === 404) {
          setState({ status: "notfound", booking: null, error: "" });
          return;
        }
        if (!response.ok) throw new Error(readError(data));

        setState({ status: "ready", booking: normalize(data), error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Error fetching booking:", error);
        setState({
          status: "error",
          booking: null,
          error:
            error instanceof TypeError
              ? "Cannot connect to the TovNa server. Make sure the backend is running."
              : error.message || "Unable to load this booking.",
        });
      });

    return () => controller.abort();
  }, [id, user, attempt]);

  // Browser tab title, e.g. "Booking TVN-EE4E5B12D9D9 · TovNa"
  const reference = state.booking?.booking_reference;
  useEffect(() => {
    if (!reference) return;
    const previous = document.title;
    document.title = `Booking ${reference} · TovNa`;
    return () => {
      document.title = previous;
    };
  }, [reference]);

  if (state.status === "loading") {
    return (
      <div
        className="my-bookings booking-detail"
        role="status"
        aria-label="Loading booking"
      >
        <div className="booking-skeleton" />
        <div className="booking-skeleton mt-4" />
      </div>
    );
  }

  if (state.status === "login") {
    return (
      <Message>
        {state.error && (
          <div className="alert alert-warning d-inline-block" role="alert">
            {state.error}
          </div>
        )}
        <h2>Log in to see this booking</h2>
        <p>Your reservations are saved to your account.</p>
        {onLogin && (
          <button type="button" className="btn btn-primary" onClick={onLogin}>
            Log in
          </button>
        )}
      </Message>
    );
  }

  if (state.status === "notfound") {
    return (
      <Message>
        <h2>Booking not found</h2>
        <p>This booking doesn't exist, or it belongs to a different account.</p>
        <Link to="/my-bookings" className="btn btn-primary">
          Back to My Bookings
        </Link>
      </Message>
    );
  }

  if (state.status === "error") {
    return (
      <Message>
        <h2>We couldn't load this booking</h2>
        <p>{state.error}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Try again
        </button>
      </Message>
    );
  }

  const b = state.booking;
  const { base, accommodationTax, vat, service } = b.breakdown;
  const hasBreakdown = base != null;

  // "Check-in in 3 days" for trips that haven't started.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToGo = b.start ? Math.round((b.start - today) / 86400000) : null;
  const countdown =
    b.statusKey === "cancelled" || daysToGo == null || daysToGo < 0
      ? null
      : daysToGo === 0
        ? "Check-in is today"
        : daysToGo === 1
          ? "Check-in is tomorrow"
          : `Check-in in ${daysToGo} days`;

  return (
    <div className="my-bookings booking-detail">
      <nav className="booking-crumbs no-print" aria-label="Breadcrumb">
        <Link to="/my-bookings">My Bookings</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{b.booking_reference || `#${b.id}`}</span>
      </nav>

      <h1>Booking details</h1>

      <section className="booking-detail-hero">
        <SafeImage
          className="booking-detail-image"
          src={b.hotel_image}
          alt={b.hotel_name || "Booked hotel"}
        />

        <div className="booking-detail-summary">
          <div className="booking-head">
            <span className={`booking-status ${b.statusKey}`}>{b.status}</span>
            {countdown && (
              <span className="booking-countdown">{countdown}</span>
            )}
          </div>

          <h2>
            {b.hotel_id != null ? (
              <Link to={`/hotels/${b.hotel_id}`}>
                {b.hotel_name || "Travel booking"}
              </Link>
            ) : (
              b.hotel_name || "Travel booking"
            )}
          </h2>

          <p className="booking-ref">
            <span>Booking reference</span>
            <code>{b.booking_reference || `#${b.id}`}</code>
            {b.booking_reference && <CopyButton text={b.booking_reference} />}
          </p>

          <p className="booking-status-text">
            {STATUS_TEXT[b.statusKey] ??
              "Check back here for updates on this booking."}
          </p>
        </div>
      </section>

      <div className="booking-detail-grid">
        <section className="booking-panel">
          <h2>Your stay</h2>
          <dl className="booking-facts booking-facts--stacked">
            <div>
              <dt>Check-in</dt>
              <dd>{formatDate(b.start, b.checkInRaw)}</dd>
            </div>
            <div>
              <dt>Check-out</dt>
              <dd>{formatDate(b.end, b.checkOutRaw)}</dd>
            </div>
            <div>
              <dt>Length of stay</dt>
              <dd>
                {b.nights > 0
                  ? `${b.nights} ${b.nights === 1 ? "night" : "nights"}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Rooms</dt>
              <dd>{b.rooms}</dd>
            </div>
            <div>
              <dt>Booked on</dt>
              <dd>{formatDate(parseDate(b.booking_date))}</dd>
            </div>
          </dl>
        </section>

        <section className="booking-panel">
          <h2>Price details</h2>
          <dl className="hotel-rows">
            {hasBreakdown && (
              <>
                <div>
                  <dt>
                    {b.rooms} room × {b.nights}{" "}
                    {b.nights === 1 ? "night" : "nights"}
                  </dt>
                  <dd>{usd(base)}</dd>
                </div>
                {accommodationTax != null && (
                  <div className="hotel-row-sub">
                    <dt>Accommodation tax</dt>
                    <dd>{usd(accommodationTax)}</dd>
                  </div>
                )}
                {vat != null && (
                  <div className="hotel-row-sub">
                    <dt>VAT</dt>
                    <dd>{usd(vat)}</dd>
                  </div>
                )}
                {service != null && (
                  <div className="hotel-row-sub">
                    <dt>Service charge</dt>
                    <dd>{usd(service)}</dd>
                  </div>
                )}
              </>
            )}
            <div className="hotel-row-total">
              <dt>Total</dt>
              <dd>{usd(b.total_amount)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="booking-detail-actions no-print">
        <Link to="/my-bookings" className="btn btn-outline-primary">
          ← All bookings
        </Link>
        {b.hotel_id != null && (
          <Link
            to={`/hotels/${b.hotel_id}`}
            className="btn btn-outline-primary"
          >
            View hotel
          </Link>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
        >
          Print this booking
        </button>
      </div>
    </div>
  );
}
