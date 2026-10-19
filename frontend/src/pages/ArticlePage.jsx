import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchJson } from "../lib/api";
import { SafeImage } from "../components/ui";

const endpoints = {
  destinations: "/destinations/",
  tours: "/tours/",
  activities: "/activities/",
};

const categoryNames = {
  destinations: "Destinations",
  tours: "Travel tours",
  activities: "Activities",
};

function ArticlePage() {
  const { type, id } = useParams();
  const [article, setArticle] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadArticle() {
      if (!endpoints[type]) {
        setStatus("error");
        return;
      }

      setStatus("loading");
      setArticle(null);

      try {
        const data = await fetchJson(`${endpoints[type]}${id}`);

        if (!cancelled) {
          setArticle(data);
          setStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Could not load article:", error);
          setStatus("error");
        }
      }
    }

    loadArticle();

    return () => {
      cancelled = true;
    };
  }, [type, id]);

  if (status === "loading") {
    return (
      <div className="container section text-center">
        <p>Loading travel story...</p>
      </div>
    );
  }

  if (status === "error" || !article) {
    return (
      <section className="section text-center">
        <div className="container">
          <h1 className="fw-bold">Story not found</h1>
          <p className="text-secondary">We couldn't find this travel story.</p>
          <Link to="/articles" className="btn btn-primary">
            Explore stories
          </Link>
        </div>
      </section>
    );
  }

  const category =
    type === "destinations"
      ? article.province || "Destination"
      : type === "tours"
        ? "Travel tour"
        : article.category || "Activity";

  const metadata =
    type === "destinations"
      ? article.best_time
        ? `Best time to visit: ${article.best_time}`
        : null
      : type === "tours"
        ? article.duration_days != null
          ? `${article.duration_days} days`
          : null
        : article.duration_hours != null
          ? `${article.duration_hours} hours`
          : null;

  const hasCoordinates = article.latitude != null && article.longitude != null;

  const hasPrice =
    type !== "destinations" &&
    article.price != null &&
    Number.isFinite(Number(article.price));

  return (
    <article className="tovna-article">
      <header className="tovna-hero">
        <SafeImage
          src={article.image_url}
          alt={article.name || "Travel destination"}
          className="tovna-hero-img"
        />

        <div className="tovna-hero-overlay" />

        <div className="tovna-hero-content">
          <Link to="/articles" className="tovna-hero-back">
            ← All travel stories
          </Link>

          <p className="tovna-hero-kicker">
            {categoryNames[type]}
            {article.province && type !== "destinations"
              ? ` · ${article.province}`
              : ""}
          </p>

          <span className="tovna-badge-static">{category}</span>

          <h1>{article.name}</h1>

          {metadata && <p className="tovna-hero-meta">{metadata}</p>}
        </div>
      </header>

      <div className="tovna-article-column">
        <nav className="tovna-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/articles">Stories</Link>
          <span>/</span>
          <Link to={`/articles/${type}`}>{categoryNames[type]}</Link>
        </nav>

        <p className="tovna-lede">{article.description}</p>

        {hasPrice && (
          <div className="tovna-article-price">
            <span className="tovna-price-label">
              {type === "tours" ? "Tour price" : "Activity price"}
            </span>
            <p>
              <strong>
                $
                {Number(article.price).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
              {type === "tours" && <span> per person</span>}
            </p>
          </div>
        )}

        {type === "destinations" && hasCoordinates && (
          <a
            className="btn btn-primary mt-3"
            href={`https://www.google.com/maps?q=${article.latitude},${article.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            View destination on map ↗
          </a>
        )}

        <div className="tovna-article-divider" />

        <div className="tovna-article-footer">
          <p>Ready for your next adventure?</p>
          <Link to={`/articles/${type}`} className="btn btn-outline-primary">
            Explore more {categoryNames[type].toLowerCase()}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default ArticlePage;
