import { Link } from "react-router-dom";
import { Reveal, SafeImage } from "./ui";
import { usd } from "../lib/pricing";
import "./HotelCard.css";

// One hotel card. The whole card links to the hotel page.
export default function HotelCard({ hotel, index = 0 }) {
  return (
    <Reveal className="col-md-6 col-lg-4" delay={(index % 3) * 100}>
      <article className="hc-card h-100">
        <div className="hc-media">
          <SafeImage src={hotel.image_url} alt="" className="hc-img" />
          <span className="hc-shade" aria-hidden="true" />

          {hotel.rating != null && (
            <span className="hc-score">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
              </svg>
              {hotel.rating}
            </span>
          )}
        </div>

        <div className="hc-body">
          <h3 className="hc-title">
            <Link to={`/hotels/${hotel.id}`} className="stretched-link">
              {hotel.name}
            </Link>
          </h3>

          {hotel.address && (
            <p className="hc-address">
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
              <span>{hotel.address}</span>
            </p>
          )}

          {hotel.description && <p className="hc-text">{hotel.description}</p>}

          <div className="hc-foot">
            <div className="hc-price">
              <small>From</small>
              <strong>{usd(hotel.price_per_night)}</strong>
              <small>/ night</small>
            </div>

            <span className="hc-go" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
