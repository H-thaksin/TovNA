import { useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useApiList } from "../lib/hooks";
import { SafeImage } from "../components/ui";
import { ratingLabel, usd } from "../lib/pricing";

const PRICE_LIMITS = [25, 50, 100, 200, 500];
const PAGE_SIZE = 6; // hotels shown per page

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

// Page numbers to show, with "…" for gaps, e.g. [1, "…", 4, 5, 6, "…", 12]
function getPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current - 1, current, current + 1]);
  const list = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const withGaps = [];
  list.forEach((page, index) => {
    if (index > 0 && page - list[index - 1] > 1) withGaps.push("…");
    withGaps.push(page);
  });
  return withGaps;
}

function Pagination({ current, total, onChange }) {
  if (total <= 1) return null;

  return (
    <nav className="ht-pagination" aria-label="Hotel pages">
      <button
        type="button"
        className="ht-page-btn ht-page-btn--nav"
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
      >
        <span aria-hidden="true">←</span> Previous
      </button>

      <ul className="ht-page-list">
        {getPageList(current, total).map((page, index) =>
          page === "…" ? (
            <li key={`gap-${index}`} className="ht-page-gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={page}>
              <button
                type="button"
                className={`ht-page-btn ${page === current ? "is-active" : ""}`}
                aria-label={`Page ${page}`}
                aria-current={page === current ? "page" : undefined}
                onClick={() => onChange(page)}
              >
                {page}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        className="ht-page-btn ht-page-btn--nav"
        disabled={current === total}
        onClick={() => onChange(current + 1)}
      >
        Next <span aria-hidden="true">→</span>
      </button>
    </nav>
  );
}

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
  const topRef = useRef(null);

  const search = params.get("q") ?? "";
  const maxPrice = PRICE_LIMITS.map(String).includes(params.get("max"))
    ? params.get("max")
    : "All";
  const sort = SORTS[params.get("sort")] ? params.get("sort") : "recommended";
  const requestedPage = Math.max(1, parseInt(params.get("page"), 10) || 1);

  // Changing a filter always goes back to page 1.
  const setParam = (key, value, fallback = "") => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (!value || value === fallback) next.delete(key);
        else next.set(key, value);
        if (key !== "page") next.delete("page");
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

  // ----- Pagination -----
  const totalPages = Math.max(1, Math.ceil(filteredHotels.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const pageHotels = filteredHotels.slice(firstIndex, firstIndex + PAGE_SIZE);

  const goToPage = (page) => {
    setParam("page", String(page), "1");

    // Bring the top of the list back into view
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    topRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

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
        <div className="ht-filters" ref={topRef}>
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

        {isReady && hotels.length > 0 && filteredHotels.length > 0 && (
          <p className="ht-count" aria-live="polite">
            <span>
              Showing {firstIndex + 1}–{firstIndex + pageHotels.length} of{" "}
              {filteredHotels.length}{" "}
              {filteredHotels.length === 1 ? "hotel" : "hotels"}
              {isFiltering && ` (${hotels.length} in total)`}
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

        {/* ---------- Results (one page at a time) ---------- */}
        {isReady && pageHotels.length > 0 && (
          <>
            <div className="ht-list">
              {pageHotels.map((hotel) => (
                <HotelRow key={hotel.id} hotel={hotel} />
              ))}
            </div>

            <Pagination
              current={currentPage}
              total={totalPages}
              onChange={goToPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
