import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useApiList } from "../lib/hooks";
import { SafeImage } from "../components/ui";
import { ratingLabel, usd } from "../lib/pricing";

const PRICE_LIMITS = [25, 50, 100, 200, 500];

const SORTS = {
  recommended: { label: "Recommended", fn: null },
  "price-asc": {
    label: "Price: low to high",
    fn: (a, b) => a.price_per_night - b.price_per_night,
  },
  "price-desc": {
    label: "Price: high to low",
    fn: (a, b) => b.price_per_night - a.price_per_night,
  },
  rating: {
    label: "Top rated",
    fn: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  },
};

// The API may send amenities as plain strings or as objects.
const amenityName = (item) => (typeof item === "string" ? item : item?.name);

function HotelRow({ hotel }) {
  const path = `/hotels/${hotel.id}`;
  const amenities = Array.isArray(hotel.amenities)
    ? hotel.amenities.map(amenityName).filter(Boolean)
    : [];
  const hasRating = hotel.rating != null;
  const price = Number(hotel.price_per_night);
  const validPrice = Number.isFinite(price);

  return (
    <article className="ht-card">
      <Link
        to={path}
        className="ht-card-photo"
        aria-label={`View ${hotel.name}`}
      >
        <SafeImage src={hotel.image_url} alt="" className="ht-card-img" />
      </Link>

      <div className="ht-card-body">
        <div className="ht-card-top">
          <h2>
            <Link to={path}>{hotel.name}</Link>
          </h2>

          {hasRating && (
            <div className="ht-rating">
              <span>
                <strong>{ratingLabel(hotel.rating)}</strong>
                {hotel.review_count != null && (
                  <small>{hotel.review_count} reviews</small>
                )}
              </span>
              <span className="ht-score">{hotel.rating}</span>
            </div>
          )}
        </div>

        {hotel.address && <p className="ht-address">{hotel.address}</p>}

        {hotel.description && <p className="ht-text">{hotel.description}</p>}

        {amenities.length > 0 && (
          <ul className="ht-amenities" aria-label="Amenities">
            {amenities.slice(0, 3).map((name) => (
              <li key={name}>{name}</li>
            ))}
            {amenities.length > 3 && <li>+{amenities.length - 3} more</li>}
          </ul>
        )}
      </div>

      <div className="ht-card-price">
        <small>From</small>
        <strong>{validPrice ? usd(price) : "N/A"}</strong>
        <small>per night</small>
        <Link to={path} className="btn btn-primary ht-view-btn">
          View hotel
        </Link>
      </div>
    </article>
  );
}

export default function Hotels() {
  const { data, status, retry } = useApiList("/hotels/");
  const [params, setParams] = useSearchParams();

  const search = params.get("q") ?? "";
  const maxPrice = PRICE_LIMITS.map(String).includes(params.get("max"))
    ? params.get("max")
    : "All";
  const sort = SORTS[params.get("sort")] ? params.get("sort") : "recommended";

  const setParam = (key, value, fallback = "") => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (!value || value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  const hotels = useMemo(
    () => data.filter((hotel) => hotel.is_active !== false),
    [data],
  );

  const filteredHotels = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matches = hotels.filter((hotel) => {
      const matchesSearch =
        !query ||
        hotel.name?.toLowerCase().includes(query) ||
        hotel.address?.toLowerCase().includes(query);

      const matchesPrice =
        maxPrice === "All" || Number(hotel.price_per_night) <= Number(maxPrice);

      return matchesSearch && matchesPrice;
    });

    const compare = SORTS[sort].fn;
    return compare ? [...matches].sort(compare) : matches;
  }, [hotels, search, maxPrice, sort]);

  const isFiltering = search.trim() !== "" || maxPrice !== "All";
  const isReady = status === "ready";
  const noMatches = isReady && hotels.length > 0 && filteredHotels.length === 0;
  const noHotels = isReady && hotels.length === 0;

  const clearFilters = () => setParams({}, { replace: true });

  return (
    <div className="ht-page">
      {/* ---------- Hero ---------- */}
      <header className="ht-hero">
        <div className="container">
          <h1>Hotels</h1>
          <p>Find a place to stay during your Cambodia adventure.</p>
        </div>
      </header>

      <div className="container ht-content">
        {/* ---------- Floating filter bar ---------- */}
        <div className="ht-filters">
          <div className="ht-field ht-field--search">
            <label htmlFor="hotel-search">Search</label>
            <input
              id="hotel-search"
              type="search"
              placeholder="Hotel name or address"
              value={search}
              onChange={(event) => setParam("q", event.target.value)}
            />
          </div>

          <div className="ht-field">
            <label htmlFor="hotel-price">Price per night</label>
            <select
              id="hotel-price"
              value={maxPrice}
              onChange={(event) => setParam("max", event.target.value, "All")}
            >
              <option value="All">Any price</option>
              {PRICE_LIMITS.map((price) => (
                <option key={price} value={price}>
                  Up to ${price}
                </option>
              ))}
            </select>
          </div>

          <div className="ht-field">
            <label htmlFor="hotel-sort">Sort by</label>
            <select
              id="hotel-sort"
              value={sort}
              onChange={(event) =>
                setParam("sort", event.target.value, "recommended")
              }
            >
              {Object.entries(SORTS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isReady && hotels.length > 0 && (
          <p className="ht-count" aria-live="polite">
            <span>
              {filteredHotels.length}{" "}
              {filteredHotels.length === 1 ? "hotel" : "hotels"}
              {isFiltering && ` of ${hotels.length}`}
            </span>
            {isFiltering && (
              <button type="button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </p>
        )}

        {/* ---------- States ---------- */}
        {status === "loading" && (
          <div className="ht-list" role="status" aria-label="Loading hotels">
            {[0, 1, 2].map((key) => (
              <div className="ht-skeleton" key={key}>
                <div className="ht-skeleton-photo" />
                <div className="ht-skeleton-body">
                  <div className="ht-skeleton-line" />
                  <div className="ht-skeleton-line ht-skeleton-line--short" />
                  <div className="ht-skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="ht-message" role="alert">
            <h2>We couldn't load the hotels</h2>
            <p>Check that the server is running, then try again.</p>
            <button type="button" className="ht-btn" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {noHotels && (
          <div className="ht-message">
            <h2>No hotels yet</h2>
            <p>Check back soon. New places are added regularly.</p>
          </div>
        )}

        {noMatches && (
          <div className="ht-message">
            <h2>No hotels found</h2>
            <p>Try a different search or a higher price limit.</p>
            <button type="button" className="ht-btn" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

        {/* ---------- Results ---------- */}
        {isReady && filteredHotels.length > 0 && (
          <div className="ht-list">
            {filteredHotels.map((hotel) => (
              <HotelRow key={hotel.id} hotel={hotel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
