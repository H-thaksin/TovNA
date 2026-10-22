import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useApiList } from "../lib/hooks";
import { SafeImage } from "../components/ui";
import HotelCard from "../components/HotelCard";
import { priceBreakdown, ratingLabel, usd } from "../lib/pricing";

const MAX_NIGHTS = 14;

const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

const formatDay = (date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

// The API may send plain strings or objects. These read both.
const textOf = (item, keys = ["name"]) =>
  typeof item === "string"
    ? item
    : keys.map((key) => item?.[key]).find(Boolean);

const nearbyText = (item) =>
  typeof item === "string"
    ? item
    : [
        item?.type && `${item.type}:`,
        item?.name,
        item?.distance && `(${item.distance})`,
      ]
        .filter(Boolean)
        .join(" ");

function Notice({ children }) {
  return (
    <section className="section text-center">
      <div className="container">{children}</div>
    </section>
  );
}

export default function HotelDetail() {
  const { id } = useParams();
  const { data, status, retry } = useApiList("/hotels/");

  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [checkIn, setCheckIn] = useState(todayISO);
  const [nights, setNights] = useState(1);

  const hotel = data.find((item) => String(item.id) === id);

  // Browser tab title, e.g. "Angkor Garden Hotel · TovNa"
  useEffect(() => {
    if (!hotel) return;
    const previous = document.title;
    document.title = `${hotel.name} · TovNa`;
    return () => {
      document.title = previous;
    };
  }, [hotel]);

  if (status === "loading") {
    return (
      <Notice>
        <div
          className="spinner-border text-primary"
          role="status"
          aria-label="Loading"
        />
      </Notice>
    );
  }

  if (status === "error") {
    return (
      <Notice>
        <p>
          We couldn't load this hotel. Check that the server is running, then
          try again.
        </p>
        <button type="button" className="btn btn-primary" onClick={retry}>
          Try again
        </button>
      </Notice>
    );
  }

  if (!hotel) {
    return (
      <Notice>
        <h1 className="fw-bold">Hotel not found</h1>
        <Link to="/hotels" className="btn btn-primary mt-3">
          Back to hotels
        </Link>
      </Notice>
    );
  }

  // ----- Data prepared from what the API sends. Every optional part hides itself when its data is missing. -----
  const price = priceBreakdown(hotel.price_per_night, nights);
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + nights);

  const images = [
    ...new Set(
      [
        hotel.image_url,
        ...(Array.isArray(hotel.images)
          ? hotel.images.map((i) => textOf(i, ["url", "image_url"]))
          : []),
      ].filter(Boolean),
    ),
  ];
  const amenities = Array.isArray(hotel.amenities)
    ? hotel.amenities.map((a) => textOf(a)).filter(Boolean)
    : [];
  const visibleAmenities = showAllAmenities ? amenities : amenities.slice(0, 6);
  const reviews = Array.isArray(hotel.reviews) ? hotel.reviews.slice(0, 3) : [];
  const nearby = Array.isArray(hotel.nearby)
    ? hotel.nearby.map(nearbyText).filter(Boolean)
    : [];
  const others = data.filter((item) => item.id !== hotel.id).slice(0, 3);

  const hasCoordinates = hotel.latitude != null && hotel.longitude != null;
  const mapQuery = hasCoordinates
    ? `${hotel.latitude},${hotel.longitude}`
    : `${hotel.name} ${hotel.address ?? ""}`;
  const mapUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${mapQuery}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;

  // The booking page opens with the dates picked here.
  const bookingUrl = `/hotels/${hotel.id}/booking?checkIn=${checkIn}&nights=${nights}`;

  return (
    <div className="container hotel-page hotel-page--padded">
      <nav className="tovna-breadcrumb" aria-label="Breadcrumb">
        <Link to="/hotels">Hotels</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{hotel.name}</span>
      </nav>

      <header className="hotel-head">
        <div>
          <h1>{hotel.name}</h1>
          {hotel.address && (
            <p className="hotel-address">
              {hotel.address} ·{" "}
              <a href={mapUrl} target="_blank" rel="noreferrer">
                Show on map
              </a>
            </p>
          )}
        </div>

        {hotel.rating != null && (
          <div className="hotel-rating">
            <span className="hotel-score hotel-score--lg">{hotel.rating}</span>
            <span>
              <strong>{ratingLabel(hotel.rating)}</strong>
              {hotel.review_count != null && (
                <small>{hotel.review_count} reviews</small>
              )}
            </span>
          </div>
        )}
      </header>

      {/* Photos: one large image, plus thumbnails when the hotel has more than one */}
      <div className="hotel-photo">
        <SafeImage
          src={images[activeImage] ?? hotel.image_url}
          alt={hotel.name}
          eager
        />
      </div>
      {images.length > 1 && (
        <div className="hotel-thumbs" role="group" aria-label="Hotel photos">
          {images.slice(0, 5).map((src, index) => (
            <button
              key={src}
              type="button"
              className={`hotel-thumb ${index === activeImage ? "is-active" : ""}`}
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={index === activeImage}
              onClick={() => setActiveImage(index)}
            >
              <SafeImage src={src} alt="" />
            </button>
          ))}
        </div>
      )}

      {/* Quick highlights, like a booking site */}
      {amenities.length > 0 && (
        <ul className="hotel-chips" aria-label="Highlights">
          {amenities.slice(0, 4).map((name) => (
            <li key={name}>{name}</li>
          ))}
          {amenities.length > 4 && (
            <li>
              <a href="#amenities">+{amenities.length - 4} more</a>
            </li>
          )}
        </ul>
      )}

      <div className="row g-4 g-lg-5 mt-0">
        <div className="col-lg-8">
          {hotel.description && (
            <section className="hotel-block">
              <h2>About this hotel</h2>
              <p>{hotel.description}</p>
            </section>
          )}

          {amenities.length > 0 && (
            <section className="hotel-block" id="amenities">
              <h2>Amenities</h2>
              <ul className="hotel-amenities">
                {visibleAmenities.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              {amenities.length > 6 && (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm mt-3"
                  onClick={() => setShowAllAmenities((open) => !open)}
                >
                  {showAllAmenities
                    ? "Show fewer"
                    : `All amenities (${amenities.length})`}
                </button>
              )}
            </section>
          )}

          {reviews.length > 0 && (
            <section className="hotel-block">
              <h2>What guests say</h2>
              <div className="hotel-reviews">
                {reviews.map((review, index) => (
                  <blockquote key={index}>
                    <p>{textOf(review, ["comment", "text", "review"])}</p>
                    {textOf(review, ["author", "name"]) &&
                      typeof review !== "string" && (
                        <footer>{textOf(review, ["author", "name"])}</footer>
                      )}
                  </blockquote>
                ))}
              </div>
            </section>
          )}

          {nearby.length > 0 && (
            <section className="hotel-block">
              <h2>Surroundings</h2>
              <ul className="hotel-nearby">
                {nearby.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {(hotel.check_in_time || hotel.check_out_time) && (
            <section className="hotel-block">
              <h2>Good to know</h2>
              <dl className="hotel-rows">
                {hotel.check_in_time && (
                  <div>
                    <dt>Check-in</dt>
                    <dd>{hotel.check_in_time}</dd>
                  </div>
                )}
                {hotel.check_out_time && (
                  <div>
                    <dt>Check-out</dt>
                    <dd>{hotel.check_out_time}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <section className="hotel-block">
            <h2>Location</h2>
            <div className="hotel-map">
              <iframe
                title={`Map of ${hotel.name}`}
                src={embedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <p className="mt-2 mb-0">
              <a href={mapUrl} target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
            </p>
          </section>
        </div>

        <div className="col-lg-4">
          <aside className="hotel-price-card" aria-label="Price and booking">
            <span className="badge-highlight">Today's best price</span>
            <p className="hotel-price">
              {usd(hotel.price_per_night)} <small>/ night</small>
            </p>

            <div className="hotel-picker">
              <div>
                <label
                  htmlFor="detail-check-in"
                  className="form-label small mb-1"
                >
                  Check-in
                </label>
                <input
                  id="detail-check-in"
                  type="date"
                  className="form-control"
                  min={todayISO()}
                  value={checkIn}
                  onChange={(event) =>
                    event.target.value && setCheckIn(event.target.value)
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="detail-nights"
                  className="form-label small mb-1"
                >
                  Nights
                </label>
                <select
                  id="detail-nights"
                  className="form-select"
                  value={nights}
                  onChange={(event) => setNights(Number(event.target.value))}
                >
                  {Array.from({ length: MAX_NIGHTS }, (_, i) => i + 1).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <p className="hotel-dates-line">
              {formatDay(start)} – {formatDay(end)} · {nights}{" "}
              {nights === 1 ? "night" : "nights"}
            </p>

            <dl className="hotel-rows">
              <div>
                <dt>
                  {nights} {nights === 1 ? "night" : "nights"}
                </dt>
                <dd>{usd(price.base)}</dd>
              </div>
              <div>
                <dt>Estimated taxes &amp; fees</dt>
                <dd>{usd(price.taxes)}</dd>
              </div>
              <div className="hotel-row-total">
                <dt>Total</dt>
                <dd>{usd(price.total)}</dd>
              </div>
            </dl>

            <Link to={bookingUrl} className="btn btn-accent btn-lg w-100">
              Book now
            </Link>
            <p className="small text-secondary mt-2 mb-0">
              The final price is confirmed when you book.
            </p>
          </aside>
        </div>
      </div>

      {others.length > 0 && (
        <section className="hotel-more">
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-4">
            <h2 className="mb-0">More places to stay</h2>
            <Link to="/hotels">View all hotels →</Link>
          </div>
          <div className="row g-4">
            {others.map((item, index) => (
              <HotelCard key={item.id} hotel={item} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* On phones the price card is far down the page, so the price and button stay in reach */}
      <div className="hotel-sticky-bar d-lg-none">
        <div>
          <strong>{usd(price.total)}</strong>
          <small>
            {" "}
            total · {nights} {nights === 1 ? "night" : "nights"}
          </small>
        </div>
        <Link to={bookingUrl} className="btn btn-accent">
          Book now
        </Link>
      </div>
    </div>
  );
}
