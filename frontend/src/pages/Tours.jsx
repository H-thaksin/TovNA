import { useApiList, useDetails } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { DetailsModal, TourCards } from "../components/cards";

export default function Tours() {
  const { data, status, retry } = useApiList("/tours/");
  const details = useDetails();

  return (
    <>
      <PageHeader
        title="Tours"
        subtitle="Find exciting tours and discover more of Cambodia."
      />

      <Section status={status} count={data.length} onRetry={retry}>
        <TourCards items={data} onView={details.viewTour} />
      </Section>

      {details.selected && (
        <DetailsModal selected={details.selected} onClose={details.close} />
      )}
    </>
  );
}
