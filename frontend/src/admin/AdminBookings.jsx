import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminBookings.css";

const STATUSES = ["all", "pending", "confirmed", "rejected", "cancelled"];

// =========================================================
// General helpers
// =========================================================

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCustomerName(booking) {
  const name = [booking.customer_first_name, booking.customer_last_name]
    .filter(Boolean)
    .join(" ");

  return name || `Customer #${booking.user_id}`;
}

function getServiceName(booking) {
  const item = booking.items?.[0];

  if (item) {
    return (
      item.service_name ||
      item.item_name ||
      item.hotel_name ||
      item.transportation_name ||
      item.tour_name ||
      item.activity_name ||
      item.name ||
      item.type ||
      item.item_type ||
      "Booking"
    );
  }

  // Fallback for bookings where service information is stored in notes.
  if (booking.notes) {
    return booking.notes.split(";")[0].trim();
  }

  return "Booking";
}

function formatMoney(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "$0.00";

  return `$${amount.toFixed(2)}`;
}

function getStatusClass(status) {
  return `booking-status booking-status-${String(status || "pending").toLowerCase()}`;
}

// =========================================================
// Booking details helpers
// =========================================================

const SERVICE_META = {
  hotel: {
    label: "Hotel",
    dateLabel: "Check-in",
    qtyLabel: "Nights",
    unit: ["night", "nights"],
  },
  transportation: {
    label: "Transportation",
    dateLabel: "Travel date",
    qtyLabel: "Passengers",
    unit: ["passenger", "passengers"],
  },
  tour: {
    label: "Tour",
    dateLabel: "Tour date",
    qtyLabel: "Participants",
    unit: ["person", "people"],
  },
  activity: {
    label: "Activity",
    dateLabel: "Activity date",
    qtyLabel: "Participants",
    unit: ["person", "people"],
  },
};

const DEFAULT_META = {
  label: "Service",
  dateLabel: "Date",
  qtyLabel: "Quantity",
  unit: ["unit", "units"],
};

// Plain dates ("2026-11-10") are parsed as local time so they don't
// shift by a day depending on the browser's timezone.
function parseDay(value) {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : new Date(value);

  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(text);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(value) {
  const date = parseDay(value);
  if (!date) return "—";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function addDays(value, days) {
  const date = parseDay(value);
  if (!date) return null;

  date.setDate(date.getDate() + days);
  return date;
}

// Notes look like "Hotel: X; Nights: 2; VAT: 20.00; ..."
function parseNotes(notes) {
  const result = {};

  String(notes || "")
    .split(";")
    .forEach((part) => {
      const index = part.indexOf(":");
      if (index === -1) return;

      result[part.slice(0, index).trim().toLowerCase()] = part
        .slice(index + 1)
        .trim();
    });

  return result;
}

function pluralise(count, [singular, plural]) {
  return count === 1 ? singular : plural;
}

function buildPriceBreakdown(booking) {
  const items = booking.items || [];
  const noteValues = parseNotes(booking.notes);

  const lines = [];
  let itemsSubtotal = 0;

  items.forEach((item) => {
    const meta = SERVICE_META[item.service_type] || DEFAULT_META;
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const lineTotal = Number(item.total_price) || 0;

    itemsSubtotal += lineTotal;
    lines.push({
      label: `${item.service_name || meta.label} (${formatMoney(unitPrice)} × ${quantity} ${pluralise(quantity, meta.unit)})`,
      amount: lineTotal,
    });
  });

  // Hotel taxes and charges are stored only in the booking notes.
  const extras = [];
  if (items.some((item) => item.service_type === "hotel")) {
    [
      ["Accommodation tax", "accommodation tax"],
      ["VAT", "vat"],
      ["Service charge", "service charge"],
    ].forEach(([label, key]) => {
      if (noteValues[key] !== undefined) {
        extras.push({ label, amount: Number(noteValues[key]) || 0 });
      }
    });
  }

  const total = Number(booking.total_amount) || 0;

  // If nothing was parsed but the total is higher than the items, show the gap.
  const extrasSum = extras.reduce((sum, extra) => sum + extra.amount, 0);
  const gap = total - itemsSubtotal - extrasSum;
  if (extras.length === 0 && gap > 0.005) {
    extras.push({ label: "Taxes & fees", amount: gap });
  }

  return { lines, extras, total };
}

// =========================================================
// Booking details UI
// =========================================================

function DetailRow({ label, children }) {
  return (
    <div className="bd-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function ServiceCard({ item }) {
  const meta = SERVICE_META[item.service_type] || DEFAULT_META;
  const quantity = Number(item.quantity) || 0;

  return (
    <div className="bd-service">
      {item.image_url && (
        <img
          className="bd-service-image"
          src={item.image_url}
          alt={item.service_name || meta.label}
        />
      )}

      <div className="bd-service-body">
        <span className="bd-service-type">{meta.label}</span>
        <h4>{item.service_name || "Unnamed service"}</h4>

        <div className="bd-rows">
          {item.service_type === "transportation" && (
            <>
              <DetailRow label="Route">
                {item.from_destination || "—"} → {item.to_destination || "—"}
              </DetailRow>
              {item.service_type_name && (
                <DetailRow label="Vehicle type">
                  {item.service_type_name}
                </DetailRow>
              )}
            </>
          )}

          <DetailRow label={meta.dateLabel}>
            {formatDay(item.service_date)}
          </DetailRow>

          {item.service_type === "hotel" && (
            <DetailRow label="Check-out">
              {formatDay(addDays(item.service_date, quantity))}
            </DetailRow>
          )}

          <DetailRow label={meta.qtyLabel}>{quantity}</DetailRow>
        </div>
      </div>
    </div>
  );
}

function BookingDetailsModal({ booking, onClose, onAction, actionLoading }) {
  const items = booking.items || [];
  const price = buildPriceBreakdown(booking);
  const isPending = String(booking.status).toLowerCase() === "pending";

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="booking-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="booking-detail-modal bd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-detail-title"
      >
        {/* Reference + status */}
        <div className="booking-modal-heading">
          <div>
            <h2 id="booking-detail-title">
              {booking.booking_reference || `Booking #${booking.id}`}
            </h2>
            <p>Booked on {formatDate(booking.booking_date)}</p>
          </div>

          <div className="bd-heading-right">
            <span className={getStatusClass(booking.status)}>
              {booking.status}
            </span>
            <button type="button" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>

        {/* Customer */}
        <div className="bd-section">
          <h3>Customer</h3>
          <div className="bd-rows">
            <DetailRow label="Name">{getCustomerName(booking)}</DetailRow>
            <DetailRow label="Email">{booking.customer_email || "—"}</DetailRow>
            <DetailRow label="Customer ID">{booking.user_id}</DetailRow>
            <DetailRow label="Booking ID">{booking.id}</DetailRow>
          </div>
        </div>

        {/* Services */}
        <div className="bd-section">
          <h3>Service details</h3>
          {items.length > 0 ? (
            items.map((item, index) => (
              <ServiceCard key={item.booking_item_id || index} item={item} />
            ))
          ) : (
            <p className="bd-muted">No service items recorded.</p>
          )}
        </div>

        {/* Price breakdown */}
        <div className="bd-section">
          <h3>Price breakdown</h3>
          <div className="bd-price">
            {price.lines.map((line, index) => (
              <div className="bd-price-row" key={`line-${index}`}>
                <span>{line.label}</span>
                <span>{formatMoney(line.amount)}</span>
              </div>
            ))}

            {price.extras.map((extra) => (
              <div className="bd-price-row" key={extra.label}>
                <span>{extra.label}</span>
                <span>{formatMoney(extra.amount)}</span>
              </div>
            ))}

            <div className="bd-price-row bd-price-total">
              <span>Total</span>
              <span>{formatMoney(price.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bd-section">
          <h3>Booking notes</h3>
          <p className="bd-notes">{booking.notes || "No additional notes."}</p>
          <p className="bd-muted">Created {formatDate(booking.created_at)}</p>
        </div>

        {isPending && (
          <div className="booking-modal-actions">
            <button
              type="button"
              className="booking-confirm-btn"
              disabled={actionLoading}
              onClick={() => onAction(booking, "confirm")}
            >
              Confirm Booking
            </button>
            <button
              type="button"
              className="booking-reject-btn"
              disabled={actionLoading}
              onClick={() => onAction(booking, "reject")}
            >
              Reject Booking
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// =========================================================
// Page
// =========================================================

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [notice, setNotice] = useState("");

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem(TOKEN_KEY);

      const response = await fetch(`${API_URL}/bookings?limit=100&offset=0`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(readError(data));
      }

      setBookings(Array.isArray(data) ? data : data.bookings || []);
    } catch (err) {
      setError(err.message || "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const closeDetails = useCallback(() => setSelectedBooking(null), []);

  const counts = useMemo(() => {
    const result = {
      total: bookings.length,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      cancelled: 0,
    };

    bookings.forEach((booking) => {
      const status = String(booking.status || "").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(result, status)) {
        result[status] += 1;
      }
    });

    return result;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesStatus =
        statusFilter === "all" ||
        String(booking.status).toLowerCase() === statusFilter;

      const searchableText = [
        booking.booking_reference,
        booking.customer_first_name,
        booking.customer_last_name,
        booking.customer_email,
        booking.user_id,
        getServiceName(booking),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && searchableText.includes(keyword);
    });
  }, [bookings, search, statusFilter]);

  async function updateBookingStatus(booking, action) {
    const actionLabel = action === "confirm" ? "confirm" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} booking ${booking.booking_reference}?`,
    );

    if (!confirmed) return;

    setActionLoading(booking.id);
    setNotice("");
    setError("");

    try {
      const token = localStorage.getItem(TOKEN_KEY);

      const response = await fetch(
        `${API_URL}/bookings/${booking.id}/${action}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readError(data));
      }

      setNotice(
        `Booking ${booking.booking_reference} was ${actionLabel}ed successfully.`,
      );

      await fetchBookings();

      setSelectedBooking((current) =>
        current?.id === booking.id
          ? {
              ...current,
              status: action === "confirm" ? "confirmed" : "rejected",
            }
          : current,
      );
    } catch (err) {
      setError(err.message || `Unable to ${actionLabel} booking.`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <section className="admin-bookings-page">
      <div className="admin-page-heading">
        <div>
          <h1>Booking Management</h1>
          <p>View and manage customer bookings across TovNa.</p>
        </div>

        <button
          type="button"
          className="booking-refresh-btn"
          onClick={fetchBookings}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {notice && (
        <div className="booking-notice" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="booking-error" role="alert">
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="booking-stat-grid">
        <div className="booking-stat-card">
          <span className="booking-stat-label">Total Bookings</span>
          <strong>{counts.total}</strong>
          <span className="booking-stat-icon">▦</span>
        </div>

        <div className="booking-stat-card pending">
          <span className="booking-stat-label">Pending</span>
          <strong>{counts.pending}</strong>
          <span className="booking-stat-icon">◷</span>
        </div>

        <div className="booking-stat-card confirmed">
          <span className="booking-stat-label">Confirmed</span>
          <strong>{counts.confirmed}</strong>
          <span className="booking-stat-icon">✓</span>
        </div>

        <div className="booking-stat-card rejected">
          <span className="booking-stat-label">Rejected</span>
          <strong>{counts.rejected}</strong>
          <span className="booking-stat-icon">×</span>
        </div>

        <div className="booking-stat-card cancelled">
          <span className="booking-stat-label">Cancelled</span>
          <strong>{counts.cancelled}</strong>
          <span className="booking-stat-icon">−</span>
        </div>
      </div>

      <div className="booking-table-panel">
        <div className="booking-table-heading">
          <div>
            <h2>All Bookings</h2>
            <p>{filteredBookings.length} booking(s) found</p>
          </div>

          <div className="booking-filters">
            <input
              type="search"
              placeholder="Search reference, customer, email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search bookings"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by booking status"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === "all"
                    ? "All statuses"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="booking-empty-state">Loading bookings...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="booking-empty-state">
            No bookings found. Try changing your search or filter.
          </div>
        ) : (
          <div className="booking-table-wrapper">
            <table className="booking-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Booking Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <strong className="booking-reference">
                        {booking.booking_reference || `#${booking.id}`}
                      </strong>
                      <span className="booking-subtext">ID: {booking.id}</span>
                    </td>

                    <td>
                      <strong>{getCustomerName(booking)}</strong>
                      <span className="booking-subtext">
                        {booking.customer_email ||
                          `User ID: ${booking.user_id}`}
                      </span>
                    </td>

                    <td>{getServiceName(booking)}</td>
                    <td>{formatDate(booking.booking_date)}</td>
                    <td className="booking-amount">
                      {formatMoney(booking.total_amount)}
                    </td>

                    <td>
                      <span className={getStatusClass(booking.status)}>
                        {booking.status || "Unknown"}
                      </span>
                    </td>

                    <td>
                      <div className="booking-row-actions">
                        <button
                          type="button"
                          className="booking-view-btn"
                          onClick={() => setSelectedBooking(booking)}
                        >
                          View
                        </button>

                        {String(booking.status).toLowerCase() === "pending" && (
                          <>
                            <button
                              type="button"
                              className="booking-confirm-btn"
                              disabled={actionLoading === booking.id}
                              onClick={() =>
                                updateBookingStatus(booking, "confirm")
                              }
                            >
                              Confirm
                            </button>

                            <button
                              type="button"
                              className="booking-reject-btn"
                              disabled={actionLoading === booking.id}
                              onClick={() =>
                                updateBookingStatus(booking, "reject")
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={closeDetails}
          onAction={updateBookingStatus}
          actionLoading={actionLoading === selectedBooking.id}
        />
      )}
    </section>
  );
}
