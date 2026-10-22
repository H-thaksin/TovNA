import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import { SafeImage } from "../components/ui";
import { usd } from "../lib/pricing";

// Read a value from the booking notes.
// Example: "Check-in: 2026-10-20; Nights: 2"
function getNoteValue(notes, label) {
  const match = (notes || "").match(new RegExp(`${label}:\\s*([^;]+)`, "i"));

  return match ? match[1].trim() : "";
}

// Read a numeric price from booking notes.
// Example: "Base: 180.00; VAT: 18.00"
function getPriceValue(notes, label) {
  const value = getNoteValue(notes, label);
  const amount = Number(value);

  return value && Number.isFinite(amount) ? amount : null;
}

// Parse a date without shifting YYYY-MM-DD dates across time zones.
function parseDate(value) {
  if (!value) return null;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

const formatDate = (date, fallback) =>
  date
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date)
    : fallback || "—";

const titleCase = (text) =>
  String(text || "Unknown").replace(/^\w/, (c) => c.toUpperCase());

// Normalize a booking for display.
function normalize(booking) {
  const checkInRaw =
    booking.check_in || getNoteValue(booking.notes, "Check-in");

  const checkOutRaw =
    booking.check_out || getNoteValue(booking.notes, "Check-out");

  const start = parseDate(checkInRaw);
  const end = parseDate(checkOutRaw);

  return {
    ...booking,
    checkInRaw,
    checkOutRaw,
    start,
    end,
    nights:
      Number(booking.nights ?? getNoteValue(booking.notes, "Nights")) || 0,
    statusKey: String(booking.status || "unknown").toLowerCase(),
  };
}

// Copy a booking reference.
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access may be unavailable.
    }
  }

  return (
    <button
      type="button"
      className="booking-copy"
      onClick={copy}
      aria-label={`Copy booking reference ${text}`}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

// Display an individual booking.
function BookingCard({ booking }) {
  const priceItems = [
    ["Base price", "Base"],
    ["Accommodation tax", "Accommodation tax"],
    ["VAT", "VAT"],
    ["Service charge", "Service charge"],
  ];

  return (
    <article className="booking-card">
      <SafeImage
        className="booking-hotel-image"
        src={booking.hotel_image}
        alt={booking.hotel_name || "Booked hotel"}
      />

      <div className="booking-card-content">
        <div className="booking-head">
          <h2>
            {booking.hotel_id != null ? (
              <Link to={`/hotels/${booking.hotel_id}`}>
                {booking.hotel_name || "Travel booking"}
              </Link>
            ) : (
              booking.hotel_name || "Travel booking"
            )}
          </h2>

          <span className={`booking-status ${booking.statusKey}`}>
            {booking.status || "Unknown"}
          </span>
        </div>

        <p className="booking-ref">
          <span>Booking reference</span>

          <code>{booking.booking_reference || `#${booking.id}`}</code>

          {booking.booking_reference && (
            <CopyButton text={booking.booking_reference} />
          )}
        </p>

        <dl className="booking-facts">
          {(booking.checkInRaw || booking.start) && (
            <div>
              <dt>Check-in</dt>
              <dd>{formatDate(booking.start, booking.checkInRaw)}</dd>
            </div>
          )}

          {(booking.checkOutRaw || booking.end) && (
            <div>
              <dt>Check-out</dt>
              <dd>{formatDate(booking.end, booking.checkOutRaw)}</dd>
            </div>
          )}

          {booking.nights > 0 && (
            <div>
              <dt>Stay</dt>
              <dd>
                {booking.nights} {booking.nights === 1 ? "night" : "nights"}
              </dd>
            </div>
          )}

          <div>
            <dt>Booked on</dt>
            <dd>{formatDate(parseDate(booking.booking_date))}</dd>
          </div>
        </dl>

        <div className="booking-foot">
          <div className="booking-total">
            <span>Total</span>
            <strong>{usd(booking.total_amount)}</strong>
          </div>

          <div className="booking-actions">
            <Link
              to={`/my-bookings/${booking.id}`}
              className="btn btn-primary btn-sm"
            >
              View Details
            </Link>

            {booking.hotel_id != null && (
              <Link
                to={`/hotels/${booking.hotel_id}`}
                className="btn btn-outline-primary btn-sm"
              >
                View hotel
              </Link>
            )}
          </div>
        </div>

        {/* Expanded booking details and price breakdown */}
        <details className="booking-details">
          <summary>View booking details</summary>

          <div className="booking-details-content">
            <p>
              <strong>Booking ID:</strong> {booking.id}
            </p>

            <p>
              <strong>Booking reference:</strong>{" "}
              {booking.booking_reference || "—"}
            </p>

            <p>
              <strong>Status:</strong> {booking.status || "Unknown"}
            </p>

            <p>
              <strong>Hotel:</strong> {booking.hotel_name || "Travel booking"}
            </p>

            <p>
              <strong>Check-in:</strong>{" "}
              {formatDate(booking.start, booking.checkInRaw)}
            </p>

            <p>
              <strong>Check-out:</strong>{" "}
              {formatDate(booking.end, booking.checkOutRaw)}
            </p>

            <p>
              <strong>Rooms:</strong>{" "}
              {getNoteValue(booking.notes, "Rooms") || "—"}
            </p>

            <h3>Price breakdown</h3>

            {priceItems.map(([label, noteLabel]) => {
              const amount = getPriceValue(booking.notes, noteLabel);

              return (
                <div className="booking-price-row" key={label}>
                  <span>{label}</span>

                  <span>{amount === null ? "—" : usd(amount)}</span>
                </div>
              );
            })}

            <div className="booking-price-row booking-price-total">
              <strong>Total</strong>
              <strong>{usd(booking.total_amount)}</strong>
            </div>

            <h3>Additional notes</h3>

            <p className="booking-notes">
              {booking.notes || "No additional notes"}
            </p>
          </div>
        </details>
      </div>
    </article>
  );
}

// Display a group of bookings.
function BookingGroup({ title, items }) {
  if (items.length === 0) return null;

  return (
    <section className="booking-group">
      <h2 className="booking-group-title">
        {title} <small>{items.length}</small>
      </h2>

      <div className="booking-list">
        {items.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>
    </section>
  );
}

export default function MyBookings({ onLogin, user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState("all");

  // Reload when the user changes or the customer retries.
  useEffect(() => {
    const controller = new AbortController();

    async function loadBookings() {
      setLoading(true);
      setError("");
      setNeedsLogin(false);

      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setBookings([]);
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/bookings/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        // Handle an expired or invalid login token.
        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setBookings([]);
          setNeedsLogin(true);
          setError("Your session has expired. Please log in again.");
          return;
        }

        if (!response.ok) {
          throw new Error(readError(data));
        }

        setBookings(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err instanceof TypeError
              ? "Cannot connect to the TovNa server. Make sure the backend is running."
              : err.message || "Unable to load bookings.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadBookings();

    return () => controller.abort();
  }, [user, attempt, location.key]);
  // Refresh bookings when the customer returns to this page.
  useEffect(() => {
    function handlePageShow() {
      setAttempt((current) => current + 1);
    }

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);
  const items = useMemo(() => bookings.map(normalize), [bookings]);

  const statuses = useMemo(
    () => [...new Set(items.map((booking) => booking.statusKey))],
    [items],
  );

  const visible =
    filter === "all"
      ? items
      : items.filter((booking) => booking.statusKey === filter);

  // Upcoming means the stay has not finished and is not cancelled.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const isUpcoming = (booking) => {
    const isCancelled = ["cancelled", "canceled"].includes(booking.statusKey);

    return (
      !isCancelled &&
      (booking.end ?? booking.start ?? startOfToday) >= startOfToday
    );
  };

  const upcoming = visible
    .filter(isUpcoming)
    .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));

  const past = visible
    .filter((booking) => !isUpcoming(booking))
    .sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));

  return (
    <div className="my-bookings">
      <h1>My Bookings</h1>

      <p className="my-bookings-intro">
        View and manage your travel reservations.
      </p>

      {loading && (
        <div
          className="booking-list"
          role="status"
          aria-label="Loading your bookings"
        >
          <div className="booking-skeleton" />
          <div className="booking-skeleton" />
        </div>
      )}

      {!loading && needsLogin && (
        <div className="booking-empty">
          {error && (
            <div className="alert alert-warning d-inline-block" role="alert">
              {error}
            </div>
          )}

          <h2>Log in to see your bookings</h2>

          <p>Your reservations are saved to your account.</p>

          {onLogin && (
            <button type="button" className="btn btn-primary" onClick={onLogin}>
              Log in
            </button>
          )}
        </div>
      )}

      {!loading && !needsLogin && error && (
        <div className="booking-empty" role="alert">
          <h2>We couldn't load your bookings</h2>

          <p>{error}</p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !needsLogin && !error && items.length === 0 && (
        <div className="booking-empty">
          <h2>No bookings yet</h2>

          <p>
            You haven't made any bookings yet. When you book a hotel, it will
            appear here.
          </p>

          <Link to="/hotels" className="btn btn-primary">
            Browse hotels
          </Link>
        </div>
      )}

      {!loading && !needsLogin && !error && items.length > 0 && (
        <>
          <div className="bookings-toolbar">
            <p className="bookings-summary">
              <strong>{items.length}</strong>{" "}
              {items.length === 1 ? "booking" : "bookings"} ·{" "}
              <strong>{items.filter(isUpcoming).length}</strong> upcoming
            </p>

            {statuses.length > 1 && (
              <div
                className="bookings-filters"
                role="group"
                aria-label="Filter by status"
              >
                {["all", ...statuses].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`booking-chip ${
                      filter === value ? "is-active" : ""
                    }`}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {value === "all" ? "All" : titleCase(value)}

                    <small>
                      {value === "all"
                        ? items.length
                        : items.filter((booking) => booking.statusKey === value)
                            .length}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <BookingGroup title="Upcoming stays" items={upcoming} />

          <BookingGroup title="Past and cancelled" items={past} />
        </>
      )}
    </div>
  );
}
