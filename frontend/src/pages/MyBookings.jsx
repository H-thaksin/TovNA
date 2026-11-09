import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import { SafeImage } from "../components/ui";
import { usd } from "../lib/pricing";
import "./PaymentModal.css";
import { ABA_KHQR } from "../lib/payment";

/* ------------------------------ Helpers ------------------------------ */

function getNoteValue(notes, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = (notes || "").match(
    new RegExp(`(?:^|;)\\s*${escaped}:\\s*([^;]+)`, "i"),
  );
  return match ? match[1].trim() : "";
}

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

const TYPE_LABELS = {
  hotel: "Hotels",
  transportation: "Transport",
  tour: "Tours",
  activity: "Activities",
};

const SERVICE_LINK_LABELS = {
  hotel: "View hotel",
  tour: "View tour",
  activity: "View activity",
};

function getBookingType(b) {
  if (b.transportation_id != null) return "transportation";
  if (b.tour_id != null) return "tour";
  if (b.activity_id != null) return "activity";
  return "hotel";
}

function getServicePath(b) {
  if (b.bookingType === "hotel" && b.hotel_id != null)
    return `/hotels/${b.hotel_id}`;
  if (b.bookingType === "tour" && b.tour_id != null)
    return `/articles/tours/${b.tour_id}`;
  if (b.bookingType === "activity" && b.activity_id != null)
    return `/articles/activities/${b.activity_id}`;
  return null;
}

function normalize(booking) {
  const bookingType = getBookingType(booking);
  const isTransportation = bookingType === "transportation";
  const isExperience = bookingType === "tour" || bookingType === "activity";

  const serviceDateRaw = booking.items?.[0]?.service_date || "";
  const checkInRaw =
    booking.check_in ||
    getNoteValue(booking.notes, "Check-in") ||
    (bookingType === "hotel" ? serviceDateRaw : "");
  const checkOutRaw =
    booking.check_out || getNoteValue(booking.notes, "Check-out");
  const travelDateRaw = getNoteValue(booking.notes, "Travel date");

  const startRaw = isTransportation
    ? travelDateRaw
    : isExperience
      ? serviceDateRaw
      : checkInRaw;

  const titles = {
    transportation: `${booking.from_destination || "Departure"} → ${booking.to_destination || "Destination"}`,
    tour: booking.tour_name || "Tour booking",
    activity: booking.activity_name || "Activity booking",
    hotel: booking.hotel_name || "Hotel booking",
  };

  return {
    ...booking,
    bookingType,
    checkInRaw,
    checkOutRaw,
    travelDateRaw,
    serviceDateRaw,
    start: parseDate(startRaw),
    end: parseDate(checkOutRaw),
    passengers: Number(getNoteValue(booking.notes, "Passengers")) || 0,
    participants: Number(booking.participants) || 0,
    nights:
      Number(booking.nights ?? getNoteValue(booking.notes, "Nights")) || 0,
    statusKey: String(booking.status || "unknown").toLowerCase(),
    title: titles[bookingType],
    image: booking.hotel_image || booking.tour_image || booking.activity_image,
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

function paymentStatusLabel(status) {
  const labels = {
    pending: "Payment pending",
    paid: "Paid",
    failed: "Payment failed",
    refunded: "Refunded",
  };
  return labels[status] || titleCase(status);
}

// One place for the token, headers and error handling of payment calls.
async function callPaymentApi(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!response.ok) {
    const error = new Error(readError(data));
    error.status = response.status;
    throw error;
  }

  return data;
}

/* ------------------------------ Payment Modal ------------------------------ */

function PaymentModal({
  booking,
  payment,
  onClose,
  onPaymentCreated,
  onReferenceSubmitted,
  onConflict,
}) {
  const [method, setMethod] = useState("ABA KHQR");
  const [reference, setReference] = useState(
    payment?.transaction_reference || "",
  );
  const [createdPayment, setCreatedPayment] = useState(payment || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qrFailed, setQrFailed] = useState(false);

  // Escape closes the window and the page behind it stops scrolling.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose();
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onClose]);

  async function createPayment() {
    setBusy(true);
    setError("");

    try {
      const data = await callPaymentApi("/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ booking_id: booking.id, method }),
      });

      // Stay open so the customer sees what to do next.
      setCreatedPayment(data.payment);
      onPaymentCreated(data.payment);
    } catch (err) {
      if (err.status === 409) {
        // A payment already exists (for example created in another tab).
        onConflict(err.message);
        return;
      }

      setError(err.message || "Unable to create payment.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReference() {
    setBusy(true);
    setError("");

    try {
      const data = await callPaymentApi(
        `/payments/${createdPayment.id}/reference`,
        {
          method: "PATCH",
          body: JSON.stringify({ transaction_reference: reference.trim() }),
        },
      );

      onReferenceSubmitted(data.payment);
      onClose();
    } catch (err) {
      setError(err.message || "Unable to submit transaction reference.");
    } finally {
      setBusy(false);
    }
  }

  const hasCreatedPayment = Boolean(createdPayment);
  const isAba = createdPayment?.method === "ABA KHQR";
  const savedReference = createdPayment?.transaction_reference || "";
  const referenceUnchanged = reference.trim() === savedReference;

  return (
    <div
      className="payment-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        <div className="payment-modal-header">
          <div>
            <h2 id="payment-modal-title">
              {hasCreatedPayment
                ? "Complete your payment"
                : "Choose payment method"}
            </h2>
            <p>Booking {booking.booking_reference || `#${booking.id}`}</p>
          </div>

          <button
            type="button"
            className="payment-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close payment window"
          >
            ×
          </button>
        </div>

        <div className="payment-modal-body">
          <div className="payment-order-total">
            <span>Booking total</span>
            <strong>{usd(booking.total_amount)}</strong>
          </div>

          {!hasCreatedPayment ? (
            <>
              <h3>Select a payment method</h3>

              <label
                className={`payment-method-option ${method === "ABA KHQR" ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value="ABA KHQR"
                  checked={method === "ABA KHQR"}
                  onChange={(e) => setMethod(e.target.value)}
                />
                <span className="payment-method-icon">📱</span>
                <span>
                  <strong>ABA KHQR</strong>
                  <small>Pay using your ABA mobile app</small>
                </span>
              </label>

              <label
                className={`payment-method-option ${method === "Cash" ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value="Cash"
                  checked={method === "Cash"}
                  onChange={(e) => setMethod(e.target.value)}
                />
                <span className="payment-method-icon">💵</span>
                <span>
                  <strong>Cash</strong>
                  <small>Pay cash to the travel agency</small>
                </span>
              </label>

              {method === "ABA KHQR" && (
                <div className="payment-info-note">
                  <strong>ABA KHQR payment</strong>
                  <p>
                    After creating your payment, follow the agency's payment
                    instructions and submit your transaction reference.
                  </p>
                  <p>
                    The official merchant QR code will be displayed here once it
                    has been provided by the agency.
                  </p>
                </div>
              )}

              {method === "Cash" && (
                <div className="payment-info-note">
                  <strong>Cash payment</strong>
                  <p>
                    Your payment will remain pending until the agency receives
                    and verifies your cash payment.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="payment-created-notice">
                <strong>
                  {payment ? "Your payment" : "Payment created successfully"}
                </strong>
                <p>
                  Payment #{createdPayment.id} · {createdPayment.method}
                </p>
                <p>
                  Status: <strong>Pending</strong>
                </p>
              </div>

              {isAba ? (
                <>
                  {/* =====================================
        ABA KHQR CODE
        Hide QR after a reference is saved.
    ===================================== */}
                  {!savedReference && (
                    <div className="payment-qr">
                      {/* Show an error if QR cannot load */}
                      {qrFailed ? (
                        <p className="text-danger">
                          The QR code couldn't be loaded. Please contact the
                          agency to pay.
                        </p>
                      ) : (
                        <>
                          {/* ABA Merchant QR Image */}
                          <img
                            src={ABA_KHQR.image}
                            alt="ABA KHQR code for TovNa"
                            onError={() => setQrFailed(true)}
                          />

                          {/* Save QR image */}
                          <p>
                            <a
                              href={ABA_KHQR.image}
                              download="tovna-aba-khqr.png"
                            >
                              Save QR image
                            </a>{" "}
                            · On a phone, save it, then upload it from your
                            gallery in ABA Mobile.
                          </p>
                        </>
                      )}

                      {/* Payment amount */}
                      <p>
                        Pay <strong>{usd(createdPayment.amount)}</strong> to{" "}
                        <strong>{ABA_KHQR.accountName}</strong>
                      </p>

                      {/* Booking reference for payment remark */}
                      <p>
                        In the remark, write{" "}
                        <code>{booking.booking_reference}</code>
                      </p>
                    </div>
                  )}
                  <div className="payment-info-note">
                    <strong>
                      {savedReference
                        ? "Change your ABA transaction reference"
                        : "Submit your ABA transaction reference"}
                    </strong>
                    <p>
                      Enter the transaction reference shown in your ABA
                      transaction details. The agency will verify it.
                    </p>
                  </div>

                  <label
                    className="payment-reference-label"
                    htmlFor="aba-reference"
                  >
                    ABA transaction reference
                  </label>
                  <input
                    id="aba-reference"
                    className="form-control"
                    type="text"
                    maxLength={100}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Enter transaction reference"
                    autoFocus
                  />
                </>
              ) : (
                <div className="payment-info-note">
                  <strong>Pay in cash</strong>
                  <p>
                    Please pay the travel agency in cash. Your payment stays
                    pending until the agency confirms it.
                  </p>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="payment-modal-footer">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={busy}
          >
            {hasCreatedPayment && !isAba ? "Close" : "Cancel"}
          </button>

          {!hasCreatedPayment ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={createPayment}
              disabled={busy}
            >
              {busy ? "Processing..." : "Continue"}
            </button>
          ) : isAba ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitReference}
              disabled={busy || !reference.trim() || referenceUnchanged}
            >
              {busy
                ? "Submitting..."
                : savedReference
                  ? "Update reference"
                  : "Submit reference"}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ Cards ------------------------------ */

function BookingCard({
  booking,
  payment,
  onCancel,
  cancelling,
  onPay,
  onUpdateReference,
}) {
  const { bookingType } = booking;
  const isTransportation = bookingType === "transportation";
  const isExperience = bookingType === "tour" || bookingType === "activity";
  const transportKind = String(booking.transport_type || "").toLowerCase();
  const isPending = booking.statusKey === "pending";
  const isConfirmed = booking.statusKey === "confirmed";
  const servicePath = getServicePath(booking);

  const hasReference = Boolean(payment?.transaction_reference);

  const canPay = isConfirmed && !payment;

  // The API lets a customer submit or change the reference while pending.
  const canEditReference =
    isConfirmed &&
    payment?.method === "ABA KHQR" &&
    payment.status === "pending";

  // Only say "awaiting verification" when the customer has nothing left to do.
  const awaitingVerification =
    isConfirmed &&
    payment?.status === "pending" &&
    (payment.method === "Cash" || hasReference);

  return (
    <article className="booking-card">
      {isTransportation ? (
        <div className="booking-transport-icon" aria-hidden="true">
          {TYPE_ICONS[transportKind] ?? "🚌"}
        </div>
      ) : (
        <SafeImage
          className="booking-hotel-image"
          src={booking.image}
          alt={booking.title}
        />
      )}

      <div className="booking-card-content">
        <div className="booking-head">
          <h2>
            {servicePath ? (
              <Link to={servicePath}>{booking.title}</Link>
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
          {isTransportation && (
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
          )}

          {isExperience && (
            <>
              <div>
                <dt>
                  {bookingType === "tour" ? "Tour date" : "Activity date"}
                </dt>
                <dd>{formatDate(booking.start, booking.serviceDateRaw)}</dd>
              </div>
              <div>
                <dt>{bookingType === "tour" ? "Travelers" : "Participants"}</dt>
                <dd>{booking.participants || "—"}</dd>
              </div>
            </>
          )}

          {bookingType === "hotel" && (
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

        {payment && (
          <div className="booking-payment-info">
            <div>
              <span>Payment method</span>
              <strong>{payment.method}</strong>
            </div>
            <div>
              <span>Payment status</span>
              <strong className={`payment-status ${payment.status}`}>
                {paymentStatusLabel(payment.status)}
              </strong>
            </div>
            {hasReference && (
              <div>
                <span>Transaction reference</span>
                <code>{payment.transaction_reference}</code>
              </div>
            )}
            {canEditReference && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => onUpdateReference(booking, payment)}
              >
                {hasReference ? "Change reference" : "Submit ABA reference"}
              </button>
            )}
          </div>
        )}

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

            {servicePath && (
              <Link to={servicePath} className="btn btn-outline-primary btn-sm">
                {SERVICE_LINK_LABELS[bookingType]}
              </Link>
            )}

            {canPay && (
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => onPay(booking)}
              >
                Pay Now
              </button>
            )}

            {awaitingVerification && (
              <span className="booking-hint">
                Awaiting payment verification
              </span>
            )}

            {payment?.status === "failed" && (
              <span className="booking-hint">
                Payment failed. Please contact the agency.
              </span>
            )}

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

function BookingGroup({
  title,
  items,
  paymentsByBooking,
  onCancel,
  cancellingId,
  onPay,
  onUpdateReference,
}) {
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
            payment={paymentsByBooking[booking.id] || null}
            onCancel={onCancel}
            cancelling={cancellingId === booking.id}
            onPay={onPay}
            onUpdateReference={onUpdateReference}
          />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function MyBookings({ onLogin, user }) {
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentLoadError, setPaymentLoadError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setLoading(true);
      setError("");
      setPaymentLoadError("");
      setNeedsLogin(false);

      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setBookings([]);
        setPayments([]);
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [bookingResponse, paymentResponse] = await Promise.all([
          fetch(`${API_URL}/bookings/my?limit=200`, {
            headers,
            signal: controller.signal,
          }),
          fetch(`${API_URL}/payments/`, {
            headers,
            signal: controller.signal,
          }),
        ]);

        const bookingData = await bookingResponse.json().catch(() => ({}));
        const paymentData = await paymentResponse.json().catch(() => ({}));

        if (bookingResponse.status === 401 || paymentResponse.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setBookings([]);
          setPayments([]);
          setNeedsLogin(true);
          setError("Your session has expired. Please log in again.");
          return;
        }

        if (!bookingResponse.ok) {
          throw new Error(readError(bookingData));
        }

        setBookings(Array.isArray(bookingData) ? bookingData : []);

        if (paymentResponse.ok) {
          setPayments(Array.isArray(paymentData) ? paymentData : []);
        } else {
          setPayments([]);
          setPaymentLoadError(readError(paymentData));
        }
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

    loadData();

    return () => controller.abort();
  }, [user, attempt]);

  // Success messages dismiss themselves.
  useEffect(() => {
    if (!notice) return undefined;

    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

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
      setAttempt((n) => n + 1);
    }
  }

  function openPayment(booking) {
    setSelectedBooking(booking);
    setSelectedPayment(null);
  }

  function openReferenceForm(booking, payment) {
    setSelectedBooking(booking);
    setSelectedPayment(payment);
  }

  function closePayment() {
    setSelectedBooking(null);
    setSelectedPayment(null);
  }

  function updateLocalPayment(payment) {
    setPayments((current) => {
      const exists = current.some((item) => item.id === payment.id);

      if (exists) {
        return current.map((item) => (item.id === payment.id ? payment : item));
      }

      return [payment, ...current];
    });
  }

  // The payment already exists on the server: show why, then reload.
  function handlePaymentConflict(message) {
    closePayment();
    setActionError(message || "A payment already exists for this booking.");
    setAttempt((n) => n + 1);
  }

  const paymentsByBooking = useMemo(
    () =>
      payments.reduce((result, payment) => {
        result[payment.booking_id] = payment;
        return result;
      }, {}),
    [payments],
  );

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
      <div className="my-bookings-heading">
        <div>
          <h1>My Bookings</h1>
          <p className="my-bookings-intro">
            View and manage your hotel, transport, tour and activity
            reservations.
          </p>
        </div>
      </div>

      {notice && (
        <div
          className="alert alert-success d-flex justify-content-between align-items-center"
          role="status"
        >
          <span>{notice}</span>
          <button
            type="button"
            className="btn-close"
            aria-label="Dismiss"
            onClick={() => setNotice("")}
          />
        </div>
      )}

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

      {paymentLoadError && !loading && (
        <div className="alert alert-warning" role="alert">
          We couldn't load your payment information: {paymentLoadError}
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
            You haven't made any bookings yet. Your reservations will appear
            here.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            <Link to="/tours" className="btn btn-primary">
              Browse tours
            </Link>
            <Link to="/hotels" className="btn btn-outline-primary">
              Browse hotels
            </Link>
            <Link to="/activities" className="btn btn-outline-primary">
              Browse activities
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
                    ...types.map((t) => [t, TYPE_LABELS[t]]),
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
                paymentsByBooking={paymentsByBooking}
                onCancel={cancelBooking}
                cancellingId={cancellingId}
                onPay={openPayment}
                onUpdateReference={openReferenceForm}
              />
              <BookingGroup
                title="Past, cancelled and rejected"
                items={past}
                paymentsByBooking={paymentsByBooking}
                onCancel={cancelBooking}
                cancellingId={cancellingId}
                onPay={openPayment}
                onUpdateReference={openReferenceForm}
              />
            </>
          )}
        </>
      )}

      {selectedBooking && (
        <PaymentModal
          booking={selectedBooking}
          payment={selectedPayment}
          onClose={closePayment}
          onPaymentCreated={updateLocalPayment}
          onReferenceSubmitted={(payment) => {
            // The API already returned the updated payment, so no reload.
            updateLocalPayment(payment);
            setNotice("Your transaction reference was submitted.");
          }}
          onConflict={handlePaymentConflict}
        />
      )}
    </div>
  );
}
