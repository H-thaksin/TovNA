import { useState } from "react";

import { useApiList } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { ActivityCards } from "../components/cards";

export default function Activities() {
  const { data, status, retry } = useApiList("/activities/");
  const [search, setSearch] = useState("");

  const filteredActivities = data.filter((activity) =>
    activity.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Enjoy exciting activities and unforgettable experiences."
      />

      <div className="container mb-4">
        <input
          type="text"
          className="form-control form-control-lg"
          placeholder="Search activities by name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
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
    </>
  );
}
