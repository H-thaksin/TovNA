import { useState } from "react";

import { useApiList } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { ActivityCards } from "../components/cards";

export default function Activities() {
  const { data, status, retry } = useApiList("/activities/");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [maxPrice, setMaxPrice] = useState("All");

  const categories = [
    "All",
    ...new Set(data.map((activity) => activity.category).filter(Boolean)),
  ];

  const filteredActivities = data.filter((activity) => {
    const matchesSearch = activity.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      category === "All" || activity.category === category;

    const matchesPrice =
      maxPrice === "All" || Number(activity.price) <= Number(maxPrice);

    return matchesSearch && matchesCategory && matchesPrice;
  });

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Enjoy exciting activities and unforgettable experiences."
      />

      <div className="container mb-4">
        <div className="row g-3">
          <div className="col-md-6">
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder="Search activities by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="col-md-3">
            <select
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
            <select
              className="form-select form-select-lg"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            >
              <option value="All">Any price</option>
              <option value="10">Up to $10</option>
              <option value="25">Up to $25</option>
              <option value="50">Up to $50</option>
              <option value="100">Up to $100</option>
            </select>
          </div>
        </div>
      </div>

      <Section
        status={status}
        count={filteredActivities.length}
        onRetry={retry}
      >
        {filteredActivities.length > 0 ? (
          <ActivityCards items={filteredActivities} />
        ) : status === "ready" ? (
          <div className="col-12 text-center py-5">
            <h3 className="h5 fw-bold">No activities found</h3>
            <p className="text-secondary">
              Try another search or adjust your filters.
            </p>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => {
                setSearch("");
                setCategory("All");
                setMaxPrice("All");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </Section>
    </>
  );
}
