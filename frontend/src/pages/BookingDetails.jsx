import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import { Modal, SafeImage } from "../components/ui";
import { usd } from "../lib/pricing";

/* ------------------------------ Helpers ------------------------------ */

// Read a value from booking notes, like "Check-in: 2026-10-20; Nights: 2".
function getNoteValue(notes, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = (notes || "").match(
    new RegExp(`(?:^|;)\\s*${escapedLabel}:\\s*([^;]+)`, "i"),
  );
  return match ? match[1].trim() : "";
}

// Read a numeric price from booking notes.
function getPriceValue(notes, label) {
  const value = getNoteValue(notes, label);
  const amount = Number(value);
  return value && Number.isFinite(amount) ? amount : null;
}

function parseDate(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Format a date for display. Text that isn't a date is shown as it is.
function formatDate(value) {
  if (!value) return "—";
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getBookingType(b) {
  if (b.transportation_id != null) return "transportation";
  if (b.tour_id != null) return "tour";
  if (b.activity_id != null) return "activity";
  return "hotel";
}

function getServicePath(b, type) {
  if (type === "hotel" && b.hotel_id != null) return `/hotels/${b.hotel_id}`;
  if (type === "tour" && b.tour_id != null)
    return `/articles/tours/${b.tour_id}`;
  if (type === "activity" && b.activity_id != null)
    return `/articles/activities/${b.activity_id}`;
  return null;
}

const STATUS_TEXT = {
  pending: "Your booking has been received and is waiting for confirmation.",
  confirmed: "Your reservation is confirmed. We look forward to welcoming you.",
  rejected: "This booking could not be confirmed.",
  completed: "This booking is complete. Thank you for travelling with TovNa.",
  cancelled: "This booking was cancelled.",
};

const PRICE_ITEMS = [
  ["Base price", "Base"],
  ["Accommodation tax", "Accommodation tax"],
  ["VAT", "VAT"],
  ["Service charge", "Service charge"],
];

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

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: nothing to do */
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

const titleCase = (text) =>
  String(text || "").replace(/^\w/, (c) => c.toUpperCase());

function Message({ children }) {
  return (
    <section className="section text-center">
      <div className="container">{children}</div>
    </section>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function BookingDetails({ user, onLogin }) {
  const { id } = useParams();

  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | login | notfound | error
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  //Payment state. This is separate from the booking because the payment may not exist yet.
  const [payment, setPayment] = useState(null);
  const [paymentLoadStatus, setPaymentLoadStatus] = useState("idle");
  const [paymentError, setPaymentError] = useState("");

  // Cancellation state.
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelMessage, setCancelMessage] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Load the booking. Runs again after login or logout and when "Try again" is clicked.
  useEffect(() => {
    // Only numbers can be booking IDs, so never ask the server about anything else.
    if (!/^\d+$/.test(id)) {
      setBooking(null);
      setStatus("notfound");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setBooking(null);
      setError("");
      setStatus("login");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setError("");

    fetch(`${API_URL}/bookings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        // An expired or invalid token: clear it and ask the customer to log in again.
        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setBooking(null);
          setError("Your session has expired. Please log in again.");
          setStatus("login");
          return;
        }
        if (response.status === 404) {
          setBooking(null);
          setStatus("notfound");
          return;
        }
        if (!response.ok) throw new Error(readError(data));

        setBooking(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Error fetching booking:", err);
        setError(
          err instanceof TypeError
            ? "Cannot connect to the TovNa server. Check that the backend is running."
            : err.message || "Unable to load booking.",
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [id, user, attempt]);

  // Browser tab title, e.g. "Booking TVN-EE4E5B12D9D9 · TovNa"
  const reference = booking?.booking_reference;
  useEffect(() => {
    if (!reference) return;
    const previous = document.title;
    document.title = `Booking ${reference} · TovNa`;
    return () => {
      document.title = previous;
    };
  }, [reference]);

  const notes = booking?.notes || "";

  const details = useMemo(() => {
    if (!booking) return null;

    const bookingType = getBookingType(booking);
    const isTransportation = bookingType === "transportation";
    const isExperience = bookingType === "tour" || bookingType === "activity";
    const item = booking.items?.[0] || {};

    const serviceDate = item.service_date || "";
    const checkIn =
      booking.check_in ||
      getNoteValue(notes, "Check-in") ||
      (bookingType === "hotel" ? serviceDate : "");
    const checkOut = booking.check_out || getNoteValue(notes, "Check-out");
    const travelDate = getNoteValue(notes, "Travel date");
    const passengers = Number(getNoteValue(notes, "Passengers")) || 0;
    const participants = Number(booking.participants) || 0;
    const unitPrice = Number(
      isTransportation ? booking.transport_unit_price : item.unit_price,
    );
    const start = parseDate(
      isTransportation ? travelDate : isExperience ? serviceDate : checkIn,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysToGo = start ? Math.round((start - today) / 86400000) : null;

    const titles = {
      transportation: `${booking.from_destination || "Departure"} → ${booking.to_destination || "Destination"}`,
      tour: booking.tour_name || "Tour booking",
      activity: booking.activity_name || "Activity booking",
      hotel: booking.hotel_name || "Travel booking",
    };

    return {
      bookingType,
      isTransportation,
      isExperience,
      checkIn,
      checkOut,
      travelDate,
      serviceDate,
      passengers,
      participants,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
      transportKind: String(booking.transport_type || "").toLowerCase(),
      title: titles[bookingType],
      image:
        booking.hotel_image || booking.tour_image || booking.activity_image,
      servicePath: getServicePath(booking, bookingType),
      // `||` (not `??`) because a missing note gives "" rather than null.
      rooms: booking.rooms || getNoteValue(notes, "Rooms") || "1",
      nights: booking.nights || getNoteValue(notes, "Nights") || "—",
      statusKey: String(booking.status || "unknown").toLowerCase(),
      daysToGo,
      prices: PRICE_ITEMS.map(([label, noteLabel]) => [
        label,
        getPriceValue(notes, noteLabel),
      ]),
    };
  }, [booking, notes]);

  // Cancel the booking after the customer confirms in the dialog.
  async function handleCancelBooking() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setCancelError("Please log in to cancel your booking.");
      return false;
    }

    setCancelling(true);
    setCancelError("");
    setCancelMessage("");

    try {
      const response = await fetch(`${API_URL}/bookings/${id}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setCancelError("Your session has expired. Please log in again.");
        return false;
      }
      if (!response.ok) throw new Error(readError(data));

      // The cancel endpoint returns only { booking_id, status }, so merge just the status.
      const updated = data.booking ?? data;
      setBooking((current) => ({
        ...current,
        status: updated.status || "cancelled",
      }));
      setCancelMessage("Booking cancelled successfully.");
      return true;
    } catch (err) {
      setCancelError(
        err instanceof TypeError
          ? "Cannot connect to the TovNa server."
          : err.message || "Unable to cancel booking.",
      );
      return false;
    } finally {
      setCancelling(false);
    }
  }

  function closeDialog() {
    if (cancelling) return; // don't close while the request is running
    setShowCancelDialog(false);
    setCancelError("");
  }

  /* ----- States ----- */

  if (status === "loading") {
    return (
      <Message>
        <div
          className="spinner-border text-primary"
          role="status"
          aria-label="Loading booking details"
        />
        <p className="mt-3 mb-0">Loading booking details...</p>
      </Message>
    );
  }

  if (status === "login") {
    return (
      <Message>
        {error && (
          <div className="alert alert-warning d-inline-block" role="alert">
            {error}
          </div>
        )}
        <h1 className="h3 fw-bold">Log in to see this booking</h1>
        <p className="text-secondary">
          Your reservations are saved to your account.
        </p>
        {onLogin && (
          <button type="button" className="btn btn-primary" onClick={onLogin}>
            Log in
          </button>
        )}
      </Message>
    );
  }

  if (status === "notfound") {
    return (
      <Message>
        <h1 className="h3 fw-bold">Booking not found</h1>
        <p className="text-secondary">
          This booking doesn't exist, or you do not have permission to view it.
        </p>
        <Link to="/my-bookings" className="btn btn-primary">
          Back to My Bookings
        </Link>
      </Message>
    );
  }

  if (status === "error" || !booking) {
    return (
      <Message>
        <h1 className="h3 fw-bold">We couldn't load this booking</h1>
        <p role="alert">{error || "Something went wrong."}</p>
        <div className="d-flex justify-content-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
          <Link to="/my-bookings" className="btn btn-outline-primary">
            Back to My Bookings
          </Link>
        </div>
      </Message>
    );
  }

  const { statusKey, daysToGo, prices, isTransportation, isExperience } =
    details;

  const perUnit = isTransportation || isExperience;
  const quantity = isTransportation ? details.passengers : details.participants;
  const unitNoun = isTransportation
    ? quantity === 1
      ? "passenger"
      : "passengers"
    : quantity === 1
      ? "participant"
      : "participants";

  const hasBreakdown = perUnit
    ? details.unitPrice !== null && quantity > 0
    : prices.some(([, amount]) => amount !== null);

  const startWord = isTransportation
    ? "Departure"
    : isExperience
      ? "Starts"
      : "Check-in";

  const countdown =
    statusKey === "cancelled" ||
    statusKey === "rejected" ||
    daysToGo == null ||
    daysToGo < 0
      ? null
      : daysToGo === 0
        ? `${startWord} today`
        : daysToGo === 1
          ? `${startWord} tomorrow`
          : `${startWord} in ${daysToGo} days`;

  return (
    <section className="section booking-detail-page">
      <div className="container">
        <Link to="/my-bookings" className="booking-back-link no-print">
          ← Back to My Bookings
        </Link>

        <div className="booking-detail-card">
          {/* Booking header */}
          <div className="booking-detail-header">
            <div>
              <p className="text-secondary mb-1">Booking reference</p>
              <h1>
                {booking.booking_reference || `#${booking.id}`}{" "}
                {booking.booking_reference && (
                  <CopyButton text={booking.booking_reference} />
                )}
              </h1>
            </div>

            <span className={`booking-status ${statusKey}`}>
              {booking.status || "Unknown"}
            </span>
          </div>

          {/* Service summary */}
          <div className="booking-detail-hotel">
            {isTransportation ? (
              <div className="booking-detail-transport-icon" aria-hidden="true">
                {TYPE_ICONS[details.transportKind] ?? "🚌"}
              </div>
            ) : (
              <SafeImage src={details.image} alt={details.title} />
            )}
            <div>
              <h2>
                {details.servicePath ? (
                  <Link to={details.servicePath}>{details.title}</Link>
                ) : (
                  details.title
                )}
              </h2>
              {countdown && (
                <span className="booking-countdown">{countdown}</span>
              )}
              <p className="booking-status-text">
                {STATUS_TEXT[statusKey] ??
                  "Check back here for updates on this booking."}
              </p>
            </div>
          </div>

          <hr />

          {/* Booking information */}
          <div className="booking-detail-grid">
            <div>
              <span>Booking ID</span>
              <strong>{booking.id}</strong>
            </div>

            {isTransportation ? (
              <>
                <div>
                  <span>Travel date</span>
                  <strong>{formatDate(details.travelDate)}</strong>
                </div>
                <div>
                  <span>Passengers</span>
                  <strong>{details.passengers || "—"}</strong>
                </div>
                <div>
                  <span>Transport</span>
                  <strong>{titleCase(booking.transport_type) || "—"}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{booking.transport_provider || "—"}</strong>
                </div>
              </>
            ) : isExperience ? (
              <>
                <div>
                  <span>
                    {details.bookingType === "tour"
                      ? "Tour date"
                      : "Activity date"}
                  </span>
                  <strong>{formatDate(details.serviceDate)}</strong>
                </div>
                <div>
                  <span>
                    {details.bookingType === "tour"
                      ? "Travelers"
                      : "Participants"}
                  </span>
                  <strong>{details.participants || "—"}</strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>Check-in</span>
                  <strong>{formatDate(details.checkIn)}</strong>
                </div>
                <div>
                  <span>Check-out</span>
                  <strong>{formatDate(details.checkOut)}</strong>
                </div>
                <div>
                  <span>Rooms</span>
                  <strong>{details.rooms}</strong>
                </div>
                <div>
                  <span>Nights</span>
                  <strong>{details.nights}</strong>
                </div>
              </>
            )}

            <div>
              <span>Booking date</span>
              <strong>{formatDate(booking.booking_date)}</strong>
            </div>
          </div>

          {/* Cancel booking button: pending bookings only */}
          {statusKey === "pending" && (
            <div className="booking-cancel-section no-print">
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => {
                  setCancelError("");
                  setCancelMessage("");
                  setShowCancelDialog(true);
                }}
                disabled={cancelling}
              >
                Cancel booking
              </button>
            </div>
          )}

          {cancelMessage && (
            <div className="alert alert-success mt-3 mb-0" role="status">
              {cancelMessage}
            </div>
          )}
          {cancelError && !showCancelDialog && (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              {cancelError}
            </div>
          )}

          <hr />

          {/* Price breakdown */}
          <h2>Price breakdown</h2>

          {perUnit ? (
            hasBreakdown ? (
              <div className="booking-price-row">
                <span>
                  {usd(details.unitPrice)} × {quantity} {unitNoun}
                </span>
                <span>{usd(details.unitPrice * quantity)}</span>
              </div>
            ) : (
              <p className="text-secondary small">
                A detailed breakdown isn't available for this booking.
              </p>
            )
          ) : hasBreakdown ? (
            prices.map(([label, amount]) => (
              <div className="booking-price-row" key={label}>
                <span>{label}</span>
                <span>{amount === null ? "—" : usd(amount)}</span>
              </div>
            ))
          ) : (
            <p className="text-secondary small">
              A detailed breakdown isn't available for this booking.
            </p>
          )}

          <div className="booking-price-row booking-price-total">
            <strong>Total</strong>
            <strong>{usd(booking.total_amount)}</strong>
          </div>

          {/* Additional notes */}
          {notes && (
            <details className="booking-notes">
              <summary>Additional notes</summary>
              <p>{notes}</p>
            </details>
          )}

          <div className="booking-detail-actions no-print">
            {details.servicePath && (
              <Link
                to={details.servicePath}
                className="btn btn-outline-primary"
              >
                View {details.bookingType}
              </Link>
            )}
            {isTransportation && (
              <Link to="/transportation" className="btn btn-outline-primary">
                Find more transport
              </Link>
            )}
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => window.print()}
            >
              Print this booking
            </button>
          </div>
        </div>
      </div>
      <hr />

      <h2>Booking progress</h2>

      {["cancelled", "rejected"].includes(statusKey) ? (
        <div className="alert alert-secondary mt-3">
          This booking is {statusKey}. The normal booking progress has stopped.
        </div>
      ) : (
        <div className="booking-timeline">
          {[
            {
              title: "Booking submitted",
              description: "Your reservation has been received.",
              done: Boolean(booking.booking_date),
              current: statusKey === "pending",
            },
            {
              title: "Booking confirmed",
              description: "The agency has approved your reservation.",
              done: ["confirmed", "completed"].includes(statusKey),
              current: false,
            },
            {
              title: "Payment completed",
              description:
                payment?.status?.toLowerCase() === "paid"
                  ? "Your payment has been verified."
                  : payment
                    ? `Payment status: ${titleCase(payment.status)}.`
                    : "Complete payment after your booking is confirmed.",
              done: payment?.status?.toLowerCase() === "paid",
              current:
                statusKey === "confirmed" &&
                payment?.status?.toLowerCase() !== "paid",
            },
            {
              title: "Trip completed",
              description: "Enjoy your experience with TovNa!",
              done: statusKey === "completed",
              current: false,
            },
          ].map((step, index) => (
            <div
              className={`booking-timeline-step ${
                step.done ? "is-done" : ""
              } ${step.current ? "is-current" : ""}`}
              key={step.title}
            >
              <div className="booking-timeline-marker">
                {step.done ? "✓" : index + 1}
              </div>

              <div className="booking-timeline-content">
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <hr />

      <h2>Payment information</h2>

      {paymentLoadStatus === "loading" && (
        <p className="text-secondary">Loading payment information...</p>
      )}

      {paymentLoadStatus === "error" && (
        <div className="alert alert-warning">
          {paymentError || "Payment information is temporarily unavailable."}
        </div>
      )}

      {paymentLoadStatus === "ready" && !payment && (
        <div className="booking-payment-empty">
          <p className="mb-2">
            No payment has been created for this booking yet.
          </p>

          {statusKey === "confirmed" ? (
            <>
              <p className="text-secondary small">
                Your booking is confirmed. You can proceed with payment from My
                Bookings.
              </p>

              <Link to="/my-bookings" className="btn btn-primary no-print">
                Go to My Bookings to Pay
              </Link>
            </>
          ) : (
            <p className="text-secondary small mb-0">
              Payment will become available after your booking is confirmed.
            </p>
          )}
        </div>
      )}

      {paymentLoadStatus === "ready" && payment && (
        <div className="booking-payment-card">
          <div className="booking-payment-header">
            <div>
              <span>Payment ID</span>
              <strong>#{payment.id}</strong>
            </div>

            <span
              className={`booking-status ${String(
                payment.status || "pending",
              ).toLowerCase()}`}
            >
              {titleCase(payment.status)}
            </span>
          </div>

          <div className="booking-detail-grid">
            <div>
              <span>Payment amount</span>
              <strong>{usd(payment.amount)}</strong>
            </div>

            <div>
              <span>Payment method</span>
              <strong>{payment.method || "—"}</strong>
            </div>

            <div>
              <span>Transaction reference</span>
              <strong>
                {payment.transaction_reference || "Not submitted"}
              </strong>
            </div>

            <div>
              <span>Payment date</span>
              <strong>{formatDateTime(payment.paid_at)}</strong>
            </div>
          </div>

          {payment.status?.toLowerCase() === "pending" && (
            <p className="text-warning small mb-0">
              Your payment is waiting for verification by the TovNa team.
            </p>
          )}
        </div>
      )}

      {/* Cancellation confirmation. Uses the same pop-up as the rest of the site (Escape and outside click close it). */}
      {showCancelDialog && (
        <Modal title="Cancel this booking?" onClose={closeDialog} size="">
          <div className="p-4">
            <h2 className="h4 fw-bold">Cancel this booking?</h2>

            <p className="mt-3">
              Are you sure you want to cancel your booking for{" "}
              <strong>{details.title}</strong>? This can't be undone.
            </p>

            <p className="text-secondary small mb-0">
              Booking reference: {booking.booking_reference || `#${booking.id}`}
            </p>

            {cancelError && (
              <div
                className="alert alert-danger py-2 small mt-3 mb-0"
                role="alert"
              >
                {cancelError}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeDialog}
                disabled={cancelling}
              >
                Keep booking
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={cancelling}
                onClick={async () => {
                  if (await handleCancelBooking()) setShowCancelDialog(false);
                }}
              >
                {cancelling ? "Cancelling..." : "Confirm cancellation"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
