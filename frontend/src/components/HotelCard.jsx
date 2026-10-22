import { Link } from "react-router-dom";
import { Reveal, SafeImage } from "./ui";
import { usd } from "../lib/pricing";

// One hotel card. The whole card links to the hotel page.
export default function HotelCard({ hotel, index = 0 }) {
  return (
    <Reveal className="col-md-6 col-lg-4" delay={(index % 3) * 100}>
      <article className="hotel-card h-100">
        <div className="hotel-card-media">
          <SafeImage src={hotel.image_url} alt="" />
          {hotel.rating != null && (
            <span className="hotel-score">★ {hotel.rating}</span>
          )}
        </div>

        <div className="hotel-card-body">
          <h3 className="hotel-card-title">
            <Link to={`/hotels/${hotel.id}`} className="stretched-link">
              {hotel.name}
            </Link>
          </h3>

          {hotel.address && (
            <p className="hotel-card-address">
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" />
                <circle cx="12" cy="11" r="2" />
              </svg>
              {hotel.address}
            </p>
          )}

          {hotel.description && (
            <p className="hotel-card-text">{hotel.description}</p>
          )}

          <div className="hotel-card-foot">
            <span>
              <strong className="price fs-5">
                {usd(hotel.price_per_night)}
              </strong>{" "}
              <small className="text-secondary">/ night</small>
            </span>
            <span className="hotel-link">
              View hotel <span aria-hidden="true">→</span>
            </span>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
