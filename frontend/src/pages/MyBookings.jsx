import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import { SafeImage } from "../components/ui";
import { usd } from "../lib/pricing";

/* ------------------------------ Helpers ------------------------------ */

// Read a value from the booking notes, e.g. "Check-in: 2026-10-20; Nights: 2".
function getNoteValue(notes, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = (notes || "").match(
    new RegExp(`(?:^|;)\\s*${escaped}:\\s*([^;]+)`, "i"),
  );
  return match ? match[1].trim() : "";
}

// Parse a date without shifting YYYY-MM-DD dates across time zones. null means "not a date".
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

// Bookings in these states are finished: never shown as "Upcoming".
const INACTIVE_STATUSES = ["cancelled", "canceled", "rejected"];

const TYPE_ICONS = {
  bus: "🚌",
  van: "🚐",
  minivan: "🚐",
  boat: "⛴️",
  ferry: "⛴️",
  taxi: "🚕",
  train: "🚆",
  flight: "✈️",
};

// Prepare one booking (hotel or transportation) for display.
// This must stay a plain function: hooks such as useLocation() can't be used here.
function normalize(booking) {
  const isTransportation = booking.transportation_id != null;
  const checkInRaw =
    booking.check_in || getNoteValue(booking.notes, "Check-in");
  const checkOutRaw =
    booking.check_out || getNoteValue(booking.notes, "Check-out");
  const travelDateRaw = getNoteValue(booking.notes, "Travel date");

  return {
    ...booking,
    bookingType: isTransportation ? "transportation" : "hotel",
    checkInRaw,
    checkOutRaw,
    travelDateRaw,
    start: parseDate(isTransportation ? travelDateRaw : checkInRaw),
    end: parseDate(checkOutRaw),
    passengers: Number(getNoteValue(booking.notes, "Passengers")) || 0,
    nights:
      Number(booking.nights ?? getNoteValue(booking.notes, "Nights")) || 0,
    statusKey: String(booking.status || "unknown").toLowerCase(),
    title: isTransportation
      ? `${booking.from_destination || "Departure"} → ${booking.to_destination || "Destination"}`
      : booking.hotel_name || "Hotel booking",
  };
}

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

/* ------------------------------ Cards ------------------------------ */

function BookingCard({ booking, onCancel, cancelling }) {
  const isTransportation = booking.bookingType === "transportation";
  const transportKind = String(booking.transport_type || "").toLowerCase();
  const isPending = booking.statusKey === "pending";

  return (
    <article className="booking-card">
      {isTransportation ? (
        <div className="booking-transport-icon" aria-hidden="true">
          {TYPE_ICONS[transportKind] ?? "🚌"}
        </div>
      ) : (
        <SafeImage
          className="booking-hotel-image"
          src={booking.hotel_image}
          alt={booking.hotel_name || "Booked hotel"}
        />
      )}

      <div className="booking-card-content">
        <div className="booking-head">
          <h2>
            {!isTransportation && booking.hotel_id != null ? (
              <Link to={`/hotels/${booking.hotel_id}`}>{booking.title}</Link>
            ) : (
              booking.title
            )}
          </h2>
          <span className={`booking-status ${booking.statusKey}`}>
            {titleCase(booking.status)}
          </span>
        </div>

        {isPending && (
          <p className="booking-hint">⏳ Waiting for confirmation</p>
        )}

        <p className="booking-ref">
          <span>Booking reference</span>
          <code>{booking.booking_reference || `#${booking.id}`}</code>
          {booking.booking_reference && (
            <CopyButton text={booking.booking_reference} />
          )}
        </p>

        <dl className="booking-facts">
          {isTransportation ? (
            <>
              <div>
                <dt>Travel date</dt>
                <dd>
                  {formatDate(
                    parseDate(booking.travelDateRaw),
                    booking.travelDateRaw,
                  )}
                </dd>
              </div>
              <div>
                <dt>Passengers</dt>
                <dd>{booking.passengers || "—"}</dd>
              </div>
              <div>
                <dt>Transport</dt>
                <dd>
                  {[
                    titleCase(booking.transport_type),
                    booking.transport_provider,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>
            </>
          ) : (
            <>
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
            </>
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
              View details
            </Link>
            {!isTransportation && booking.hotel_id != null && (
              <Link
                to={`/hotels/${booking.hotel_id}`}
                className="btn btn-outline-primary btn-sm"
              >
                View hotel
              </Link>
            )}
            {/* Only pending bookings can be cancelled (the API enforces this too). */}
            {isPending && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                disabled={cancelling}
                onClick={() => onCancel(booking)}
              >
                {cancelling ? "Cancelling…" : "Cancel"}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function BookingGroup({ title, items, onCancel, cancellingId }) {
  if (items.length === 0) return null;

  return (
    <section className="booking-group">
      <h2 className="booking-group-title">
        {title} <small>{items.length}</small>
      </h2>
      <div className="booking-list">
        {items.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            onCancel={onCancel}
            cancelling={cancellingId === booking.id}
          />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function MyBookings({ onLogin, user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState(null);
  const [actionError, setActionError] = useState("");

  // Loads when the page opens, after login or logout (user changes),
  // when "Try again" is clicked, and after a cancel (attempt changes).
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
        const response = await fetch(`${API_URL}/bookings/?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        // An expired or invalid login token.
        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setBookings([]);
          setNeedsLogin(true);
          setError("Your session has expired. Please log in again.");
          return;
        }

        if (!response.ok) throw new Error(readError(data));

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
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadBookings();

    return () => controller.abort();
  }, [user, attempt]);

  async function cancelBooking(booking) {
    const label = booking.booking_reference || `#${booking.id}`;
    if (!window.confirm(`Cancel booking ${label}? This cannot be undone.`)) {
      return;
    }

    setActionError("");
    setCancellingId(booking.id);

    try {
      const response = await fetch(`${API_URL}/bookings/${booking.id}/cancel`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
      } else if (!response.ok) {
        // e.g. 409: an admin already confirmed or rejected it.
        setActionError(readError(data));
      }
    } catch (err) {
      setActionError(
        err instanceof TypeError
          ? "Cannot connect to the TovNa server. Make sure the backend is running."
          : err.message || "Unable to cancel this booking.",
      );
    } finally {
      setCancellingId(null);
      // Always refetch: even after an error the status may have changed.
      setAttempt((n) => n + 1);
    }
  }

  const items = useMemo(() => bookings.map(normalize), [bookings]);
  const statuses = useMemo(
    () => [...new Set(items.map((b) => b.statusKey))],
    [items],
  );
  const types = useMemo(
    () => [...new Set(items.map((b) => b.bookingType))],
    [items],
  );

  const visible = items.filter(
    (b) =>
      (statusFilter === "all" || b.statusKey === statusFilter) &&
      (typeFilter === "all" || b.bookingType === typeFilter),
  );

  // Upcoming means still active (not cancelled or rejected) and the stay or journey has not finished.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const isUpcoming = (b) =>
    !INACTIVE_STATUSES.includes(b.statusKey) &&
    (b.end ?? b.start ?? startOfToday) >= startOfToday;

  const upcoming = visible
    .filter(isUpcoming)
    .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
  const past = visible
    .filter((b) => !isUpcoming(b))
    .sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));

  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const chips = (options, value, onChange, label, count) => (
    <div className="bookings-filters" role="group" aria-label={label}>
      {options.map(([optionValue, optionLabel]) => (
        <button
          key={optionValue}
          type="button"
          className={`booking-chip ${value === optionValue ? "is-active" : ""}`}
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
        >
          {optionLabel}
          <small>{count(optionValue)}</small>
        </button>
      ))}
    </div>
  );

  return (
    <div className="my-bookings">
      <h1>My Bookings</h1>
      <p className="my-bookings-intro">
        View and manage your hotel and transportation reservations.
      </p>

      {actionError && (
        <div
          className="alert alert-warning d-flex justify-content-between align-items-center"
          role="alert"
        >
          <span>{actionError}</span>
          <button
            type="button"
            className="btn-close"
            aria-label="Dismiss"
            onClick={() => setActionError("")}
          />
        </div>
      )}

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
            You haven't made any bookings yet. Your hotel and transportation
            reservations will appear here.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            <Link to="/hotels" className="btn btn-primary">
              Browse hotels
            </Link>
            <Link to="/transportation" className="btn btn-outline-primary">
              Find transport
            </Link>
          </div>
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

            <div className="bookings-filter-groups">
              {types.length > 1 &&
                chips(
                  [
                    ["all", "All types"],
                    ["hotel", "Hotels"],
                    ["transportation", "Transport"],
                  ],
                  typeFilter,
                  setTypeFilter,
                  "Filter by booking type",
                  (value) =>
                    value === "all"
                      ? items.length
                      : items.filter((b) => b.bookingType === value).length,
                )}

              {statuses.length > 1 &&
                chips(
                  [
                    ["all", "Any status"],
                    ...statuses.map((s) => [s, titleCase(s)]),
                  ],
                  statusFilter,
                  setStatusFilter,
                  "Filter by status",
                  (value) =>
                    value === "all"
                      ? items.length
                      : items.filter((b) => b.statusKey === value).length,
                )}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="booking-empty">
              <h2>No bookings match these filters</h2>
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <BookingGroup
                title="Upcoming"
                items={upcoming}
                onCancel={cancelBooking}
                cancellingId={cancellingId}
              />
              <BookingGroup
                title="Past, cancelled and rejected"
                items={past}
                onCancel={cancelBooking}
                cancellingId={cancellingId}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
