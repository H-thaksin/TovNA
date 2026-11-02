import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import { useApiList } from "../lib/hooks";
import { usd } from "../lib/pricing";
import "./Transportation.css";

const MAX_PASSENGERS = 20;

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

const todayISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const titleCase = (text) =>
  String(text || "").replace(/^\w/, (c) => c.toUpperCase());

const formatDay = (iso) => {
  if (!iso) return "Not specified";

  const date = new Date(`${iso}T00:00:00`);

  if (Number.isNaN(date.getTime())) return String(iso);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

function formatDuration(minutes) {
  const total = Number(minutes);

  if (!Number.isFinite(total) || total <= 0) return null;

  const rounded = Math.round(total);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;

  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;

  return `${hours} hr ${rest} min`;
}

const isActive = (item) => item.is_active !== false;

export default function Transportation() {
  const {
    data: transportations,
    status: transportationStatus,
    retry: retryTransportations,
  } = useApiList("/transportations/");

  const {
    data: destinations,
    status: destinationStatus,
    retry: retryDestinations,
  } = useApiList("/destinations/");

  const [params, setParams] = useSearchParams();

  // Booking modal state
  const [selectedService, setSelectedService] = useState(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingPassengers, setBookingPassengers] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const setParam = (key, value, fallback = "") => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        if (!value || value === fallback) {
          next.delete(key);
        } else {
          next.set(key, value);
        }

        return next;
      },
      { replace: true },
    );
  };

  const today = todayISO();

  const requestedType = params.get("type") ?? "all";
  const requestedSort = params.get("sort") ?? "price-asc";
  const requestedDate = params.get("date") ?? "";

  const travelDate = requestedDate >= today ? requestedDate : "";

  const requestedPassengers = Number(params.get("passengers")) || 1;

  const passengers = Math.min(
    MAX_PASSENGERS,
    Math.max(1, Math.floor(requestedPassengers)),
  );

  const destinationNames = useMemo(
    () =>
      new Map(
        destinations.map((destination) => [
          Number(destination.id),
          destination.name,
        ]),
      ),
    [destinations],
  );

  const activeServices = useMemo(
    () => transportations.filter(isActive),
    [transportations],
  );

  const optionsFor = (field) =>
    [
      ...new Set(
        activeServices
          .map((item) => Number(item[field]))
          .filter(Number.isFinite),
      ),
    ]
      .filter((id) => destinationNames.has(id))
      .map((id) => ({
        id,
        name: destinationNames.get(id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  const fromOptions = useMemo(
    () => optionsFor("from_destination_id"),
    [activeServices, destinationNames],
  );

  const toOptions = useMemo(
    () => optionsFor("to_destination_id"),
    [activeServices, destinationNames],
  );

  const typeOptions = useMemo(
    () =>
      [
        ...new Set(
          activeServices
            .map((item) => String(item.type || "").toLowerCase())
            .filter(Boolean),
        ),
      ].sort(),
    [activeServices],
  );

  const type = typeOptions.includes(requestedType) ? requestedType : "all";

  const sortOptions = ["price-asc", "price-desc", "duration-asc"];

  const sort = sortOptions.includes(requestedSort)
    ? requestedSort
    : "price-asc";

  const fromId = fromOptions.some(
    (option) => String(option.id) === params.get("from"),
  )
    ? params.get("from")
    : "";

  const toId = toOptions.some(
    (option) => String(option.id) === params.get("to"),
  )
    ? params.get("to")
    : "";

  const results = useMemo(() => {
    const matches = activeServices.filter((item) => {
      const matchesFrom =
        !fromId || Number(item.from_destination_id) === Number(fromId);

      const matchesTo =
        !toId || Number(item.to_destination_id) === Number(toId);

      const matchesType =
        type === "all" || String(item.type || "").toLowerCase() === type;

      return matchesFrom && matchesTo && matchesType;
    });

    return [...matches].sort((a, b) => {
      if (sort === "price-desc") {
        return Number(b.price) - Number(a.price);
      }

      if (sort === "duration-asc") {
        const durationA = Number(a.duration_minutes);
        const durationB = Number(b.duration_minutes);

        const validA = Number.isFinite(durationA) && durationA > 0;
        const validB = Number.isFinite(durationB) && durationB > 0;

        if (!validA && !validB) return 0;
        if (!validA) return 1;
        if (!validB) return -1;

        return durationA - durationB;
      }

      return Number(a.price) - Number(b.price);
    });
  }, [activeServices, fromId, toId, type, sort]);

  const prices = results
    .map((item) => Number(item.price))
    .filter((price) => Number.isFinite(price) && price >= 0);

  const durations = results
    .map((item) => Number(item.duration_minutes))
    .filter((duration) => Number.isFinite(duration) && duration > 0);

  const cheapestPrice = prices.length ? Math.min(...prices) : null;
  const fastestTime = durations.length ? Math.min(...durations) : null;

  const loading =
    transportationStatus === "loading" || destinationStatus === "loading";

  const hasError = transportationStatus === "error";

  const namesFailed = destinationStatus === "error" && !hasError;

  const isFiltering = Boolean(
    fromId || toId || type !== "all" || travelDate || passengers > 1,
  );

  const retry = () => {
    if (transportationStatus === "error") {
      retryTransportations();
    }

    if (destinationStatus === "error") {
      retryDestinations();
    }
  };

  const swapRoute = () => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        if (toId) next.set("from", toId);
        else next.delete("from");

        if (fromId) next.set("to", fromId);
        else next.delete("to");

        return next;
      },
      { replace: true },
    );
  };

  const nameOf = (id) =>
    destinationNames.get(Number(id)) || "Unknown destination";

  function openBooking(item) {
    setSelectedService(item);
    setBookingDate(travelDate || today);
    setBookingPassengers(passengers);
    setBookingError("");
    setBookingSuccess(null);
  }

  function closeBooking() {
    if (bookingLoading) return;

    setSelectedService(null);
    setBookingError("");
    setBookingSuccess(null);
  }

  async function confirmBooking(event) {
    event.preventDefault();

    if (!selectedService || bookingLoading) return;

    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setBookingError("Please log in to your TovNa account before booking.");
      return;
    }

    if (!bookingDate || bookingDate < today) {
      setBookingError("Please choose a valid travel date.");
      return;
    }

    if (
      !Number.isInteger(bookingPassengers) ||
      bookingPassengers < 1 ||
      bookingPassengers > MAX_PASSENGERS
    ) {
      setBookingError("Please select between 1 and 20 passengers.");
      return;
    }

    setBookingLoading(true);
    setBookingError("");

    try {
      const baseUrl = API_URL.replace(/\/+$/, "");

      const response = await fetch(`${baseUrl}/bookings/transportation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transportation_id: selectedService.id,
          travel_date: bookingDate,
          passengers: bookingPassengers,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);

        throw new Error("Your session has expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(readError(data) || "Unable to create your booking.");
      }

      const booking = data.booking ?? data;

      setBookingSuccess(booking);
    } catch (error) {
      setBookingError(
        error instanceof TypeError
          ? "Cannot connect to the server. Please try again."
          : error.message || "Booking failed. Please try again.",
      );
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <div className="transport-page">
      <section className="transport-hero">
        <div className="container">
          <span className="transport-eyebrow">EXPLORE CAMBODIA</span>

          <h1>Find your way around Cambodia</h1>

          <p>
            Compare bus and van services, discover routes, and find
            transportation that fits your trip and budget.
          </p>
        </div>
      </section>

      <section className="container transport-content">
        <div className="transport-heading">
          <div>
            <h2>Available transportation</h2>
            <p>Choose your route and compare available services.</p>
          </div>

          {!loading && !hasError && (
            <span className="transport-count" aria-live="polite">
              {results.length} {results.length === 1 ? "service" : "services"}
            </span>
          )}
        </div>

        <div className="transport-filters">
          <div className="transport-field">
            <label htmlFor="transport-from">From</label>

            <select
              id="transport-from"
              value={fromId}
              onChange={(event) => setParam("from", event.target.value)}
            >
              <option value="">All starting points</option>

              {fromOptions.map((destination) => (
                <option
                  key={destination.id}
                  value={destination.id}
                  disabled={String(destination.id) === toId}
                >
                  {destination.name}
                </option>
              ))}
            </select>
          </div>

          <div className="transport-field">
            <div className="transport-label-row">
              <label htmlFor="transport-to">To</label>

              <button
                type="button"
                className="transport-swap"
                onClick={swapRoute}
                disabled={!fromId && !toId}
              >
                ⇄ Swap
              </button>
            </div>

            <select
              id="transport-to"
              value={toId}
              onChange={(event) => setParam("to", event.target.value)}
            >
              <option value="">All destinations</option>

              {toOptions.map((destination) => (
                <option
                  key={destination.id}
                  value={destination.id}
                  disabled={String(destination.id) === fromId}
                >
                  {destination.name}
                </option>
              ))}
            </select>
          </div>

          <div className="transport-field">
            <label htmlFor="transport-type">Transport type</label>

            <select
              id="transport-type"
              value={type}
              onChange={(event) => setParam("type", event.target.value, "all")}
            >
              <option value="all">All types</option>

              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="transport-field">
            <label htmlFor="transport-sort">Sort by</label>

            <select
              id="transport-sort"
              value={sort}
              onChange={(event) =>
                setParam("sort", event.target.value, "price-asc")
              }
            >
              <option value="price-asc">Lowest price</option>
              <option value="price-desc">Highest price</option>
              <option value="duration-asc">Shortest journey</option>
            </select>
          </div>

          <div className="transport-field">
            <label htmlFor="transport-date">Travel date</label>

            <input
              id="transport-date"
              type="date"
              min={today}
              value={travelDate}
              onChange={(event) => setParam("date", event.target.value)}
            />
          </div>

          <div className="transport-field">
            <span className="transport-label" id="transport-passengers-label">
              Passengers
            </span>

            <div
              className="transport-stepper"
              role="group"
              aria-labelledby="transport-passengers-label"
            >
              <button
                type="button"
                aria-label="Fewer passengers"
                disabled={passengers <= 1}
                onClick={() =>
                  setParam("passengers", String(passengers - 1), "1")
                }
              >
                −
              </button>

              <output aria-live="polite">{passengers}</output>

              <button
                type="button"
                aria-label="More passengers"
                disabled={passengers >= MAX_PASSENGERS}
                onClick={() =>
                  setParam("passengers", String(passengers + 1), "1")
                }
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            className="transport-reset"
            onClick={() => setParams({}, { replace: true })}
            disabled={!isFiltering && sort === "price-asc"}
          >
            Reset filters
          </button>
        </div>

        {travelDate && (
          <p className="transport-summary">
            Travelling on <strong>{formatDay(travelDate)}</strong>
            {" · "}
            {passengers} {passengers === 1 ? "passenger" : "passengers"}
          </p>
        )}

        {namesFailed && (
          <div className="alert alert-warning" role="alert">
            Some place names couldn't be loaded.{" "}
            <button
              type="button"
              className="btn btn-link p-0 align-baseline"
              onClick={retry}
            >
              Try again
            </button>
          </div>
        )}

        {loading && (
          <div
            className="transport-list"
            role="status"
            aria-label="Loading transportation services"
          >
            <div className="transport-skeleton" />
            <div className="transport-skeleton" />
            <div className="transport-skeleton" />
          </div>
        )}

        {hasError && (
          <div className="transport-message transport-error" role="alert">
            <p>
              We couldn't load transportation data. Check that the server is
              running, then try again.
            </p>

            <button type="button" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {!loading && !hasError && activeServices.length === 0 && (
          <div className="transport-message">
            <h3>No transportation services yet</h3>
            <p>Check back soon. New routes are added regularly.</p>
          </div>
        )}

        {!loading &&
          !hasError &&
          activeServices.length > 0 &&
          results.length === 0 && (
            <div className="transport-message">
              <h3>No services found</h3>

              <p>
                There are no services for this route yet. Try changing your
                route or filters.
              </p>

              <button
                type="button"
                className="transport-reset"
                onClick={() => setParams({}, { replace: true })}
              >
                Reset filters
              </button>
            </div>
          )}

        {!loading && !hasError && results.length > 0 && (
          <div className="transport-list">
            {results.map((item) => {
              const kind = String(item.type || "").toLowerCase();
              const duration = formatDuration(item.duration_minutes);
              const price = Number(item.price);

              const validPrice = Number.isFinite(price) && price >= 0;

              const isCheapest =
                results.length > 1 &&
                cheapestPrice !== null &&
                validPrice &&
                price === cheapestPrice;

              const itemDuration = Number(item.duration_minutes);

              const isFastest =
                results.length > 1 &&
                fastestTime !== null &&
                Number.isFinite(itemDuration) &&
                itemDuration > 0 &&
                itemDuration === fastestTime;

              return (
                <article className="transport-card" key={item.id}>
                  <div className="transport-card-main">
                    <div className="transport-icon" aria-hidden="true">
                      {TYPE_ICONS[kind] ?? "🚌"}
                    </div>

                    <div className="transport-route">
                      <div className="transport-route-label">
                        {nameOf(item.from_destination_id)}
                        <span aria-hidden="true"> → </span>
                        <span className="visually-hidden">to </span>
                        {nameOf(item.to_destination_id)}
                      </div>

                      <div className="transport-meta">
                        {kind && <span>{titleCase(kind)}</span>}

                        <span>{item.provider || "Transport provider"}</span>

                        {duration && <span>{duration}</span>}

                        {isCheapest && (
                          <span className="transport-badge transport-badge--price">
                            Lowest price
                          </span>
                        )}

                        {isFastest && (
                          <span className="transport-badge transport-badge--fast">
                            Fastest
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="transport-description">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="transport-price">
                    <span>Price per person</span>

                    <strong>
                      {validPrice ? usd(price) : "Price unavailable"}
                    </strong>

                    <small>
                      {passengers}{" "}
                      {passengers === 1 ? "passenger" : "passengers"}
                    </small>

                    <span>Estimated total</span>

                    <strong>
                      {validPrice ? usd(price * passengers) : "Unavailable"}
                    </strong>

                    <button
                      type="button"
                      className="btn btn-primary transport-book-button"
                      onClick={() => openBooking(item)}
                      disabled={!validPrice}
                    >
                      Book Now
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedService && (
        <div
          className="transport-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeBooking();
            }
          }}
        >
          <section
            className="transport-booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transport-booking-title"
          >
            <button
              type="button"
              className="transport-modal-close"
              onClick={closeBooking}
              disabled={bookingLoading}
              aria-label="Close booking form"
            >
              ×
            </button>

            {bookingSuccess ? (
              <>
                <h2 id="transport-booking-title">Booking received!</h2>

                <p>
                  Your transportation booking has been submitted. Please check
                  the status below.
                </p>

                <div className="transport-confirmation">
                  <p>
                    <strong>Booking reference</strong>
                    <br />
                    <code>
                      {bookingSuccess.booking_reference || "Not provided"}
                    </code>
                  </p>

                  <p>
                    <strong>Route</strong>
                    <br />
                    {bookingSuccess.from_destination ||
                      nameOf(selectedService.from_destination_id)}
                    {" → "}
                    {bookingSuccess.to_destination ||
                      nameOf(selectedService.to_destination_id)}
                  </p>

                  <p>
                    <strong>Travel date:</strong>{" "}
                    {formatDay(bookingSuccess.travel_date || bookingDate)}
                  </p>

                  <p>
                    <strong>Passengers:</strong>{" "}
                    {bookingSuccess.passengers ?? bookingPassengers}
                  </p>

                  <p>
                    <strong>Total:</strong>{" "}
                    {bookingSuccess.total_amount != null
                      ? usd(Number(bookingSuccess.total_amount))
                      : usd(Number(selectedService.price) * bookingPassengers)}
                  </p>

                  <p>
                    <strong>Status:</strong>{" "}
                    {bookingSuccess.status || "Submitted"}
                  </p>
                </div>

                <div className="transport-success-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      closeBooking();
                      window.location.href = "/my-bookings";
                    }}
                  >
                    My Bookings
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={closeBooking}
                  >
                    Back to Transportation
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="transport-booking-title">Confirm your trip</h2>

                <p className="transport-modal-route">
                  {nameOf(selectedService.from_destination_id)}
                  {" → "}
                  {nameOf(selectedService.to_destination_id)}
                </p>

                <p>
                  {titleCase(selectedService.type)}
                  {" · "}
                  {selectedService.provider || "Transport provider"}
                </p>

                <form onSubmit={confirmBooking}>
                  <div className="transport-field">
                    <label htmlFor="booking-travel-date">Travel date</label>

                    <input
                      id="booking-travel-date"
                      type="date"
                      min={today}
                      value={bookingDate}
                      onChange={(event) => setBookingDate(event.target.value)}
                      required
                    />
                  </div>

                  <div className="transport-field">
                    <label htmlFor="booking-passengers">Passengers</label>

                    <select
                      id="booking-passengers"
                      value={bookingPassengers}
                      onChange={(event) =>
                        setBookingPassengers(Number(event.target.value))
                      }
                      required
                    >
                      {Array.from(
                        { length: MAX_PASSENGERS },
                        (_, index) => index + 1,
                      ).map((count) => (
                        <option key={count} value={count}>
                          {count} {count === 1 ? "passenger" : "passengers"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="transport-modal-total">
                    <span>
                      {usd(Number(selectedService.price) * bookingPassengers)}{" "}
                      total
                    </span>

                    <small>
                      {usd(Number(selectedService.price))} per passenger
                    </small>
                  </div>

                  {bookingError && (
                    <p className="transport-booking-error" role="alert">
                      {bookingError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={bookingLoading}
                  >
                    {bookingLoading ? "Booking..." : "Confirm booking"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
