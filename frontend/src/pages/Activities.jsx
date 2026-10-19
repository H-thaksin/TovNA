import { useMemo, useState } from "react";

import { useApiList } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { ActivityCards } from "../components/cards";

const PRICE_LIMITS = [10, 25, 50, 100];

export default function Activities() {
  const { data, status, retry } = useApiList("/activities/");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [maxPrice, setMaxPrice] = useState("All");

  const categories = useMemo(
    () => [
      "All",
      ...[...new Set(data.map((a) => a.category).filter(Boolean))].sort(),
    ],
    [data],
  );

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((activity) => {
      const matchesSearch =
        !query || activity.name?.toLowerCase().includes(query);
      const matchesCategory =
        category === "All" || activity.category === category;
      const matchesPrice =
        maxPrice === "All" || Number(activity.price) <= Number(maxPrice);
      return matchesSearch && matchesCategory && matchesPrice;
    });
  }, [data, search, category, maxPrice]);

  const isFiltering =
    search.trim() !== "" || category !== "All" || maxPrice !== "All";
  const noMatches =
    status === "ready" && data.length > 0 && filteredActivities.length === 0;

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
    setMaxPrice("All");
  };

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Enjoy exciting activities and unforgettable experiences."
      />

      <div className="container mt-4 mb-2">
        <div className="row g-3">
          <div className="col-md-6">
            <label htmlFor="activity-search" className="visually-hidden">
              Search activities
            </label>
            <input
              id="activity-search"
              type="search"
              className="form-control form-control-lg"
              placeholder="Search activities by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="col-md-3">
            <label htmlFor="activity-category" className="visually-hidden">
              Category
            </label>
            <select
              id="activity-category"
              className="form-select form-select-lg"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All categories" : item}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label htmlFor="activity-price" className="visually-hidden">
              Maximum price
            </label>
            <select
              id="activity-price"
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
            Showing {filteredActivities.length} of {data.length} activities
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

      {/* Section only draws its children when count > 0, so "no results" must live outside it. */}
      {noMatches ? (
        <section className="section text-center">
          <div className="container">
            <h2 className="h5 fw-bold">No activities found</h2>
            <p className="text-secondary">
              Try another search or adjust your filters.
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
        <Section
          status={status}
          count={filteredActivities.length}
          onRetry={retry}
        >
          <ActivityCards items={filteredActivities} />
        </Section>
      )}
    </>
  );
}
