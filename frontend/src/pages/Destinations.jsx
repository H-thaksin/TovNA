import { useMemo, useState } from "react";

import { useApiList, useDetails } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { DestinationCards, DetailsModal } from "../components/cards";

export default function Destinations() {
  const { data, status, retry } = useApiList("/destinations/");
  const details = useDetails();

  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All");

  // Province list for the dropdown, built from the data and sorted A to Z.
  const provinces = useMemo(
    () => [
      "All",
      ...[...new Set(data.map((d) => d.province).filter(Boolean))].sort(),
    ],
    [data],
  );

  // Matches the name or the province, ignoring capital letters and extra spaces.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((d) => {
      const matchesSearch =
        !query ||
        d.name?.toLowerCase().includes(query) ||
        d.province?.toLowerCase().includes(query);
      const matchesProvince = province === "All" || d.province === province;
      return matchesSearch && matchesProvince;
    });
  }, [data, search, province]);

  const isFiltering = search.trim() !== "" || province !== "All";
  const noMatches =
    status === "ready" && data.length > 0 && filtered.length === 0;

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
              placeholder="Search destinations..."
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

        {status === "ready" && data.length > 0 && (
          <p className="text-secondary small mt-3 mb-0" aria-live="polite">
            Showing {filtered.length} of {data.length} destinations
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

      {noMatches ? (
        <section className="section text-center">
          <div className="container">
            <p className="fs-5 mb-1">No destinations match your search.</p>
            <p className="text-secondary">Try a different word or province.</p>
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
