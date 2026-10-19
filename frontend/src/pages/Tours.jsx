import { useMemo, useState } from "react";

import { useApiList, useDetails } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { DetailsModal, TourCards } from "../components/cards";

const PRICE_LIMITS = [25, 50, 100, 200];

export default function Tours() {
  const { data, status, retry } = useApiList("/tours/");
  const details = useDetails();

  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("All");

  const filteredTours = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((tour) => {
      const matchesSearch = !query || tour.name?.toLowerCase().includes(query);
      const matchesPrice =
        maxPrice === "All" || Number(tour.price) <= Number(maxPrice);
      return matchesSearch && matchesPrice;
    });
  }, [data, search, maxPrice]);

  const isFiltering = search.trim() !== "" || maxPrice !== "All";
  const noMatches =
    status === "ready" && data.length > 0 && filteredTours.length === 0;

  const clearFilters = () => {
    setSearch("");
    setMaxPrice("All");
  };

  return (
    <>
      <PageHeader
        title="Tours"
        subtitle="Find exciting tours and discover more of Cambodia."
      />

      <div className="container mt-4 mb-2">
        <div className="row g-3">
          <div className="col-md-8">
            <label htmlFor="tour-search" className="visually-hidden">
              Search tours
            </label>
            <input
              id="tour-search"
              type="search"
              className="form-control form-control-lg"
              placeholder="Search tours by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="col-md-4">
            <label htmlFor="tour-price" className="visually-hidden">
              Maximum price
            </label>
            <select
              id="tour-price"
              className="form-select form-select-lg"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            >
              <option value="All">Any price</option>
              {PRICE_LIMITS.map((limit) => (
                <option key={limit} value={limit}>
                  Up to ${limit}
                </option>
              ))}
            </select>
          </div>
        </div>

        {status === "ready" && data.length > 0 && (
          <p className="text-secondary small mt-3 mb-0" aria-live="polite">
            Showing {filteredTours.length} of {data.length} tours
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

      {details.notice && (
        <div className="container">
          <div className="alert alert-warning" role="alert">
            {details.notice}
          </div>
        </div>
      )}

      {/* Section only draws its children when count > 0, so "no results" must live outside it. */}
      {noMatches ? (
        <section className="section text-center">
          <div className="container">
            <h2 className="h5 fw-bold">No tours found</h2>
            <p className="text-secondary">
              Try another search or select a higher price limit.
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
        <Section status={status} count={filteredTours.length} onRetry={retry}>
          <TourCards items={filteredTours} onView={details.viewTour} />
        </Section>
      )}

      {details.selected && (
        <DetailsModal selected={details.selected} onClose={details.close} />
      )}
    </>
  );
}
