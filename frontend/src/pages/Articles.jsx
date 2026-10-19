import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { useApiList } from "../lib/hooks";
import { Card, articlePath } from "../components/cards";
import { PageHeader, Section, money } from "../components/ui";

const categories = [
  { label: "All Stories", value: "all" },
  { label: "Destinations", value: "destinations" },
  { label: "Tours", value: "tours" },
  { label: "Activities", value: "activities" },
];

const validTypes = ["destinations", "tours", "activities"];

const pageInfo = {
  all: {
    title: "Travel Stories",
    subtitle:
      "Find inspiration for your next adventure and discover the beauty of Cambodia.",
  },
  destinations: {
    title: "Explore Destinations",
    subtitle:
      "Discover beautiful places, local culture, and hidden gems across Cambodia.",
  },
  tours: {
    title: "Find Your Next Adventure",
    subtitle:
      "Explore tours and plan unforgettable experiences around Cambodia.",
  },
  activities: {
    title: "Things to Do",
    subtitle: "Find memorable activities and experiences for your next trip.",
  },
};

const badgeFor = (storyType, item) =>
  storyType === "destinations"
    ? item.province
    : storyType === "tours"
      ? `${item.duration_days} days`
      : item.category;

const metaFor = (storyType) =>
  storyType === "destinations"
    ? "DESTINATION"
    : storyType === "tours"
      ? "TRAVEL TOUR"
      : "ACTIVITY";

export default function Articles() {
  // /articles -> undefined, /articles/tours -> "tours"
  const { type } = useParams();

  const destinations = useApiList("/destinations/");
  const tours = useApiList("/tours/");
  const activities = useApiList("/activities/");
  const lists = [destinations, tours, activities];

  // Show the page once every list has answered. If only some lists fail,
  // still show the stories that did load and offer a retry.
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
      ...tours.data.map((item) => ({ type: "tours", item })),
      ...activities.data.map((item) => ({ type: "activities", item })),
    ],
    [destinations.data, tours.data, activities.data],
  );

  const retryAll = () => lists.forEach((list) => list.retry());

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

  // The address bar decides the category, so Back, Forward and refresh always agree with the page.
  const selectedCategory = type ?? "all";

  const stories =
    selectedCategory === "all"
      ? allStories
      : allStories.filter((story) => story.type === selectedCategory);

  const page = pageInfo[selectedCategory];
  const isEmpty = status === "ready" && stories.length === 0;

  return (
    <div className="tovna-stories-page">
      <PageHeader title={page.title} subtitle={page.subtitle} />

      <section className="container tovna-stories-section">
        <div className="tovna-stories-intro">
          <div>
            <span className="tovna-section-eyebrow">YOUR CAMBODIA JOURNEY</span>
            <h2>Find a place worth discovering.</h2>
            <p>
              Browse destinations, tours, and experiences to help plan your next
              trip.
            </p>
          </div>

          <div className="tovna-stories-count">
            <span>{status === "ready" ? stories.length : "–"}</span>
            <small>{stories.length === 1 ? "STORY" : "STORIES"}</small>
          </div>
        </div>

        <nav
          className="tovna-category-filters"
          aria-label="Filter travel stories"
        >
          {categories.map((category) => {
            const isActive = selectedCategory === category.value;

            return (
              <Link
                key={category.value}
                to={
                  category.value === "all"
                    ? "/articles"
                    : `/articles/${category.value}`
                }
                className={`tovna-filter-chip ${isActive ? "is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {category.label}
              </Link>
            );
          })}
        </nav>

        {status === "ready" && failedCount > 0 && (
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

        {/* Section only draws its children when count > 0, so the empty
            state has to live outside it to ever appear. */}
        {isEmpty ? (
          <div className="tovna-stories-empty">
            <span className="tovna-section-eyebrow">MORE TO DISCOVER</span>
            <h2>No stories here yet</h2>
            <p>Try another category to discover more of Cambodia.</p>
            <Link to="/articles" className="btn btn-primary mt-2">
              Browse all stories
            </Link>
          </div>
        ) : (
          <Section status={status} count={stories.length} onRetry={retryAll}>
            {stories.map(({ type: storyType, item }, index) => (
              <Card
                key={`${storyType}-${item.id}`}
                item={item}
                index={index}
                to={articlePath(storyType, item)}
                badge={badgeFor(storyType, item)}
                meta={metaFor(storyType)}
              >
                <p className="tovna-excerpt">{item.description}</p>

                {storyType !== "destinations" && (
                  <div className="tovna-card-footer">
                    <span className="price fs-5">{money(item.price)}</span>
                    {storyType === "tours" && (
                      <small className="text-secondary">/ person</small>
                    )}
                  </div>
                )}

                <div className="tovna-card-footer mt-auto">
                  <span className="tovna-link">
                    Explore story <span aria-hidden="true">↗</span>
                  </span>
                </div>
              </Card>
            ))}
          </Section>
        )}
      </section>
    </div>
  );
}
