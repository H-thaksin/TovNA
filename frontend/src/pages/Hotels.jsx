import { useMemo, useState } from "react";

import { useApiList } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import HotelCard from "../components/HotelCard";

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

export default function Hotels() {
  const { data, status, retry } = useApiList("/hotels/");

  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("All");
  const [sort, setSort] = useState("recommended");

  const filteredHotels = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matches = data.filter((hotel) => {
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
  }, [data, search, maxPrice, sort]);

  const isFiltering = search.trim() !== "" || maxPrice !== "All";
  const noMatches =
    status === "ready" && data.length > 0 && filteredHotels.length === 0;

  const clearFilters = () => {
    setSearch("");
    setMaxPrice("All");
  };

  return (
    <>
      <PageHeader
        title="Hotels"
        subtitle="Find a place to stay during your Cambodia adventure."
      />

      <div className="container mt-4 mb-2">
        <div className="row g-3">
          <div className="col-md-6">
            <label htmlFor="hotel-search" className="visually-hidden">
              Search hotels
            </label>
            <input
              id="hotel-search"
              type="search"
              className="form-control form-control-lg"
              placeholder="Search hotels by name or address..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="col-6 col-md-3">
            <label htmlFor="hotel-price" className="visually-hidden">
              Maximum price per night
            </label>
            <select
              id="hotel-price"
              className="form-select form-select-lg"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            >
              <option value="All">Any price</option>
              {PRICE_LIMITS.map((price) => (
                <option key={price} value={price}>
                  Up to ${price}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <label htmlFor="hotel-sort" className="visually-hidden">
              Sort hotels
            </label>
            <select
              id="hotel-sort"
              className="form-select form-select-lg"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              {Object.entries(SORTS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {status === "ready" && data.length > 0 && (
          <p className="text-secondary small mt-3 mb-0" aria-live="polite">
            Showing {filteredHotels.length} of {data.length} hotels
            {isFiltering && (
              <>
                {" · "}
                <button
                  type="button"
                  className="btn btn-link p-0 align-baseline small"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              </>
            )}
          </p>
        )}
      </div>

      {/* Section only draws its children when count > 0, so "no results" lives outside it. */}
      {noMatches ? (
        <section className="section text-center">
          <div className="container">
            <h2 className="h5 fw-bold">No hotels found</h2>
            <p className="text-secondary">
              Try a different search or price limit.
            </p>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        </section>
      ) : (
        <Section status={status} count={filteredHotels.length} onRetry={retry}>
          {filteredHotels.map((hotel, index) => (
            <HotelCard key={hotel.id} hotel={hotel} index={index} />
          ))}
        </Section>
      )}
    </>
  );
}
