import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import heroBackground from "../assets/hero/hero-background.jpg";
import heroFloat1 from "../assets/hero/hero-float-1.jpg";
import heroFloat2 from "../assets/hero/hero-float-2.jpg";
import storyBand from "../assets/hero/story-band.jpg";
import { useApiList, useDetails, useScrollProgress } from "../lib/hooks";
import { Reveal, SafeImage, Section } from "../components/ui";
import {
  ActivityCards,
  DestinationCards,
  DetailsModal,
  TourCards,
} from "../components/cards";
import "./Home.css";

// Shortcuts to the other parts of the site.
const TOOLS = [
  {
    icon: "bed",
    title: "Hotels",
    text: "Find a comfortable place to stay, from city hotels to island resorts.",
    to: "/hotels",
  },
  {
    icon: "bus",
    title: "Transportation",
    text: "Compare buses, vans and boats between Cambodia's top destinations.",
    to: "/transportation",
  },
  {
    icon: "route",
    title: "Tours",
    text: "Join guided tours with local experts and a ready-made plan.",
    to: "/articles/tours",
  },
  {
    icon: "ticket",
    title: "Activities",
    text: "Add memorable experiences to your trip and book them online.",
    to: "/articles/activities",
  },
];

const QUICK_LINKS = [
  { label: "Destinations", to: "/articles/destinations" },
  { label: "Tours", to: "/articles/tours" },
  { label: "Activities", to: "/articles/activities" },
  { label: "Hotels", to: "/hotels" },
];

const ICONS = {
  bed: (
    <>
      <path d="M3 19V7M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6" />
      <circle cx="7" cy="11" r="1.6" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="4" width="16" height="13" rx="2" />
      <path d="M4 11h16M8 20v-3M16 20v-3" />
      <circle cx="8" cy="14" r=".6" />
      <circle cx="16" cy="14" r=".6" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" />
      <path d="M14 7v10" strokeDasharray="2 2" />
    </>
  ),
};

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function Hero() {
  const ref = useScrollProgress("leave");
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const rise = (delay) => ({ "--d": delay });

  // The search opens the Stories page, which reads the same ?q= value.
  const handleSearch = (event) => {
    event.preventDefault();
    const text = query.trim();
    navigate(text ? `/articles?q=${encodeURIComponent(text)}` : "/articles");
  };

  return (
    <section id="home" ref={ref} className="scene-hero">
      <div className="scene-bg">
        <SafeImage src={heroBackground} alt="" eager className="scene-bg-img" />
      </div>
      <div className="scene-shade" />
      <div className="scene-fade" />

      <div className="scene-mid" aria-hidden="true">
        <div className="float-wrap float-wrap--a">
          <SafeImage
            src={heroFloat1}
            alt=""
            className="float-card float-card--a"
          />
        </div>
        <div className="float-wrap float-wrap--b">
          <SafeImage
            src={heroFloat2}
            alt=""
            className="float-card float-card--b"
          />
        </div>
      </div>

      <div className="container scene-fg">
        <div className="hero-copy">
          <span className="badge-highlight rise mb-3" style={rise(0)}>
            Explore Cambodia
          </span>
          <h1 className="hero-title rise" style={rise(120)}>
            Where are you <span className="hero-accent">going?</span>
          </h1>
          <p className="hero-lead rise" style={rise(260)}>
            Discover amazing destinations, plan your perfect trip, and explore
            Cambodia with TovNa.
          </p>

          <form
            className="hm-search rise"
            style={rise(380)}
            onSubmit={handleSearch}
          >
            <label htmlFor="home-search" className="visually-hidden">
              Search destinations, tours and activities
            </label>
            <input
              id="home-search"
              type="search"
              placeholder="Search destinations, tours and activities"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit">Search</button>
          </form>

          <div className="hm-quick rise" style={rise(500)}>
            <span>Browse:</span>
            {QUICK_LINKS.map(({ label, to }) => (
              <Link key={to} to={to}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Live numbers from the API, so the page shows the site has real content.
function Stats({ items }) {
  const visible = items.filter((item) => item.count > 0);
  if (visible.length < 2) return null;

  return (
    <div className="container">
      <Reveal className="hm-stats">
        {visible.map(({ label, count, to }) => (
          <Link to={to} key={label} className="hm-stat">
            <strong>{count}</strong>
            <span>{label}</span>
          </Link>
        ))}
      </Reveal>
    </div>
  );
}

// A full-width pause between the activity list and the shortcut cards.
function StoryBand() {
  const ref = useScrollProgress("pass");

  return (
    <section ref={ref} className="scene-band" aria-label="Your Cambodia story">
      <div className="band-bg">
        <SafeImage src={storyBand} alt="" />
      </div>
      <div className="band-shade" />
      <Reveal className="container band-content">
        <h2>Your Cambodia story starts here</h2>
        <p>
          From the temples of Angkor to the islands of the south, build a
          journey that feels like yours.
        </p>
        <Link to="/articles/tours" className="btn btn-accent btn-lg">
          Browse tours
        </Link>
      </Reveal>
    </section>
  );
}

const viewAll = (to, label) => (
  <Link to={to} className="btn btn-outline-primary">
    {label} →
  </Link>
);

export default function Home() {
  const destinations = useApiList("/destinations/");
  const tours = useApiList("/tours/");
  const activities = useApiList("/activities/");
  const hotels = useApiList("/hotels/");
  const details = useDetails();

  return (
    <>
      <Hero />

      <Stats
        items={[
          {
            label: "Destinations",
            count: destinations.data.length,
            to: "/articles/destinations",
          },
          { label: "Tours", count: tours.data.length, to: "/articles/tours" },
          {
            label: "Activities",
            count: activities.data.length,
            to: "/articles/activities",
          },
          { label: "Hotels", count: hotels.data.length, to: "/hotels" },
        ]}
      />

      {details.notice && (
        <div className="container">
          <div className="alert alert-warning" role="alert">
            {details.notice}
          </div>
        </div>
      )}

      <Section
        id="popular"
        title="Popular destinations"
        subtitle="Explore beautiful places and unforgettable experiences."
        tinted
        status={destinations.status}
        count={destinations.data.length}
        onRetry={destinations.retry}
        action={viewAll("/articles/destinations", "View all destinations")}
      >
        <DestinationCards
          items={destinations.data.slice(0, 3)}
          loadingId={details.loadingId}
          onView={details.viewDestination}
        />
      </Section>

      <Section
        title="Popular tours"
        subtitle="Find exciting tours and discover more of Cambodia."
        status={tours.status}
        count={tours.data.length}
        onRetry={tours.retry}
        action={viewAll("/articles/tours", "View all tours")}
      >
        <TourCards items={tours.data.slice(0, 3)} onView={details.viewTour} />
      </Section>

      <Section
        title="Popular activities"
        subtitle="Enjoy exciting activities and unforgettable experiences."
        tinted
        status={activities.status}
        count={activities.data.length}
        onRetry={activities.retry}
        action={viewAll("/articles/activities", "View all activities")}
      >
        <ActivityCards items={activities.data.slice(0, 3)} />
      </Section>

      <StoryBand />

      <section className="section">
        <div className="container">
          <Reveal blur className="text-center mb-5">
            <h2 className="section-title">Everything you need for your trip</h2>
            <p className="section-subtitle mb-0">
              Stay, travel and explore. Plan it all in one place.
            </p>
          </Reveal>

          <div className="row g-4">
            {TOOLS.map(({ icon, title, text, to }, index) => (
              <Reveal
                className="col-sm-6 col-lg-3"
                delay={index * 100}
                key={title}
              >
                <Link to={to} className="hm-tool h-100">
                  <span className="hm-tool-icon">
                    <Icon name={icon} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <span className="hm-tool-link">
                    Open <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {details.selected && (
        <DetailsModal selected={details.selected} onClose={details.close} />
      )}
    </>
  );
}
