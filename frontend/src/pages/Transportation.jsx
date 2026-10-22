import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

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

const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

const titleCase = (text) =>
  String(text || "").replace(/^\w/, (c) => c.toUpperCase());

const formatDay = (iso) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T00:00:00`));

// "95" -> "1 hr 35 min". Returns null when the duration is missing or invalid.
function formatDuration(minutes) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return null;

  const hours = Math.floor(total / 60);
  const rest = Math.round(total % 60);

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

  // The search lives in the address bar, e.g. /transportation?from=1&to=2&passengers=3.
  // That makes a search shareable, keeps it after a refresh, and lets other pages link straight to a route.
  const [params, setParams] = useSearchParams();

  const setParam = (key, value, fallback = "") =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (!value || value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const today = todayISO();
  const type = params.get("type") ?? "all";
  const sort = params.get("sort") ?? "price-asc";
  const requestedDate = params.get("date") ?? "";
  const travelDate = requestedDate >= today ? requestedDate : ""; // ignore dates in the past
  const passengers = Math.min(
    MAX_PASSENGERS,
    Math.max(1, Number(params.get("passengers")) || 1),
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

  // Only offer places that really appear in a route, so choices never lead to an empty result.
  const optionsFor = (field) =>
    [...new Set(activeServices.map((item) => Number(item[field])))]
      .filter((id) => destinationNames.has(id))
      .map((id) => ({ id, name: destinationNames.get(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));

  const fromOptions = useMemo(
    () => optionsFor("from_destination_id"),
    [activeServices, destinationNames],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const toOptions = useMemo(
    () => optionsFor("to_destination_id"),
    [activeServices, destinationNames],
  ); // eslint-disable-line react-hooks/exhaustive-deps

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

  // An unknown id in the address (for example an old link) is treated as "not chosen".
  const fromId = fromOptions.some((o) => String(o.id) === params.get("from"))
    ? params.get("from")
    : "";
  const toId = toOptions.some((o) => String(o.id) === params.get("to"))
    ? params.get("to")
    : "";

  const results = useMemo(() => {
    const matches = activeServices.filter((item) => {
      const matchesFrom =
        !fromId || Number(item.from_destination_id) === Number(fromId);
      const matchesTo =
        !toId || Number(item.to_destination_id) === Number(toId);
      const matchesType =
        type === "all" || String(item.type).toLowerCase() === type;
      return matchesFrom && matchesTo && matchesType;
    });

    return [...matches].sort((a, b) => {
      if (sort === "price-desc") return Number(b.price) - Number(a.price);
      if (sort === "duration-asc")
        return Number(a.duration_minutes) - Number(b.duration_minutes);
      return Number(a.price) - Number(b.price);
    });
  }, [activeServices, fromId, toId, type, sort]);

  // Badges for the best choices among the results on screen.
  const cheapestPrice = results.length
    ? Math.min(...results.map((item) => Number(item.price)))
    : null;
  const fastestTime = results.length
    ? Math.min(
        ...results
          .map((item) => Number(item.duration_minutes))
          .filter((n) => n > 0),
      )
    : null;

  const loading =
    transportationStatus === "loading" || destinationStatus === "loading";
  const hasError = transportationStatus === "error";
  const namesFailed = destinationStatus === "error" && !hasError;

  const isFiltering = Boolean(
    fromId || toId || type !== "all" || travelDate || passengers > 1,
  );

  const retry = () => {
    if (transportationStatus === "error") retryTransportations();
    if (destinationStatus === "error") retryDestinations();
  };

  const swapRoute = () => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        const from = fromId;
        const to = toId;
        if (to) next.set("from", to);
        else next.delete("from");
        if (from) next.set("to", from);
        else next.delete("to");
        return next;
      },
      { replace: true },
    );
  };

  const nameOf = (id) =>
    destinationNames.get(Number(id)) || "Unknown destination";

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
            Travelling on <strong>{formatDay(travelDate)}</strong> ·{" "}
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
              const isCheapest = results.length > 1 && price === cheapestPrice;
              const isFastest =
                results.length > 1 &&
                Number(item.duration_minutes) === fastestTime;

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
                        <span className="visually-hidden"> to </span>
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
                    <strong>{usd(price)}</strong>
                    <small>
                      {passengers}{" "}
                      {passengers === 1 ? "passenger" : "passengers"}
                    </small>
                    <span>Estimated total</span>
                    <strong>{usd(price * passengers)}</strong>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
