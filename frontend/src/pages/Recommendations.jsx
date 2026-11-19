import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApiList } from "../lib/hooks";
import { postJson } from "../lib/api";
import { SafeImage } from "../components/ui";
import { articlePath } from "../components/cards";

const INTEREST_OPTIONS = ["Beach", "Nature", "Food & Culture", "Sightseeing"];
const STYLE_OPTIONS = ["Relaxing", "Adventure", "Cultural", "City exploration"];

// What the API says about the return journey (estimated_cost.return_basis).
const RETURN_LABELS = {
  return_route: "Round trip available",
  assumed_same_as_outbound: "Return fare estimated",
  return_unavailable: "No return transport",
  one_way_only: "One way only",
  not_needed: "No travel needed",
  unavailable: "No transport route yet",
};

const formatUSD = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return "N/A";

  return `US$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDuration = (minutes) => {
  if (minutes == null || !Number.isFinite(Number(minutes))) return "N/A";

  const total = Math.round(Number(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

// Transport types that have their own badge colour (see the CSS). Anything
// else falls back to a neutral badge, and the key is always a safe class name.
const TRANSPORT_KEYS = ["bus", "van", "ferry", "boat", "train"];

function getTransportKey(type) {
  const key = String(type || "")
    .trim()
    .toLowerCase();
  return TRANSPORT_KEYS.includes(key) ? key : "other";
}

// "Battambang → Phnom Penh → Kep"
function getRouteLine(route) {
  const legs = route?.legs;
  if (!legs?.length) return null;

  return [legs[0].from_name, ...legs.map((leg) => leg.to_name)]
    .filter(Boolean)
    .join(" → ");
}

// What to say when there is no outbound route to show.
function getOutboundNote(cost) {
  if (cost.transportation_status === "not_needed") {
    return "You are already here, so no travel is needed.";
  }
  if (cost.transportation_status === "unavailable") {
    return "No transport route from your starting location has been added yet.";
  }
  return "Route details are not available.";
}

// What to say when there is no return route to show.
function getReturnNote(cost) {
  switch (cost.return_basis) {
    case "assumed_same_as_outbound":
      return "No return route is saved yet, so the return fare is estimated to match the outbound fare.";
    case "return_unavailable":
      return "No return route was found, so the round-trip cost is incomplete.";
    case "one_way_only":
      return "This estimate covers one way only.";
    case "not_needed":
      return "You are already here, so no travel is needed.";
    case "unavailable":
      return "No transport route has been added yet.";
    default:
      return "Return details are not available.";
  }
}

// Totals shown under the two routes. The API's own total (estimated_cost.
// transportation) is used, so an estimated return fare is handled correctly.
function getRoundTripSummary(cost) {
  if (cost.transportation_status === "not_needed") {
    return {
      cost: "No travel needed",
      costNote: null,
      time: "No travel needed",
      timeNote: null,
    };
  }

  const outbound = cost.outbound_cost;
  const outboundTime = cost.outbound_estimated_duration_minutes;
  const returnTime = cost.return_estimated_duration_minutes;

  let costText = "Not available";
  let costNote = null;
  if (cost.transportation != null) {
    costText = formatUSD(cost.transportation);
    if (cost.return_basis === "assumed_same_as_outbound") {
      costNote = "The return fare is estimated to match the outbound fare.";
    } else if (cost.return_basis === "one_way_only") {
      costNote = "One way only.";
    }
  } else if (outbound != null) {
    costText = `From ${formatUSD(outbound)}`;
    costNote = "Outbound only. No return fare is available yet.";
  }

  let timeText = "Not available";
  let timeNote = null;
  if (outboundTime != null && returnTime != null) {
    timeText = formatDuration(Number(outboundTime) + Number(returnTime));
  } else if (outboundTime != null) {
    timeText = `About ${formatDuration(outboundTime)} each way`;
    timeNote =
      cost.return_basis === "one_way_only"
        ? "One way only."
        : "The return journey time is not known yet.";
  }

  return { cost: costText, costNote, time: timeText, timeNote };
}

function RouteDetails({ title, route, emptyText }) {
  if (!route?.legs?.length) {
    return (
      <section className="rec-route rec-route--empty" aria-label={title}>
        <h4>{title}</h4>
        <p>{emptyText}</p>
      </section>
    );
  }

  const minutes =
    route.total_estimated_duration_minutes ?? route.total_duration_minutes;
  const transfers = route.transfers ?? route.legs.length - 1;

  return (
    <section className="rec-route" aria-label={title}>
      <h4>{title}</h4>

      <ul className="rec-route-summary">
        <li>
          {transfers === 0
            ? "Direct"
            : `${transfers} ${transfers === 1 ? "transfer" : "transfers"}`}
        </li>
        <li>
          {minutes == null
            ? "Time not available"
            : `About ${formatDuration(minutes)}`}
        </li>
        <li>{formatUSD(route.total_price)}</li>
      </ul>

      <ol className="rec-route-legs">
        {route.legs.map((leg, index) => (
          <li key={leg.id ?? index}>
            <div className="rec-route-leg-heading">
              <strong>
                {leg.from_name} → {leg.to_name}
              </strong>
              <span className="rec-leg-price">{formatUSD(leg.price)}</span>
            </div>

            <div className="rec-leg-meta">
              <span
                className={`rec-transport-badge rec-transport-badge--${getTransportKey(
                  leg.type,
                )}`}
              >
                {leg.type || "Other"}
              </span>
              <span>{leg.provider || "Provider not listed"}</span>
              <span>{formatDuration(leg.duration_minutes)}</span>
            </div>

            {leg.estimated_wait_after_minutes > 0 && (
              <p className="rec-leg-wait">
                Then about {formatDuration(leg.estimated_wait_after_minutes)} of
                waiting
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function budgetInfo(item) {
  if (item.within_budget === true) return ["Within budget", "is-ok"];
  if (item.within_budget === false) return ["Over budget", "is-over"];
  return ["Budget unknown", "is-unknown"];
}

function RecommendationCard({ item, index }) {
  const [showAllReasons, setShowAllReasons] = useState(false);

  const destination = item.destination || {};
  const cost = item.estimated_cost || {};
  const services = item.services || {};
  const [budgetLabel, budgetClass] = budgetInfo(item);

  const score = Math.max(0, Math.min(100, Number(item.score || 0)));
  const reasons = item.reasons || [];
  const visibleReasons = showAllReasons ? reasons : reasons.slice(0, 3);
  const routeLine = getRouteLine(cost.outbound_route);
  const trip = getRoundTripSummary(cost);

  const displayedCost =
    cost.base_total != null
      ? formatUSD(cost.base_total)
      : cost.known_cost != null
        ? `${formatUSD(cost.known_cost)}+`
        : "N/A";

  return (
    <article className="rec-card">
      <div className="rec-card-photo">
        <SafeImage
          src={destination.image_url}
          alt={destination.name || "Cambodia destination"}
          className="rec-card-img"
        />
        <span className="rec-rank">
          {index === 0 ? "Best match" : `#${index + 1}`}
        </span>
        {item.is_preferred && (
          <span className="rec-preferred">Your preferred destination</span>
        )}
      </div>

      <div className="rec-card-body">
        <div className="rec-card-head">
          <div>
            <span className="rec-province">
              {destination.province || "Cambodia"}
            </span>
            <h3>{destination.name || "Unknown destination"}</h3>

            {routeLine && (
              <p className="rec-route-line">
                <span className="visually-hidden">Route: </span>
                {routeLine}
              </p>
            )}
          </div>

          <div
            className="rec-score"
            style={{ "--score": `${score}%` }}
            aria-label={`Match score ${score.toFixed(0)} percent`}
          >
            <strong>{score.toFixed(0)}%</strong>
            <span>match</span>
          </div>
        </div>

        {destination.description && (
          <p className="rec-description">{destination.description}</p>
        )}

        <div className="rec-cost">
          <div>
            <span>Estimated trip cost</span>
            <strong>{displayedCost}</strong>
          </div>
          <span className={`rec-budget ${budgetClass}`}>{budgetLabel}</span>
        </div>

        <dl className="rec-breakdown">
          <div>
            <dt>Hotel</dt>
            <dd>{formatUSD(cost.hotel)}</dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>{formatUSD(cost.transportation)}</dd>
          </div>
          <div>
            <dt>Food</dt>
            <dd>{formatUSD(cost.food)}</dd>
          </div>
          <div>
            <dt>Travel time</dt>
            <dd>{formatDuration(item.travel?.total_minutes)}</dd>
          </div>
        </dl>

        {reasons.length > 0 && (
          <div className="rec-reasons">
            <h4>Why we recommend this place</h4>
            <ul>
              {visibleReasons.map((reason, i) => (
                <li key={`${i}-${reason}`}>{reason}</li>
              ))}
            </ul>
            {reasons.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllReasons((open) => !open)}
              >
                {showAllReasons
                  ? "Show fewer"
                  : `Show ${reasons.length - 3} more`}
              </button>
            )}
          </div>
        )}

        {/* Outbound and return journeys */}
        <details className="rec-journey">
          <summary>Journey details: outbound and return</summary>

          <div className="rec-journey-body">
            <RouteDetails
              title="Outbound journey"
              route={cost.outbound_route}
              emptyText={getOutboundNote(cost)}
            />
            <RouteDetails
              title="Return journey"
              route={cost.return_route}
              emptyText={getReturnNote(cost)}
            />
          </div>

          <p className="rec-journey-note">
            Journey times include estimated waiting between connections. These
            are estimates, not timetables.
          </p>

          <div className="rec-round-trip-summary">
            <h4>Round-trip summary</h4>

            <div className="rec-round-trip-stats">
              <div>
                <span>Total transportation cost</span>
                <strong>{trip.cost}</strong>
                {trip.costNote && <small>{trip.costNote}</small>}
              </div>

              <div>
                <span>Total estimated journey time</span>
                <strong>{trip.time}</strong>
                {trip.timeNote && <small>{trip.timeNote}</small>}
              </div>
            </div>
          </div>
        </details>

        <div className="rec-foot">
          <ul className="rec-services" aria-label="Available services">
            <li>{services.hotels ?? 0} hotels</li>
            <li>{services.tours ?? 0} tours</li>
            <li>{services.activities ?? 0} activities</li>
            <li>{RETURN_LABELS[cost.return_basis] ?? "Transport unknown"}</li>
          </ul>

          {destination.id && (
            <Link
              to={articlePath("destinations", destination)}
              className="btn btn-primary"
            >
              Explore destination
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Recommendations() {
  const {
    data: destinations,
    status: destinationStatus,
    retry: retryDestinations,
  } = useApiList("/destinations/");

  const activeDestinations = useMemo(
    () => destinations.filter((item) => item.is_active !== false),
    [destinations],
  );

  const [form, setForm] = useState({
    starting_location_id: "",
    budget_per_person: "100",
    travel_days: "3",
    interests: ["Beach"],
    travel_style: "Relaxing",
    preferred_destination_id: "",
    room_sharing: "1",
    include_over_budget: false,
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resultsRef = useRef(null);

  // Bring the results into view once they arrive.
  useEffect(() => {
    if (results) resultsRef.current?.scrollIntoView({ block: "start" });
  }, [results]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function toggleInterest(interest) {
    setForm((previous) => {
      const selected = previous.interests.includes(interest);

      return {
        ...previous,
        interests: selected
          ? previous.interests.filter((item) => item !== interest)
          : [...previous.interests, interest],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.interests.length === 0) {
      setError("Please select at least one travel interest.");
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);

    const payload = {
      starting_location_id: Number(form.starting_location_id),
      budget_per_person: Number(form.budget_per_person),
      travel_days: Number(form.travel_days),
      interests: form.interests,
      travel_style: form.travel_style,
      preferred_destination_id: form.preferred_destination_id
        ? Number(form.preferred_destination_id)
        : null,
      room_sharing: Number(form.room_sharing),
      include_starting_location: false,
      include_over_budget: form.include_over_budget,
    };

    try {
      const data = await postJson("/recommendations/?limit=10", payload);
      setResults(data);
    } catch (err) {
      setError(err.message || "Unable to get recommendations.");
    } finally {
      setLoading(false);
    }
  }

  const formDisabled =
    destinationStatus !== "ready" || activeDestinations.length === 0;

  return (
    <div className="rec-page">
      {/* ---------- Hero ---------- */}
      <header className="rec-hero">
        <div className="container">
          <span className="rec-eyebrow">Smart travel planner</span>
          <h1>Find your perfect destination</h1>
          <p>
            Tell us about your trip and TovNa will recommend places to explore
            in Cambodia that fit your interests and budget.
          </p>
        </div>
      </header>

      {/* ---------- Questionnaire ---------- */}
      <section className="container rec-content">
        <form className="rec-form" onSubmit={handleSubmit}>
          {destinationStatus === "loading" && (
            <p className="rec-note" role="status">
              Loading destinations...
            </p>
          )}

          {destinationStatus === "error" && (
            <div className="alert alert-danger" role="alert">
              Unable to load destinations.{" "}
              <button
                type="button"
                className="btn btn-link p-0 align-baseline"
                onClick={retryDestinations}
              >
                Try again
              </button>
            </div>
          )}

          {destinationStatus === "ready" && activeDestinations.length === 0 && (
            <div className="alert alert-warning">
              No active destinations are available yet.
            </div>
          )}

          {/* Step 1 */}
          <fieldset className="rec-step">
            <legend>
              <span>1</span> Your trip
            </legend>

            <div className="rec-grid">
              <div className="rec-field">
                <label htmlFor="starting-location">Starting location</label>
                <select
                  id="starting-location"
                  name="starting_location_id"
                  value={form.starting_location_id}
                  onChange={updateField}
                  required
                  disabled={formDisabled}
                >
                  <option value="">Choose your starting location</option>
                  {activeDestinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rec-field">
                <label htmlFor="budget">Budget per person</label>
                <div className="rec-money">
                  <span aria-hidden="true">$</span>
                  <input
                    id="budget"
                    name="budget_per_person"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.budget_per_person}
                    onChange={updateField}
                    required
                  />
                  <small>USD</small>
                </div>
              </div>

              <div className="rec-field">
                <label htmlFor="travel-days">Travel duration</label>
                <select
                  id="travel-days"
                  name="travel_days"
                  value={form.travel_days}
                  onChange={updateField}
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((days) => (
                    <option key={days} value={days}>
                      {days} {days === 1 ? "day" : "days"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rec-field">
                <label htmlFor="room-sharing">Room sharing</label>
                <select
                  id="room-sharing"
                  name="room_sharing"
                  value={form.room_sharing}
                  onChange={updateField}
                >
                  {[1, 2, 3, 4].map((people) => (
                    <option key={people} value={people}>
                      {people} {people === 1 ? "person" : "people"} per room
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Step 2 */}
          <fieldset className="rec-step">
            <legend>
              <span>2</span> Your travel style
            </legend>

            <div className="rec-choices" role="radiogroup">
              {STYLE_OPTIONS.map((style) => (
                <label key={style} className="rec-choice">
                  <input
                    type="radio"
                    name="travel_style"
                    value={style}
                    checked={form.travel_style === style}
                    onChange={updateField}
                  />
                  <span>{style}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Step 3 */}
          <fieldset className="rec-step">
            <legend>
              <span>3</span> What are you interested in?
            </legend>
            <p className="rec-note">Select one or more interests.</p>

            <div className="rec-choices">
              {INTEREST_OPTIONS.map((interest) => (
                <label key={interest} className="rec-choice">
                  <input
                    type="checkbox"
                    checked={form.interests.includes(interest)}
                    onChange={() => toggleInterest(interest)}
                  />
                  <span>{interest}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Step 4 */}
          <fieldset className="rec-step">
            <legend>
              <span>4</span> Anything else? <em>Optional</em>
            </legend>

            <div className="rec-grid">
              <div className="rec-field">
                <label htmlFor="preferred-destination">
                  Preferred destination
                </label>
                <select
                  id="preferred-destination"
                  name="preferred_destination_id"
                  value={form.preferred_destination_id}
                  onChange={updateField}
                >
                  <option value="">No preference</option>
                  {activeDestinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="rec-toggle">
                <input
                  type="checkbox"
                  name="include_over_budget"
                  checked={form.include_over_budget}
                  onChange={updateField}
                />
                <span>Include destinations that may exceed my budget</span>
              </label>
            </div>
          </fieldset>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary rec-submit"
            disabled={loading || formDisabled}
          >
            {loading ? "Finding destinations..." : "Find my recommendations"}
          </button>
        </form>

        {/* ---------- Loading ---------- */}
        {loading && (
          <div
            className="rec-results"
            role="status"
            aria-label="Finding destinations"
          >
            {[0, 1].map((key) => (
              <div className="rec-skeleton" key={key}>
                <div className="rec-skeleton-photo" />
                <div className="rec-skeleton-body">
                  <div className="rec-skeleton-line" />
                  <div className="rec-skeleton-line rec-skeleton-line--short" />
                  <div className="rec-skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- Results ---------- */}
        {results && (
          <section className="rec-results-section" ref={resultsRef}>
            <div className="rec-results-head">
              <h2>Recommended destinations</h2>
              <ul className="rec-summary" aria-label="Your search">
                <li>
                  From {results.starting_location?.name || "your location"}
                </li>
                <li>{results.travel_days} days</li>
                <li>{formatUSD(results.budget_per_person)} per person</li>
                <li>{results.total_candidates ?? 0} matches</li>
              </ul>
            </div>

            {results.recommendations?.length > 0 ? (
              <div className="rec-results">
                {results.recommendations.map((item, index) => (
                  <RecommendationCard
                    key={item.destination?.id ?? index}
                    item={item}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="rec-empty">
                <h3>No destinations matched</h3>
                <p>
                  Try raising your budget, changing your travel style, or
                  choosing more interests.
                </p>
              </div>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
