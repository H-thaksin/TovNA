import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import { useApiList } from "../lib/hooks";
import { SafeImage } from "../components/ui";
import { TAX_RATES, priceBreakdown, ratingLabel, usd } from "../lib/pricing";

// Return today's date in YYYY-MM-DD format using local time.
const getTodayISO = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Validate a date string and ensure it represents a real calendar date.
const isValidISODate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

// Format a date for the booking summary.
const formatDay = (date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

// Format a tax rate as a percentage.
const formatPercent = (rate) => `${Math.round(rate * 100)}%`;

export default function HotelBooking({ onLogin }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { data, status, retry } = useApiList("/hotels/");

  // Get today's date.
  const today = getTodayISO();

  // Read the date and number of nights from the URL.
  const requestedCheckIn = searchParams.get("checkIn");
  const requestedNights = Number(searchParams.get("nights"));

  // Validate the requested check-in date.
  const validCheckIn =
    isValidISODate(requestedCheckIn) && requestedCheckIn >= today;

  // Validate the requested number of nights.
  const validNights =
    Number.isInteger(requestedNights) &&
    requestedNights >= 1 &&
    requestedNights <= 14;

  // Set initial booking values.
  const [checkIn, setCheckIn] = useState(() =>
    validCheckIn ? requestedCheckIn : today,
  );

  const [nights, setNights] = useState(() =>
    validNights ? requestedNights : 1,
  );

  // Booking messages and submission state.
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);

  // Find the selected hotel safely.
  const hotel = Array.isArray(data)
    ? data.find((item) => String(item.id) === String(id))
    : undefined;

  // Calculate the stay dates.
  const startDate = new Date(`${checkIn}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + nights);

  // Calculate the price when the hotel is available.
  const price = hotel ? priceBreakdown(hotel.price_per_night, nights) : null;

  // Set a message for the user.
  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  // Create the booking.
  const handleCreateBooking = async () => {
    if (submitting) {
      return;
    }

    if (!hotel) {
      showMessage("Hotel information is unavailable.", "danger");
      return;
    }

    if (!isValidISODate(checkIn) || checkIn < today) {
      showMessage("Please select a valid check-in date.", "danger");
      return;
    }

    if (!Number.isInteger(nights) || nights < 1 || nights > 14) {
      showMessage("Please select between 1 and 14 nights.", "danger");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      showMessage("Please log in before booking.", "warning");
      onLogin?.();
      return;
    }

    setSubmitting(true);
    setMessage("");
    setCreatedBooking(null);

    try {
      const response = await fetch(`${API_URL}/bookings/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hotel_id: Number(hotel.id),
          check_in: checkIn,
          nights,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY);

          showMessage(
            "Your session has expired. Please log in again.",
            "warning",
          );

          onLogin?.();
          return;
        }

        throw new Error(readError(result) || "Could not create your booking.");
      }

      // Ensure the API returned booking confirmation details.
      if (!result.booking) {
        throw new Error(
          "The server did not return booking confirmation details.",
        );
      }

      setCreatedBooking(result.booking);
      showMessage("Your booking has been created successfully.", "success");
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
        "danger",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state.
  if (status === "loading") {
    return (
      <section className="section text-center">
        <div className="container">
          <div
            className="spinner-border text-primary"
            role="status"
            aria-label="Loading hotel details"
          />
          <p className="mt-3">Loading hotel details...</p>
        </div>
      </section>
    );
  }

  // Error state.
  if (status === "error") {
    return (
      <section className="section text-center">
        <div className="container">
          <h1 className="fw-bold">Unable to load hotel</h1>
          <p>
            We couldn't load the hotel details. Please check your connection and
            try again.
          </p>
          <button type="button" className="btn btn-primary" onClick={retry}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  // Hotel not found.
  if (!hotel) {
    return (
      <section className="section text-center">
        <div className="container">
          <h1 className="fw-bold">Hotel not found</h1>
          <p className="text-secondary">
            The hotel you're looking for may no longer be available.
          </p>
          <Link to="/hotels" className="btn btn-primary mt-3">
            Back to hotels
          </Link>
        </div>
      </section>
    );
  }

  const nightsLabel = `${nights} ${nights === 1 ? "night" : "nights"}`;

  return (
    <main className="container bk-page">
      {/* Breadcrumb navigation */}
      <nav className="tovna-breadcrumb" aria-label="Breadcrumb">
        <Link to="/hotels">Hotels</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/hotels/${hotel.id}`}>{hotel.name}</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Booking</span>
      </nav>

      <header className="bk-head">
        <h1 className="bk-title">Review your booking</h1>
        <p>
          Check your stay details and review the total price before confirming
          your reservation.
        </p>
      </header>

      <div className="row g-4 g-lg-5">
        {/* Left column: Hotel and stay details */}
        <div className="col-lg-7">
          <section className="bk-panel bk-summary">
            <SafeImage
              src={hotel.image_url}
              alt={hotel.name}
              className="bk-thumb"
            />

            <div className="bk-summary-text">
              <h2>{hotel.name}</h2>

              {hotel.address && (
                <p className="bk-address">
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" />
                    <circle cx="12" cy="11" r="2" />
                  </svg>
                  {hotel.address}
                </p>
              )}

              {hotel.rating != null && (
                <p className="bk-rating">
                  <span className="bk-score">★ {hotel.rating}</span>
                  <strong>{ratingLabel(hotel.rating)}</strong>
                  {hotel.review_count != null && (
                    <span className="bk-muted">
                      {hotel.review_count} reviews
                    </span>
                  )}
                </p>
              )}
            </div>
          </section>

          {/* Stay details */}
          <section className="bk-panel">
            <h2 className="bk-panel-title">Your stay</h2>

            <div className="row g-3">
              <div className="col-sm-6">
                <label htmlFor="check-in" className="form-label">
                  Check-in date
                </label>

                <input
                  id="check-in"
                  type="date"
                  className="form-control"
                  min={today}
                  value={checkIn}
                  onChange={(event) => {
                    setCheckIn(event.target.value);
                    setCreatedBooking(null);
                    setMessage("");
                  }}
                  required
                />
              </div>

              <div className="col-sm-6">
                <label htmlFor="nights" className="form-label">
                  Number of nights
                </label>

                <select
                  id="nights"
                  className="form-select"
                  value={nights}
                  onChange={(event) => {
                    setNights(Number(event.target.value));
                    setCreatedBooking(null);
                    setMessage("");
                  }}
                >
                  {Array.from({ length: 14 }, (_, index) => index + 1).map(
                    (night) => (
                      <option key={night} value={night}>
                        {night} {night === 1 ? "night" : "nights"}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <p className="bk-dates">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                <path d="M3.5 10h17M8 3v4M16 3v4" />
              </svg>
              {formatDay(startDate)} – {formatDay(endDate)} · {nightsLabel}
            </p>
          </section>
        </div>

        {/* Right column: Price summary */}
        <div className="col-lg-5">
          <aside className="bk-panel bk-price" aria-label="Price details">
            <h2 className="bk-panel-title">Price details</h2>

            <dl className="bk-rows">
              <div className="bk-row">
                <dt>1 room × {nightsLabel}</dt>
                <dd>{usd(price.base)}</dd>
              </div>

              <div className="bk-row">
                <dt>Estimated taxes &amp; fees</dt>
                <dd>{usd(price.taxes)}</dd>
              </div>

              <div className="bk-row bk-row--sub">
                <dt>
                  Accommodation tax ({formatPercent(TAX_RATES.accommodation)})
                </dt>
                <dd>{usd(price.accommodationTax)}</dd>
              </div>

              <div className="bk-row bk-row--sub">
                <dt>VAT ({formatPercent(TAX_RATES.vat)})</dt>
                <dd>{usd(price.vat)}</dd>
              </div>

              <div className="bk-row bk-row--sub">
                <dt>Service charge ({formatPercent(TAX_RATES.service)})</dt>
                <dd>{usd(price.service)}</dd>
              </div>
            </dl>

            <div className="bk-total">
              <span>Total</span>
              <strong>{usd(price.total)}</strong>
            </div>

            <button
              type="button"
              className="btn btn-accent btn-lg w-100"
              onClick={handleCreateBooking}
              disabled={submitting || Boolean(createdBooking)}
            >
              {submitting
                ? "Creating booking..."
                : createdBooking
                  ? "Booking confirmed"
                  : "Confirm booking"}
            </button>

            <p className="bk-note">
              Your booking is submitted as pending and the TovNa team will
              confirm it. You can pay once it is confirmed.
            </p>

            {message && (
              <div
                className={`alert alert-${messageType} small mt-3 mb-0`}
                role={messageType === "danger" ? "alert" : "status"}
              >
                {message}
              </div>
            )}
          </aside>

          {/* Booking confirmation */}
          {createdBooking && (
            <section
              className="bk-confirmation"
              aria-labelledby="booking-confirmation-title"
            >
              <h2 id="booking-confirmation-title">Booking confirmation</h2>

              <dl className="bk-rows">
                <div className="bk-row">
                  <dt>Reference</dt>
                  <dd>{createdBooking.booking_reference}</dd>
                </div>
                <div className="bk-row">
                  <dt>Hotel</dt>
                  <dd>{createdBooking.hotel_name}</dd>
                </div>
                <div className="bk-row">
                  <dt>Total</dt>
                  <dd>{usd(createdBooking.total_amount)}</dd>
                </div>
                <div className="bk-row">
                  <dt>Status</dt>
                  <dd>{createdBooking.status}</dd>
                </div>
              </dl>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
