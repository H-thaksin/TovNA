import { Modal, Reveal, SafeImage, clampThree, money } from "./ui";

export function Card({ item, index = 0, children }) {
  return (
    <Reveal className="col-md-6 col-lg-4" delay={(index % 3) * 100}>
      <article className="tovna-card h-100 d-flex flex-column">
        <SafeImage
          src={item.image_url}
          alt={item.name}
          className="card-photo"
          style={{ height: 220, objectFit: "cover", width: "100%" }}
        />
        <div className="tovna-card-body d-flex flex-column flex-grow-1 p-4">
          {children}
        </div>
      </article>
    </Reveal>
  );
}

export function DestinationCards({ items, loadingId, onView }) {
  return items.map((d, i) => (
    <Card item={d} index={i} key={d.id}>
      <h3 className="h5 fw-bold mb-1">{d.name}</h3>
      <p className="text-secondary small mb-3">📍 {d.province}</p>
      <p className="text-secondary" style={clampThree}>
        {d.description}
      </p>
      <button
        type="button"
        className="btn btn-outline-primary mt-auto align-self-start"
        disabled={loadingId === d.id}
        onClick={() => onView(d.id)}
      >
        {loadingId === d.id ? "Loading…" : "View details"}
      </button>
    </Card>
  ));
}

export function TourCards({ items, onView }) {
  return items.map((t, i) => (
    <Card item={t} index={i} key={t.id}>
      <h3 className="h5 fw-bold mb-1">{t.name}</h3>
      <p className="text-secondary small mb-3">🗓️ {t.duration_days} days</p>
      <p className="text-secondary" style={clampThree}>
        {t.description}
      </p>
      <div className="d-flex justify-content-between align-items-center mt-auto pt-2">
        <span className="price fs-5">{money(t.price)}</span>
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() => onView(t)}
        >
          View tour
        </button>
      </div>
    </Card>
  ));
}

export function ActivityCards({ items }) {
  return items.map((a, i) => (
    <Card item={a} index={i} key={a.id}>
      <span className="badge-highlight align-self-start mb-2">
        {a.category}
      </span>
      <h3 className="h5 fw-bold">{a.name}</h3>
      <p className="text-secondary" style={clampThree}>
        {a.description}
      </p>
      <div className="d-flex justify-content-between align-items-center mt-auto pt-2">
        <span className="price fs-5">{money(a.price)}</span>
        <span className="text-secondary small">
          ⏱️ {a.duration_hours} hours
        </span>
      </div>
    </Card>
  ));
}

export function DetailsModal({ selected, onClose }) {
  const { kind, data } = selected;
  const hasCoordinates = data.latitude != null && data.longitude != null;

  return (
    <Modal title={data.name} onClose={onClose}>
      <div className="row g-0">
        <div className="col-lg-5">
          <SafeImage
            src={data.image_url}
            alt={data.name}
            className="w-100 h-100"
            style={{ objectFit: "cover", minHeight: 260 }}
          />
        </div>
        <div className="col-lg-7 p-4 p-lg-5">
          <h2 className="fw-bold h3 pe-4">{data.name}</h2>

          {kind === "destination" ? (
            <>
              <p className="text-secondary">📍 {data.province}</p>
              <p className="mt-3">{data.description}</p>
              <p>
                <span className="badge-highlight me-2">Best time to visit</span>
                {data.best_time}
              </p>
              {hasCoordinates && (
                <a
                  className="btn btn-primary mt-2"
                  href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on map
                </a>
              )}
            </>
          ) : (
            <>
              <p className="text-secondary">🗓️ {data.duration_days} days</p>
              <p className="mt-3">{data.description}</p>
              <p className="fs-4 mb-0">
                <span className="price">{money(data.price)}</span>{" "}
                <small className="text-secondary fs-6">per person</small>
              </p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
