import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { API_URL, TOKEN_KEY, fetchJson, readError } from "../lib/api";
import { SafeImage } from "../components/ui";

const endpoints = {
  destinations: "/destinations/",
  tours: "/tours/",
  activities: "/activities/",
};

const categoryNames = {
  destinations: "Destinations",
  tours: "Travel tours",
  activities: "Activities",
};

const getTodayISO = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatUSD = (amount) =>
  `$${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function RelatedCard({ item, type }) {
  const isTour = type === "tours";
  const duration = isTour
    ? item.duration_days != null
      ? `${item.duration_days} days`
      : null
    : item.duration_hours != null
      ? `${item.duration_hours} hours`
      : null;

  const path = `/articles/${type}/${item.id}`;

  return (
    <article className="tovna-related-card">
      <Link
        to={path}
        className="tovna-related-image-link"
        aria-label={`View ${item.name}`}
      >
        <SafeImage
          src={item.image_url}
          alt={item.name}
          className="tovna-related-image"
        />
      </Link>

      <div className="tovna-related-body">
        <span className="tovna-related-type">
          {isTour ? "Travel tour" : item.category || "Activity"}
        </span>

        <h3>
          <Link to={path}>{item.name}</Link>
        </h3>

        {duration && <p className="tovna-related-duration">{duration}</p>}

        {item.description && (
          <p className="tovna-related-description">{item.description}</p>
        )}

        <div className="tovna-related-bottom">
          <strong>{formatUSD(item.price)}</strong>
          <div className="d-flex gap-2">
            <Link to={path} className="btn btn-outline-primary btn-sm">
              View details
            </Link>
            <Link to={`${path}#booking`} className="btn btn-primary btn-sm">
              Book now
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ArticlePage({ onLogin }) {
  const { type, id } = useParams();
  const { hash } = useLocation();

  const [article, setArticle] = useState(null);
  const [status, setStatus] = useState("loading");

  const [relatedTours, setRelatedTours] = useState([]);
  const [relatedActivities, setRelatedActivities] = useState([]);
  const [relatedStatus, setRelatedStatus] = useState("idle");

  const [bookingDate, setBookingDate] = useState(getTodayISO);
  const [participants, setParticipants] = useState(1);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);

  const today = getTodayISO();
  const isBookableType = type === "tours" || type === "activities";
  const isTour = type === "tours";

  useEffect(() => {
    let cancelled = false;

    async function loadArticle() {
      if (!endpoints[type]) {
        setArticle(null);
        setStatus("error");
        return;
      }

      setStatus("loading");
      setArticle(null);
      setRelatedTours([]);
      setRelatedActivities([]);
      setRelatedStatus(type === "destinations" ? "loading" : "idle");

      setBookingDate(getTodayISO());
      setParticipants(1);
      setMessage("");
      setCreatedBooking(null);

      try {
        const data = await fetchJson(`${endpoints[type]}${id}`);

        // Older API versions return a message instead of an HTTP 404.
        if (!data?.name) {
          throw new Error("Travel item not found.");
        }

        if (!cancelled) {
          setArticle(data);
          setStatus("ready");
        }

        // Load related services only for destination pages.
        if (type === "destinations") {
          const [toursResult, activitiesResult] = await Promise.allSettled([
            fetchJson("/tours/"),
            fetchJson("/activities/"),
          ]);

          if (!cancelled) {
            if (toursResult.status === "fulfilled") {
              const tours = Array.isArray(toursResult.value)
                ? toursResult.value
                : [];

              setRelatedTours(
                tours.filter(
                  (tour) =>
                    Number(tour.destination_id) === Number(id) &&
                    tour.is_active !== false,
                ),
              );
            }

            if (activitiesResult.status === "fulfilled") {
              const activities = Array.isArray(activitiesResult.value)
                ? activitiesResult.value
                : [];

              setRelatedActivities(
                activities.filter(
                  (activity) => Number(activity.destination_id) === Number(id),
                ),
              );
            }

            setRelatedStatus(
              toursResult.status === "rejected" &&
                activitiesResult.status === "rejected"
                ? "error"
                : "ready",
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Could not load article:", error);
          setStatus("error");
        }
      }
    }

    loadArticle();

    return () => {
      cancelled = true;
    };
  }, [type, id]);

  // "Book now" on a related card opens this page at #booking.
  useEffect(() => {
    if (status !== "ready" || !hash) return;
    document
      .getElementById(hash.slice(1))
      ?.scrollIntoView({ behavior: "smooth" });
  }, [status, hash]);

  const showMessage = (text, kind = "info") => {
    setMessage(text);
    setMessageType(kind);
  };

  const handleBooking = async () => {
    if (submitting) return;

    if (!article || !isBookableType) {
      showMessage("Booking information is unavailable.", "danger");
      return;
    }

    if (article.is_active === false) {
      showMessage(
        "This service is currently unavailable for booking.",
        "warning",
      );
      return;
    }

    if (!bookingDate || bookingDate < today) {
      showMessage("Please select today or a future date.", "danger");
      return;
    }

    if (
      !Number.isInteger(participants) ||
      participants < 1 ||
      participants > 50
    ) {
      showMessage("Please select between 1 and 50 participants.", "danger");
      return;
    }

    if (
      isTour &&
      article.max_people != null &&
      participants > Number(article.max_people)
    ) {
      showMessage(
        `This tour allows a maximum of ${article.max_people} participants.`,
        "danger",
      );
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
      const endpoint = isTour ? "/bookings/tours" : "/bookings/activities";

      const body = isTour
        ? {
            tour_id: Number(article.id),
            tour_date: bookingDate,
            participants,
          }
        : {
            activity_id: Number(article.id),
            activity_date: bookingDate,
            participants,
          };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
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

      const booking = result.booking || result;

      setCreatedBooking(booking);
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

  if (status === "loading") {
    return (
      <div className="container section text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3">Loading travel story...</p>
      </div>
    );
  }

  if (status === "error" || !article) {
    return (
      <section className="section text-center">
        <div className="container">
          <h1 className="fw-bold">Story not found</h1>
          <p className="text-secondary">We couldn't find this travel story.</p>
          <Link to="/articles" className="btn btn-primary">
            Explore stories
          </Link>
        </div>
      </section>
    );
  }

  const category =
    type === "destinations"
      ? article.province || "Destination"
      : type === "tours"
        ? "Travel tour"
        : article.category || "Activity";

  const metadata =
    type === "destinations"
      ? article.best_time
        ? `Best time to visit: ${article.best_time}`
        : null
      : isTour
        ? article.duration_days != null
          ? `${article.duration_days} days`
          : null
        : article.duration_hours != null
          ? `${article.duration_hours} hours`
          : null;

  const durationText =
    isTour && article.duration_days != null
      ? `${article.duration_days} days`
      : !isTour && article.duration_hours != null
        ? `${article.duration_hours} hours`
        : null;

  const hasCoordinates = article.latitude != null && article.longitude != null;

  const hasPrice =
    isBookableType &&
    article.price != null &&
    Number.isFinite(Number(article.price));

  const unitPrice = hasPrice ? Number(article.price) : 0;
  const totalPrice = unitPrice * participants;

  const participantLabel = isTour ? "Travelers" : "Participants";

  return (
    <article className="tovna-article">
      <header className="tovna-hero">
        <SafeImage
          src={article.image_url}
          alt={article.name || "Travel destination"}
          className="tovna-hero-img"
        />

        <div className="tovna-hero-overlay" />

        <div className="tovna-hero-content">
          <Link to="/articles" className="tovna-hero-back">
            ← All travel stories
          </Link>

          <p className="tovna-hero-kicker">
            {categoryNames[type]}
            {article.province && type !== "destinations"
              ? ` · ${article.province}`
              : ""}
          </p>

          <span className="tovna-badge-static">{category}</span>
          <h1>{article.name}</h1>

          {metadata && <p className="tovna-hero-meta">{metadata}</p>}
        </div>
      </header>

      <div className="tovna-article-column">
        <nav className="tovna-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/articles">Stories</Link>
          <span>/</span>
          <Link to={`/articles/${type}`}>{categoryNames[type]}</Link>
          <span>/</span>
          <span aria-current="page">{article.name}</span>
        </nav>

        <p className="tovna-lede">{article.description}</p>

        {/* Destination facts and map */}
        {type === "destinations" && (article.province || article.best_time) && (
          <dl className="tovna-facts">
            {article.province && (
              <div>
                <dt>Province</dt>
                <dd>{article.province}</dd>
              </div>
            )}
            {article.best_time && (
              <div>
                <dt>Best time to visit</dt>
                <dd>{article.best_time}</dd>
              </div>
            )}
          </dl>
        )}

        {type === "destinations" && hasCoordinates && (
          <>
            <div className="tovna-map">
              <iframe
                title={`Map of ${article.name}`}
                src={`https://www.google.com/maps?q=${article.latitude},${article.longitude}&z=14&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a
              className="btn btn-outline-primary mt-3"
              href={`https://www.google.com/maps?q=${article.latitude},${article.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps ↗
            </a>
          </>
        )}

        {/* Tour and activity price and facts */}
        {hasPrice && (
          <div className="tovna-article-price">
            <span className="tovna-price-label">
              {isTour ? "Tour price" : "Activity price"}
            </span>
            <p>
              <strong>{formatUSD(article.price)}</strong>
              <span> per {isTour ? "person" : "participant"}</span>
            </p>
          </div>
        )}

        {isBookableType &&
          (durationText ||
            (isTour && article.max_people != null) ||
            (!isTour && article.category)) && (
            <dl className="tovna-facts">
              {durationText && (
                <div>
                  <dt>Duration</dt>
                  <dd>{durationText}</dd>
                </div>
              )}
              {isTour && article.max_people != null && (
                <div>
                  <dt>Group size</dt>
                  <dd>Up to {article.max_people} travelers</dd>
                </div>
              )}
              {!isTour && article.category && (
                <div>
                  <dt>Category</dt>
                  <dd>{article.category}</dd>
                </div>
              )}
            </dl>
          )}

        {/* Related tours and activities for a destination */}
        {type === "destinations" && (
          <section className="tovna-related-section" id="things-to-do">
            <div className="tovna-related-heading">
              <span className="tovna-section-kicker">Explore this area</span>
              <h2>Things to do in {article.name}</h2>
              <p>
                Discover tours and activities connected to this destination.
              </p>
            </div>

            {relatedStatus === "loading" && (
              <p className="text-secondary">Finding related experiences...</p>
            )}

            {relatedStatus === "error" && (
              <p className="text-secondary">
                Related experiences are temporarily unavailable.
              </p>
            )}

            {relatedStatus === "ready" &&
              relatedTours.length === 0 &&
              relatedActivities.length === 0 && (
                <p className="text-secondary">
                  There are no tours or activities listed for this destination
                  yet.
                </p>
              )}

            {relatedTours.length > 0 && (
              <div className="tovna-related-group">
                <h3>Available tours</h3>
                <div className="tovna-related-grid">
                  {relatedTours.map((tour) => (
                    <RelatedCard key={tour.id} item={tour} type="tours" />
                  ))}
                </div>
              </div>
            )}

            {relatedActivities.length > 0 && (
              <div className="tovna-related-group">
                <h3>Activities</h3>
                <div className="tovna-related-grid">
                  {relatedActivities.map((activity) => (
                    <RelatedCard
                      key={activity.id}
                      item={activity}
                      type="activities"
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Booking form for tours and activities */}
        {isBookableType && (
          <section className="tovna-booking-section" id="booking">
            <div className="tovna-booking-heading">
              <span className="tovna-section-kicker">Plan your experience</span>
              <h2>Book this {isTour ? "tour" : "activity"}</h2>
              <p>
                Choose your date and number of {participantLabel.toLowerCase()}{" "}
                to review your total.
              </p>
            </div>

            <div className="tovna-booking-card">
              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="experience-date" className="form-label">
                    {isTour ? "Travel date" : "Activity date"}
                  </label>
                  <input
                    id="experience-date"
                    type="date"
                    className="form-control"
                    min={today}
                    value={bookingDate}
                    onChange={(event) => {
                      setBookingDate(event.target.value);
                      setCreatedBooking(null);
                      setMessage("");
                    }}
                  />
                </div>

                <div className="col-md-6">
                  <label
                    htmlFor="experience-participants"
                    className="form-label"
                  >
                    {participantLabel}
                  </label>
                  <select
                    id="experience-participants"
                    className="form-select"
                    value={participants}
                    onChange={(event) => {
                      setParticipants(Number(event.target.value));
                      setCreatedBooking(null);
                      setMessage("");
                    }}
                  >
                    {Array.from(
                      {
                        length: Math.max(
                          1,
                          Math.min(
                            50,
                            isTour && article.max_people != null
                              ? Number(article.max_people)
                              : 50,
                          ),
                        ),
                      },
                      (_, index) => index + 1,
                    ).map((number) => (
                      <option key={number} value={number}>
                        {number}{" "}
                        {isTour
                          ? number === 1
                            ? "traveler"
                            : "travelers"
                          : number === 1
                            ? "participant"
                            : "participants"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tovna-booking-total">
                <div>
                  <span>Price per person</span>
                  <strong>{formatUSD(unitPrice)}</strong>
                </div>
                <div>
                  <span>{participantLabel}</span>
                  <strong>× {participants}</strong>
                </div>
                <div className="tovna-booking-grand-total">
                  <span>Total price</span>
                  <strong>{formatUSD(totalPrice)}</strong>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-accent btn-lg w-100"
                onClick={handleBooking}
                disabled={
                  submitting ||
                  Boolean(createdBooking) ||
                  !hasPrice ||
                  article.is_active === false
                }
              >
                {submitting
                  ? "Creating booking..."
                  : createdBooking
                    ? "Booking created"
                    : `Book this ${isTour ? "tour" : "activity"}`}
              </button>

              {article.is_active === false && (
                <p className="text-warning small mt-3 mb-0">
                  This service is currently unavailable for booking.
                </p>
              )}

              {message && (
                <div
                  className={`alert alert-${messageType} small mt-3 mb-0`}
                  role={messageType === "danger" ? "alert" : "status"}
                >
                  {message}
                </div>
              )}
            </div>

            {createdBooking && (
              <section className="tovna-booking-confirmation">
                <h3>Booking confirmation</h3>
                <p>
                  Reference:{" "}
                  <strong>
                    {createdBooking.booking_reference || "Created successfully"}
                  </strong>
                </p>
                <p>
                  {isTour ? "Tour" : "Activity"}: {article.name}
                </p>
                <p>Date: {bookingDate}</p>
                <p>
                  {participantLabel}: {participants}
                </p>
                <p>
                  Total:{" "}
                  {formatUSD(
                    createdBooking.total_amount ??
                      createdBooking.total ??
                      totalPrice,
                  )}
                </p>
                <p>
                  Status: <strong>{createdBooking.status || "pending"}</strong>{" "}
                  <span className="text-secondary small">
                    (we'll confirm it shortly)
                  </span>
                </p>
                <Link to="/my-bookings" className="btn btn-primary">
                  View my bookings
                </Link>
              </section>
            )}
          </section>
        )}

        <div className="tovna-article-divider" />

        <div className="tovna-article-footer">
          <p>Ready for your next adventure?</p>
          <Link to={`/articles/${type}`} className="btn btn-outline-primary">
            Explore more {categoryNames[type].toLowerCase()}
          </Link>
        </div>
      </div>
    </article>
  );
}
