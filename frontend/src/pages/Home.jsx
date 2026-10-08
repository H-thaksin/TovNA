import { Link } from "react-router-dom";
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

const FEATURES = [
  {
    icon: "compass",
    title: "Discover",
    text: "Find beautiful destinations and exciting places across Cambodia.",
  },
  {
    icon: "star",
    title: "Get recommendations",
    text: "Travel ideas based on your interests, budget and plans.",
  },
  {
    icon: "calendar",
    title: "Plan your trip",
    text: "Pick tours and activities and organize your journey.",
  },
  {
    icon: "ticket",
    title: "Book easily",
    text: "Manage tours, activities and bookings in one place.",
  },
];

const ICONS = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  star: (
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
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
      width="22"
      height="22"
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
  const rise = (delay) => ({ "--d": delay });

  return (
    <section id="home" ref={ref} className="scene-hero">
      {/* Background: the photo drifts and zooms slowly, and scrolls slower than the page */}
      <div className="scene-bg">
        <SafeImage src={heroBackground} alt="" eager className="scene-bg-img" />
      </div>
      <div className="scene-shade" />
      <div className="scene-fade" />

      {/* Midground: two photos float at different depths (hidden on mobile) */}
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

      {/* Foreground: the message */}
      <div className="container scene-fg">
        <div className="hero-copy">
          <span className="badge-highlight rise mb-3" style={rise(0)}>
            🇰🇭 Explore Cambodia
          </span>
          <h1 className="hero-title rise" style={rise(120)}>
            Where are you <span className="hero-accent">going?</span>
          </h1>
          <p className="hero-lead rise" style={rise(260)}>
            Discover amazing destinations, plan your perfect trip, and explore
            Cambodia with TovNa.
          </p>
          <div className="d-flex flex-wrap gap-3 rise" style={rise(400)}>
            <Link to="/destinations" className="btn btn-accent btn-lg">
              Explore destinations
            </Link>
            <Link to="/tours" className="btn btn-outline-light btn-lg">
              Plan my trip
            </Link>
          </div>
        </div>
      </div>

      <a
        className="scroll-cue"
        href="#popular"
        aria-label="Scroll to destinations"
      >
        <span />
      </a>
    </section>
  );
}

// A full-width cinematic pause between the activity list and the feature cards.
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
        <Link to="/tours" className="btn btn-accent btn-lg">
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
  const details = useDetails();

  return (
    <>
      <Hero />

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
        action={viewAll("/destinations", "View all destinations")}
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
        action={viewAll("/tours", "View all tours")}
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
        action={viewAll("/activities", "View all activities")}
      >
        <ActivityCards items={activities.data.slice(0, 3)} />
      </Section>

      <StoryBand />

      <section className="section">
        <div className="container">
          <Reveal blur className="text-center mb-5">
            <h2 className="section-title">Everything you need for your trip</h2>
            <p className="section-subtitle mb-0">
              Plan, discover and enjoy your Cambodia journey in one place.
            </p>
          </Reveal>
          <div className="row g-4">
            {FEATURES.map(({ icon, title, text }, i) => (
              <Reveal className="col-sm-6 col-lg-3" delay={i * 100} key={title}>
                <div className="feature-card h-100">
                  <span className="feature-icon">
                    <Icon name={icon} />
                  </span>
                  <h3 className="h5 fw-bold">{title}</h3>
                  <p className="text-secondary mb-0">{text}</p>
                </div>
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
