import { Link } from "react-router-dom";
import { Modal, Reveal, SafeImage, clampThree, money } from "./ui";

/* Adjust this one function if your article route differs. */
export const articlePath = (type, item) =>
  `/articles/${type}/${item.slug || item.id}`;

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

const usd = (n) =>
  `US$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/* ------------------------------------------------------------------ */
/* Base card: image (zoom on hover) → badge → meta → title → body      */
/* ------------------------------------------------------------------ */
export function Card({
  item,
  index = 0,
  badge,
  meta,
  to = articlePath("destinations", item),
  children,
}) {
  return (
    <Reveal className="col-md-6 col-lg-4" delay={(index % 3) * 100}>
      <article className="tovna-card h-100 d-flex flex-column">
        <Link
          to={to}
          className="tovna-card-media"
          tabIndex={-1}
          aria-hidden="true"
        >
          <SafeImage
            src={item.image_url}
            alt=""
            className="card-photo"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {badge && <span className="tovna-badge">{badge}</span>}
        </Link>
        <div className="tovna-card-body d-flex flex-column flex-grow-1">
          {meta && <p className="tovna-meta">{meta}</p>}
          <h3 className="tovna-card-title">
            <Link to={to}>{item.name}</Link>
          </h3>
          {children}
        </div>
      </article>
    </Reveal>
  );
}

export function DestinationCards({ items, loadingId, onView }) {
  return items.map((d, i) => (
    <Card
      item={d}
      index={i}
      key={d.id}
      to={articlePath("destinations", d)}
      badge={d.province}
      meta={[formatDate(d.published_at), d.best_time && `Best: ${d.best_time}`]
        .filter(Boolean)
        .join("  ·  ")}
    >
      <p className="tovna-excerpt" style={clampThree}>
        {d.description}
      </p>
      <div className="tovna-card-footer">
        <Link to={articlePath("destinations", d)} className="tovna-link">
          Read the story
        </Link>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={loadingId === d.id}
          onClick={() => onView(d.id)}
        >
          {loadingId === d.id ? "Loading…" : "Quick view"}
        </button>
      </div>
    </Card>
  ));
}

export function TourCards({ items, onView }) {
  return items.map((t, i) => (
    <Card
      item={t}
      index={i}
      key={t.id}
      to={articlePath("tours", t)}
      badge={`${t.duration_days} days`}
      meta={formatDate(t.published_at)}
    >
      <p className="tovna-excerpt" style={clampThree}>
        {t.description}
      </p>
      <div className="tovna-card-footer">
        <span className="price fs-5">{money(t.price)}</span>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
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
    <Card
      item={a}
      index={i}
      key={a.id}
      to={articlePath("activities", a)}
      badge={a.category}
      meta={`${a.duration_hours} hours`}
    >
      <p className="tovna-excerpt" style={clampThree}>
        {a.description}
      </p>
      <div className="tovna-card-footer">
        <span className="price fs-5">{money(a.price)}</span>
        <Link to={articlePath("activities", a)} className="tovna-link">
          Read more
        </Link>
      </div>
    </Card>
  ));
}

/* ------------------------------------------------------------------ */
/* Hotel card (modelled on the Heritage Courtyard example)             */
/* ------------------------------------------------------------------ */
export const HERITAGE_COURTYARD = {
  id: "heritage-courtyard",
  name: "The Heritage Courtyard",
  image_url: "",
  tag: "Renovated in 2026",
  address: "National Road No. 6, Siem Reap, Siem Reap Province, Cambodia",
  latitude: 13.3671,
  longitude: 103.8448,
  highlights: [
    "Pool bar",
    "Delicious breakfast",
    "Outdoor saltwater pool",
    "Ideal location",
  ],
  moreHighlights: 5,
  score: 9.1,
  scoreLabel: "Great",
  reviewCount: 196,
  review:
    "Very good place to stay and nice swimming pool and also have play ground for kids.",
  surroundings: [
    ["Recreation", "Rosana Broadway", "310m"],
    ["Attraction", "Phsar Leu Thom Tmey", "660m"],
    ["Shopping", "Thav Nary", "560m"],
    ["Recreation", "Angkor Wat Local Guide", "680m"],
  ],
  amenities: [
    ["Outdoor swimming pool", true],
    ["Horse riding"],
    ["Hiking"],
    ["Sauna"],
    ["Spa"],
    ["Massage room"],
    ["Gym", true],
    ["Parking", true],
  ],
  room: {
    name: "Deluxe Double or Twin City View with Bathtub",
    beds: "2 single beds or 1 queen bed",
    perks: ["Non-refundable", "Instant confirmation", "Prepay online"],
    price: 18,
    originalPrice: 20,
    total: 22,
  },
};

export function HotelCard({ hotel = HERITAGE_COURTYARD, to, index = 0 }) {
  const h = hotel;
  const href = to || `/hotels/${h.id}/booking`;
  const map = `https://www.google.com/maps?q=${h.latitude},${h.longitude}`;

  return (
    <Reveal className="col-12" delay={(index % 3) * 100}>
      <article className="tovna-card tovna-hotel">
        <Link
          to={href}
          className="tovna-card-media"
          tabIndex={-1}
          aria-hidden="true"
        >
          {h.image_url && (
            <SafeImage
              src={h.image_url}
              alt=""
              className="card-photo"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          {h.tag && <span className="tovna-badge">{h.tag}</span>}
        </Link>

        <div className="tovna-hotel-main tovna-card-body">
          <h3 className="tovna-card-title">
            <Link to={href}>{h.name}</Link>
          </h3>
          <p className="tovna-meta">
            {h.address}{" "}
            <a
              href={map}
              target="_blank"
              rel="noreferrer"
              className="tovna-link"
            >
              Show on map
            </a>
          </p>

          <ul className="tovna-chips">
            {h.highlights.map((x) => (
              <li key={x}>{x}</li>
            ))}
            {h.moreHighlights > 0 && <li>+{h.moreHighlights} more</li>}
          </ul>

          <div className="tovna-score">
            <strong>{h.score}</strong>
            <span>
              {h.scoreLabel}
              <small>All {h.reviewCount} reviews</small>
            </span>
          </div>
          <p className="tovna-quote-inline">“{h.review}”</p>

          <h4 className="tovna-subhead">Surroundings</h4>
          <ul className="tovna-list">
            {h.surroundings.map(([type, name, dist]) => (
              <li key={name}>
                <span>
                  {type}: {name}
                </span>
                <span>{dist}</span>
              </li>
            ))}
          </ul>

          <h4 className="tovna-subhead">Amenities</h4>
          <ul className="tovna-chips">
            {h.amenities.map(([name, free]) => (
              <li key={name}>
                {name}
                {free && <em>Free</em>}
              </li>
            ))}
          </ul>
        </div>

        <aside className="tovna-hotel-price">
          <p className="tovna-meta mb-1">Today’s best price!</p>
          <p className="mb-0">
            <span className="price fs-3">US${h.room.price}</span>{" "}
            <s className="text-secondary">US${h.room.originalPrice}</s>
          </p>
          <p className="tovna-meta">
            Total (incl. taxes &amp; fees): US${h.room.total}
          </p>
          <h4 className="tovna-subhead">{h.room.name}</h4>
          <p className="tovna-meta mb-2">{h.room.beds}</p>
          <ul className="tovna-list tovna-list-plain">
            {h.room.perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <Link to={href} className="btn btn-primary w-100 mt-auto">
            Book now
          </Link>
        </aside>
      </article>
    </Reveal>
  );
}

/* Booking page: render at the route that HotelCard links to. */
export const SAMPLE_BOOKING = {
  hotel: "The Heritage Courtyard",
  score: 9.1,
  scoreLabel: "Great",
  reviewCount: 196,
  room: "Deluxe Double or Twin City View with Bathtub",
  guests: 2,
  beds: "2 single beds or 1 queen bed",
  features: [
    "Free Wi-Fi",
    "Non-smoking",
    "City view",
    "40㎡",
    "Floor: 1-4",
    "Non-refundable",
  ],
  dates: "Tue, Oct 13 – Wed, Oct 14",
  checkIn: "After 14:00",
  checkOut: "Before 12:00",
  nights: 1,
  rooms: 1,
  roomPrice: 18.13,
  priceBefore: 20.46,
  taxes: [
    ["Accommodation tax", 0.36],
    ["VAT", 1.81],
    ["Service charge", 1.81],
  ],
};

export function BookingSummary({ booking = SAMPLE_BOOKING }) {
  const b = booking;
  const discount = b.priceBefore - b.roomPrice;
  const taxTotal = b.taxes.reduce((s, [, v]) => s + v, 0);
  const total = b.roomPrice + taxTotal;

  return (
    <section className="tovna-booking">
      <header>
        <h1 className="tovna-card-title mb-1">{b.hotel}</h1>
        <p className="tovna-meta">
          {b.score}/10 {b.scoreLabel} · {b.reviewCount} reviews
        </p>
      </header>

      <h2 className="tovna-subhead">
        {b.room} ×{b.guests}
      </h2>
      <p className="tovna-meta">{b.beds}</p>
      <ul className="tovna-chips">
        {b.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <p className="mt-3 mb-1">
        <strong>{b.dates}</strong> ({b.nights} night)
      </p>
      <p className="tovna-meta">
        Check-in: {b.checkIn} · Check-out: {b.checkOut}
      </p>

      <h2 className="tovna-subhead">Price details</h2>
      <ul className="tovna-list">
        <li>
          <span>
            {b.rooms} room × {b.nights} night
          </span>
          <span>{usd(b.roomPrice)}</span>
        </li>
        <li>
          <span>Price before discount</span>
          <s>{usd(b.priceBefore)}</s>
        </li>
        <li>
          <span>Special discount</span>
          <span>−{usd(discount)}</span>
        </li>
        <li>
          <span>Taxes &amp; fees</span>
          <span>{usd(taxTotal)}</span>
        </li>
        {b.taxes.map(([name, v]) => (
          <li key={name} className="tovna-sub">
            <span>{name}</span>
            <span>{usd(v)}</span>
          </li>
        ))}
        <li className="tovna-total">
          <span>Total</span>
          <span>{usd(total)}</span>
        </li>
      </ul>
      <p className="tovna-meta">You saved {usd(discount)} on this booking.</p>

      <h2 className="tovna-subhead">Cancellation policy</h2>
      <p className="tovna-meta">
        Cancellation fee: {usd(total)}. This booking cannot be modified, and no
        refund is given if you cancel. The fee is charged if you don’t check in.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Existing details modal (unchanged behaviour)                        */
/* ------------------------------------------------------------------ */
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
              <div className="d-flex gap-2 mt-2">
                {hasCoordinates && (
                  <a
                    className="btn btn-primary"
                    href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on map
                  </a>
                )}
                <Link
                  className="btn btn-outline-primary"
                  to={articlePath(
                    kind === "destination" ? "destinations" : "tours",
                    data,
                  )}
                >
                  Read the story
                </Link>
              </div>
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
