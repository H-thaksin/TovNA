import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import heroBackground from "../assets/hero/hero-background1.jpg";
import heroFloat1 from "../assets/hero/hero-float-1.jpg";
import heroFloat2 from "../assets/hero/hero-float-2.jpg";
import storyBand from "../assets/hero/story-band.jpg";
import { useApiList, useDetails, useScrollProgress } from "../lib/hooks";
import { Reveal, SafeImage, Section } from "../components/ui";
import {
  ActivityCards,
  DetailsModal,
  TourCards,
  articlePath,
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

const STEPS = [
  {
    icon: "search",
    title: "Discover",
    text: "Browse destinations, tours and activities across Cambodia.",
  },
  {
    icon: "calendar",
    title: "Plan & book",
    text: "Pick your dates, choose a hotel or ride and book in a few taps.",
  },
  {
    icon: "sparkle",
    title: "Enjoy the trip",
    text: "Follow your booking, pay securely and travel with confidence.",
  },
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
  pin: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

function Icon({ name, size = 24 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
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
            <span className="hm-search-icon">
              <Icon name="search" size={20} />
            </span>
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
        {visible.map(({ label, count, to, icon }) => (
          <Link to={to} key={label} className="hm-stat">
            <span className="hm-stat-icon">
              <Icon name={icon} size={20} />
            </span>
            <strong>{count}</strong>
            <span>{label}</span>
          </Link>
        ))}
      </Reveal>
    </div>
  );
}

// Featured destinations as a photo grid: one large tile and smaller ones.
function FeaturedDestinations({ items, loadingId, onView }) {
  const count = items.length >= 5 ? 5 : items.length >= 3 ? 3 : items.length;
  const tiles = items.slice(0, count);

  return (
    <div className={`hm-bento hm-bento--${count}`}>
      {tiles.map((d, index) => (
        <Reveal
          as="article"
          key={d.id}
          delay={index * 80}
          className={`hm-tile ${index === 0 ? "hm-tile--lg" : ""}`}
        >
          <SafeImage src={d.image_url} alt="" className="hm-tile-img" />
          <div className="hm-tile-shade" />

          {d.province && <span className="hm-tile-badge">{d.province}</span>}

          <div className="hm-tile-info">
            <h3>
              <Link
                to={articlePath("destinations", d)}
                className="hm-tile-link"
              >
                {d.name}
              </Link>
            </h3>
            {d.best_time && <p>Best time: {d.best_time}</p>}
          </div>

          <button
            type="button"
            className="hm-tile-quick"
            disabled={loadingId === d.id}
            onClick={() => onView(d.id)}
          >
            {loadingId === d.id ? "Loading…" : "Quick view"}
          </button>
        </Reveal>
      ))}
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

function HowItWorks() {
  return (
    <section className="section bg-white">
      <div className="container">
        <Reveal blur className="text-center mb-5">
          <h2 className="section-title">How TovNa works</h2>
          <p className="section-subtitle mb-0">
            Three simple steps from idea to adventure.
          </p>
        </Reveal>

        <div className="hm-steps">
          {STEPS.map(({ icon, title, text }, index) => (
            <Reveal className="hm-step" delay={index * 120} key={title}>
              <span className="hm-step-no">{index + 1}</span>
              <span className="hm-step-icon">
                <Icon name={icon} size={26} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const viewAll = (to, label) => (
  <Link to={to} className="hm-viewall">
    {label}
    <Icon name="arrow" size={18} />
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
            icon: "pin",
          },
          {
            label: "Tours",
            count: tours.data.length,
            to: "/articles/tours",
            icon: "route",
          },
          {
            label: "Activities",
            count: activities.data.length,
            to: "/articles/activities",
            icon: "ticket",
          },
          {
            label: "Hotels",
            count: hotels.data.length,
            to: "/hotels",
            icon: "bed",
          },
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
        split
        status={destinations.status}
        count={destinations.data.length}
        onRetry={destinations.retry}
        action={viewAll("/articles/destinations", "View all")}
      >
        <div className="col-12">
          <FeaturedDestinations
            items={destinations.data}
            loadingId={details.loadingId}
            onView={details.viewDestination}
          />
        </div>
      </Section>

      <Section
        title="Popular tours"
        subtitle="Find exciting tours and discover more of Cambodia."
        tinted
        split
        status={tours.status}
        count={tours.data.length}
        onRetry={tours.retry}
        action={viewAll("/articles/tours", "View all")}
      >
        <TourCards items={tours.data.slice(0, 3)} onView={details.viewTour} />
      </Section>

      <Section
        title="Popular activities"
        subtitle="Enjoy exciting activities and unforgettable experiences."
        split
        status={activities.status}
        count={activities.data.length}
        onRetry={activities.retry}
        action={viewAll("/articles/activities", "View all")}
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

      <HowItWorks />

      {details.selected && (
        <DetailsModal selected={details.selected} onClose={details.close} />
      )}
    </>
  );
}
