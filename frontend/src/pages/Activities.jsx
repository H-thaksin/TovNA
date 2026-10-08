import { useApiList } from "../lib/hooks";
import { PageHeader, Section } from "../components/ui";
import { ActivityCards } from "../components/cards";

export default function Activities() {
  const { data, status, retry } = useApiList("/activities/");

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Enjoy exciting activities and unforgettable experiences."
      />

      <Section status={status} count={data.length} onRetry={retry}>
        <ActivityCards items={data} />
      </Section>
    </>
  );
}
