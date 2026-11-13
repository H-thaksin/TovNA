import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { useApiList } from "../lib/hooks";
import { articlePath } from "../components/cards";
import { SafeImage, money } from "../components/ui";

const PAGE_SIZE = 9;

const categories = [
  { label: "All", value: "all" },
  { label: "Destinations", value: "destinations" },
  { label: "Tours", value: "tours" },
  { label: "Activities", value: "activities" },
];

const validTypes = ["destinations", "tours", "activities"];

const typeLabel = {
  destinations: "Destination",
  tours: "Tour",
  activities: "Activity",
};

const pageInfo = {
  all: {
    title: "Travel stories",
    subtitle:
      "Find inspiration for your next adventure and discover the beauty of Cambodia.",
  },
  destinations: {
    title: "Destinations",
    subtitle:
      "Discover beautiful places, local culture, and hidden gems across Cambodia.",
  },
  tours: {
    title: "Tours",
    subtitle:
      "Explore guided tours and plan unforgettable experiences around Cambodia.",
  },
  activities: {
    title: "Activities",
    subtitle: "Find memorable things to do for your next trip.",
  },
};

// The small line under the title: where it is, how long it takes, or what kind it is.
function detailFor(type, item) {
  if (type === "destinations") return item.province || null;
  if (type === "tours") {
    return item.duration_days != null ? `${item.duration_days} days` : null;
  }
  const parts = [
    item.category,
    item.duration_hours != null ? `${item.duration_hours} hours` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function StoryCard({ story }) {
  const { type, item } = story;
  const path = articlePath(type, item);
  const detail = detailFor(type, item);
  const showPrice = type !== "destinations" && item.price != null;

  return (
    <article className="st-card">
      <Link to={path} className="st-card-link">
        <div className="st-card-photo">
          <SafeImage src={item.image_url} alt="" className="st-card-img" />
          <span className="st-tag">{typeLabel[type]}</span>
        </div>

        <div className="st-card-body">
          <h3>{item.name}</h3>
          {detail && <p className="st-card-detail">{detail}</p>}
          {item.description && (
            <p className="st-card-text">{item.description}</p>
          )}

          {showPrice && (
            <p className="st-card-price">
              <strong>{money(item.price)}</strong>
              <span>
                {" "}
                {type === "tours" ? "per person" : "per participant"}
              </span>
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}

function FeaturedStory({ story }) {
  const { type, item } = story;
  const detail = detailFor(type, item);

  return (
    <Link to={articlePath(type, item)} className="st-featured">
      <SafeImage src={item.image_url} alt="" className="st-featured-img" />
      <div className="st-featured-overlay" />
      <div className="st-featured-content">
        <span className="st-tag st-tag--light">
          Featured {typeLabel[type].toLowerCase()}
        </span>
        <h2>{item.name}</h2>
        {detail && <p className="st-featured-detail">{detail}</p>}
        {item.description && (
          <p className="st-featured-text">{item.description}</p>
        )}
        <span className="st-featured-cta">Read the story</span>
      </div>
    </Link>
  );
}

export default function Articles() {
  // /articles -> undefined, /articles/tours -> "tours"
  const { type } = useParams();
  const [params, setParams] = useSearchParams();

  const destinations = useApiList("/destinations/");
  const tours = useApiList("/tours/");
  const activities = useApiList("/activities/");
  const lists = [destinations, tours, activities];

  const [visible, setVisible] = useState(PAGE_SIZE);

  const query = (params.get("q") ?? "").trim();
  const selectedCategory = type ?? "all";

  // Start from the first page again whenever the filter changes.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [selectedCategory, query]);

  const loading = lists.some((list) => list.status === "loading");
  const failedCount = lists.filter((list) => list.status === "error").length;
  const status = loading
    ? "loading"
    : failedCount === lists.length
      ? "error"
      : "ready";

  const allStories = useMemo(
    () => [
      ...destinations.data.map((item) => ({ type: "destinations", item })),
      ...tours.data
        .filter((item) => item.is_active !== false)
        .map((item) => ({ type: "tours", item })),
      ...activities.data.map((item) => ({ type: "activities", item })),
    ],
    [destinations.data, tours.data, activities.data],
  );

  const counts = useMemo(
    () => ({
      all: allStories.length,
      destinations: allStories.filter((s) => s.type === "destinations").length,
      tours: allStories.filter((s) => s.type === "tours").length,
      activities: allStories.filter((s) => s.type === "activities").length,
    }),
    [allStories],
  );

  const stories = useMemo(() => {
    const needle = query.toLowerCase();

    return allStories.filter((story) => {
      if (selectedCategory !== "all" && story.type !== selectedCategory) {
        return false;
      }
      if (!needle) return true;

      const { item } = story;
      return [item.name, item.province, item.category, item.description]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(needle));
    });
  }, [allStories, selectedCategory, query]);

  const retryAll = () => lists.forEach((list) => list.retry());

  const setQuery = (value) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  };

  if (type && !validTypes.includes(type)) {
    return (
      <div className="container section text-center">
        <h1 className="fw-bold">Category not found</h1>
        <Link to="/articles" className="btn btn-primary mt-3">
          View all stories
        </Link>
      </div>
    );
  }

  const page = pageInfo[selectedCategory];
  const isReady = status === "ready";

  // Feature one story on the plain "all" view, so the page has a clear starting point.
  const showFeatured =
    isReady && selectedCategory === "all" && !query && stories.length > 4;
  const featured = showFeatured ? stories[0] : null;
  const rest = showFeatured ? stories.slice(1) : stories;
  const shown = rest.slice(0, visible);

  const search = params.toString() ? `?${params.toString()}` : "";

  return (
    <div className="st-page">
      {/* ---------- Hero ---------- */}
      <header className="st-hero">
        <div className="container">
          <h1>{page.title}</h1>
          <p>{page.subtitle}</p>

          <div className="st-search">
            <label htmlFor="stories-search" className="visually-hidden">
              Search stories
            </label>
            <input
              id="stories-search"
              type="search"
              placeholder="Search places, tours and activities"
              value={params.get("q") ?? ""}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </header>

      {/* ---------- Category tabs ---------- */}
      <nav className="st-tabs" aria-label="Filter travel stories">
        <div className="container st-tabs-inner">
          {categories.map((category) => {
            const active = selectedCategory === category.value;

            return (
              <Link
                key={category.value}
                to={
                  (category.value === "all"
                    ? "/articles"
                    : `/articles/${category.value}`) + search
                }
                className={`st-tab ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {category.label}
                {isReady && <span>{counts[category.value]}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <section className="container st-content">
        {isReady && failedCount > 0 && (
          <div className="alert alert-warning" role="alert">
            Some stories couldn't be loaded.{" "}
            <button
              type="button"
              className="btn btn-link p-0 align-baseline"
              onClick={retryAll}
            >
              Try again
            </button>
          </div>
        )}

        {status === "loading" && (
          <div
            className="st-grid"
            role="status"
            aria-label="Loading travel stories"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div className="st-skeleton" key={index}>
                <div className="st-skeleton-photo" />
                <div className="st-skeleton-line" />
                <div className="st-skeleton-line st-skeleton-line--short" />
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="st-message" role="alert">
            <h2>We couldn't load the stories</h2>
            <p>Check that the server is running, then try again.</p>
            <button type="button" className="st-btn" onClick={retryAll}>
              Try again
            </button>
          </div>
        )}

        {isReady && stories.length === 0 && (
          <div className="st-message">
            <h2>
              {query ? `No results for "${query}"` : "No stories here yet"}
            </h2>
            <p>
              {query
                ? "Check the spelling or try a shorter search."
                : "Try another category to discover more of Cambodia."}
            </p>
            <Link to="/articles" className="st-btn">
              Browse all stories
            </Link>
          </div>
        )}

        {featured && <FeaturedStory story={featured} />}

        {isReady && shown.length > 0 && (
          <>
            <p className="st-result-count" aria-live="polite">
              {stories.length} {stories.length === 1 ? "story" : "stories"}
              {query ? ` for "${query}"` : ""}
            </p>

            <div className="st-grid">
              {shown.map((story) => (
                <StoryCard
                  key={`${story.type}-${story.item.id}`}
                  story={story}
                />
              ))}
            </div>

            {shown.length < rest.length && (
              <div className="st-more">
                <button
                  type="button"
                  className="st-btn st-btn--outline"
                  onClick={() => setVisible((count) => count + PAGE_SIZE)}
                >
                  Show more ({rest.length - shown.length} left)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
