import { useState } from "react";

import { useApiList, useDetails } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { DetailsModal, TourCards } from "../components/cards";

export default function Tours() {
  const { data, status, retry } = useApiList("/tours/");
  const details = useDetails();

  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("All");

  const filteredTours = data.filter((tour) => {
    const matchesSearch = tour.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesPrice =
      maxPrice === "All" || Number(tour.price) <= Number(maxPrice);

    return matchesSearch && matchesPrice;
  });

  return (
    <>
      <PageHeader
        title="Tours"
        subtitle="Find exciting tours and discover more of Cambodia."
      />

      <div className="container mb-4">
        <div className="row g-3">
          <div className="col-md-8">
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder="Search tours by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="col-md-4">
            <select
              className="form-select form-select-lg"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            >
              <option value="All">Any price</option>
              <option value="25">Up to $25</option>
              <option value="50">Up to $50</option>
              <option value="100">Up to $100</option>
              <option value="200">Up to $200</option>
            </select>
          </div>
        </div>
      </div>

      <Section status={status} count={filteredTours.length} onRetry={retry}>
        {filteredTours.length > 0 ? (
          <TourCards items={filteredTours} onView={details.viewTour} />
        ) : status === "ready" ? (
          <div className="col-12 text-center py-5">
            <h3 className="h5 fw-bold">No tours found</h3>
            <p className="text-secondary">
              Try another search or select a higher price limit.
            </p>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => {
                setSearch("");
                setMaxPrice("All");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </Section>

      {details.selected && (
        <DetailsModal selected={details.selected} onClose={details.close} />
      )}
    </>
  );
}
