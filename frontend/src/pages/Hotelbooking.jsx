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

  return (
    <main className="container hotel-page">
      {/* Breadcrumb navigation */}
      <nav className="tovna-breadcrumb" aria-label="Breadcrumb">
        <Link to="/hotels">Hotels</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/hotels/${hotel.id}`}>{hotel.name}</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Booking</span>
      </nav>

      <header className="mb-4">
        <h1 className="hotel-booking-title">Review your booking</h1>
        <p className="text-secondary">
          Check your stay details and review the total price before confirming
          your reservation.
        </p>
      </header>

      <div className="row g-4 g-lg-5">
        {/* Left column: Hotel and stay details */}
        <div className="col-lg-7">
          <section className="hotel-panel hotel-summary">
            <SafeImage src={hotel.image_url} alt={hotel.name} />

            <div>
              <h2>{hotel.name}</h2>

              {hotel.address && (
                <p className="text-secondary small mb-2">{hotel.address}</p>
              )}

              {hotel.rating != null && (
                <p className="mb-0">
                  <span className="hotel-score">{hotel.rating}</span>{" "}
                  <strong>{ratingLabel(hotel.rating)}</strong>
                  {hotel.review_count != null && (
                    <span className="text-secondary">
                      {" "}
                      · {hotel.review_count} reviews
                    </span>
                  )}
                </p>
              )}
            </div>
          </section>

          {/* Stay details */}
          <section className="hotel-panel">
            <h2>Your stay</h2>

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

            <p className="hotel-dates">
              {formatDay(startDate)} – {formatDay(endDate)} · {nights}{" "}
              {nights === 1 ? "night" : "nights"}
            </p>
          </section>
        </div>

        {/* Right column: Price summary */}
        <div className="col-lg-5">
          <aside className="hotel-panel hotel-price-card">
            <h2>Price details</h2>

            <dl className="hotel-rows">
              <div>
                <dt>
                  1 room × {nights} {nights === 1 ? "night" : "nights"}
                </dt>
                <dd>{usd(price.base)}</dd>
              </div>

              <div>
                <dt>Estimated taxes &amp; fees</dt>
                <dd>{usd(price.taxes)}</dd>
              </div>

              <div className="hotel-row-sub">
                <dt>
                  Accommodation tax ({formatPercent(TAX_RATES.accommodation)})
                </dt>
                <dd>{usd(price.accommodationTax)}</dd>
              </div>

              <div className="hotel-row-sub">
                <dt>VAT ({formatPercent(TAX_RATES.vat)})</dt>
                <dd>{usd(price.vat)}</dd>
              </div>

              <div className="hotel-row-sub">
                <dt>Service charge ({formatPercent(TAX_RATES.service)})</dt>
                <dd>{usd(price.service)}</dd>
              </div>

              <div className="hotel-row-total">
                <dt>Total</dt>
                <dd>{usd(price.total)}</dd>
              </div>
            </dl>

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
              className="alert alert-success mt-3"
              aria-labelledby="booking-confirmation-title"
            >
              <h2 id="booking-confirmation-title" className="h5">
                Booking confirmation
              </h2>

              <p className="mb-1">
                Reference: <strong>{createdBooking.booking_reference}</strong>
              </p>

              <p className="mb-1">Hotel: {createdBooking.hotel_name}</p>

              <p className="mb-1">Total: {usd(createdBooking.total_amount)}</p>

              <p className="mb-0">
                Status: <strong>{createdBooking.status}</strong>
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
