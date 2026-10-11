import { useState } from "react";

import { useApiList, useDetails } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { DetailsModal, TourCards } from "../components/cards";

export default function Tours() {
  const { data, status, retry } = useApiList("/tours/");
  const details = useDetails();

  const [search, setSearch] = useState("");

  const filteredTours = data.filter((tour) =>
    tour.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Tours"
        subtitle="Find exciting tours and discover more of Cambodia."
      />

      <div className="container mb-4">
        <input
          type="text"
          className="form-control form-control-lg"
          placeholder="Search tours by name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <Section status={status} count={filteredTours.length} onRetry={retry}>
        {filteredTours.length > 0 ? (
          <TourCards items={filteredTours} onView={details.viewTour} />
        ) : status === "ready" ? (
          <div className="col-12 text-center py-5">
            <h3 className="h5 fw-bold">No tours found</h3>
            <p className="text-secondary">Try another search term.</p>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => setSearch("")}
            >
              Clear search
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
