import { useMemo, useState } from "react";

import { useApiList, useDetails } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { DestinationCards, DetailsModal } from "../components/cards";

export default function Destinations() {
  const { data, status, retry } = useApiList("/destinations/");
  const details = useDetails();

  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All");

  // Only show active destinations to customers.
  const activeDestinations = useMemo(
    () => data.filter((destination) => destination.is_active !== false),
    [data],
  );

  // Build province options from active destinations.
  const provinces = useMemo(
    () => [
      "All",
      ...[
        ...new Set(
          activeDestinations
            .map((destination) => destination.province)
            .filter(Boolean),
        ),
      ].sort(),
    ],
    [activeDestinations],
  );

  // Search by name, province, description, and best time.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activeDestinations.filter((destination) => {
      const searchableText = [
        destination.name,
        destination.province,
        destination.description,
        destination.best_time,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      const matchesProvince =
        province === "All" || destination.province === province;

      return matchesSearch && matchesProvince;
    });
  }, [activeDestinations, search, province]);

  const isFiltering = search.trim() !== "" || province !== "All";

  const noMatches =
    status === "ready" &&
    activeDestinations.length > 0 &&
    filtered.length === 0;

  const clearFilters = () => {
    setSearch("");
    setProvince("All");
  };

  return (
    <>
      <PageHeader
        title="Explore Cambodia"
        subtitle="Discover beautiful destinations across Cambodia."
      />

      <div className="container mt-4 mb-2">
        <div className="row g-3">
          <div className="col-md-8">
            <label htmlFor="destination-search" className="visually-hidden">
              Search destinations
            </label>

            <input
              id="destination-search"
              type="search"
              className="form-control form-control-lg"
              placeholder="Search destinations, provinces..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="col-md-4">
            <label htmlFor="destination-province" className="visually-hidden">
              Filter by province
            </label>

            <select
              id="destination-province"
              className="form-select form-select-lg"
              value={province}
              onChange={(event) => setProvince(event.target.value)}
            >
              {provinces.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All provinces" : item}
                </option>
              ))}
            </select>
          </div>
        </div>

        {status === "ready" && (
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
            <p className="text-secondary small mb-0" aria-live="polite">
              Showing {filtered.length} of {activeDestinations.length}{" "}
              destinations
            </p>

            {isFiltering && (
              <button
                type="button"
                className="btn btn-link p-0 small"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {details.notice && (
        <div className="container">
          <div className="alert alert-warning" role="alert">
            {details.notice}
          </div>
        </div>
      )}

      {noMatches ? (
        <section className="section text-center">
          <div className="container">
            <p className="fs-5 mb-1">No destinations match your search.</p>

            <p className="text-secondary">
              Try another destination name or province.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        </section>
      ) : (
        <Section status={status} count={filtered.length} onRetry={retry}>
          <DestinationCards
            items={filtered}
            loadingId={details.loadingId}
            onView={details.viewDestination}
          />
        </Section>
      )}

      {details.selected && (
        <DetailsModal selected={details.selected} onClose={details.close} />
      )}
    </>
  );
}
