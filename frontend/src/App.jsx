import { useEffect, useRef, useState } from "react";
import heroBackground from "./assets/hero/hero-background.jpg";
import heroFloat1 from "./assets/hero/hero-float-1.jpg";
import heroFloat2 from "./assets/hero/hero-float-2.jpg";

import storyBand from "./assets/hero/story-band.jpg";
// To add a second floating photo: put hero-float-2.jpg in src/assets/hero/, then
// import it here and add a second <div className="float-wrap float-wrap--b"> in Hero.

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const SECTION_IDS = ["home", "destinations", "tours", "activities"];

const NAV_LINKS = [
  { label: "Home", id: "home" },
  { label: "Destinations", id: "destinations" },
  { label: "Tours", id: "tours" },
  { label: "Activities", id: "activities" },
];

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

const clampThree = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
const money = (value) =>
  value == null || Number.isNaN(Number(value))
    ? "Ask for price"
    : `$${Number(value).toLocaleString()}`;

async function fetchJson(path, signal) {
  const response = await fetch(`${API_URL}${path}`, { signal });
  if (!response.ok)
    throw new Error(`Request failed (${response.status}) for ${path}`);
  return response.json();
}

/* ---------------------------------- Hooks ---------------------------------- */

// Loads a list from the API and tracks loading / ready / error.
function useApiList(path) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchJson(path, controller.signal)
      .then((items) => {
        setData(items);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error(`Error fetching ${path}:`, error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [path, attempt]);

  return { data, status, retry: () => setAttempt((n) => n + 1) };
}

// Highlights the nav link of the section currently on screen.
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

// Writes --p (0 to 1) on the element as it scrolls. No React re-renders, so scrolling stays smooth.
// "leave": 0 at the top of the page, 1 once the element has scrolled out. "pass": 0 as it enters, 1 as it exits.
function useScrollProgress(mode = "leave") {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const { top, height } = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (top > vh || top + height < 0) return; // off screen
      const raw = mode === "leave" ? -top / height : (vh - top) / (vh + height);
      el.style.setProperty("--p", Math.min(1, Math.max(0, raw)).toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [mode]);

  return ref;
}

// Fades and lifts its content into place the first time it scrolls into view.
function Reveal({
  as: Tag = "div",
  delay = 0,
  blur = false,
  className = "",
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") return setVisible(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${blur ? "reveal--blur" : ""} ${visible ? "is-visible" : ""} ${className}`}
      style={{ "--d": delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------- Shared pieces ------------------------------ */

function SafeImage({ src, alt, style, className, eager = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`d-flex align-items-center justify-content-center fs-1 ${className ?? ""}`}
        style={{
          background: "linear-gradient(135deg, #0f766e, #134e4a)",
          color: "rgba(255,255,255,.85)",
          ...style,
        }}
      >
        🌿
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

// Bootstrap's modal styles without its JavaScript.
function Modal({ title, onClose, size = "modal-lg", children }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, []);

  return (
    <>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={onClose}
      >
        <div
          className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content tovna-card tovna-card--static">
            <button
              type="button"
              className="btn-close position-absolute top-0 end-0 m-3"
              style={{ zIndex: 2 }}
              aria-label="Close"
              onClick={onClose}
            />
            {children}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function Section({
  id,
  title,
  subtitle,
  status,
  count,
  onRetry,
  tinted,
  children,
}) {
  return (
    <section id={id} className={`section ${tinted ? "bg-white" : ""}`}>
      <div className="container">
        <Reveal blur className="text-center mb-5">
          <h2 className="section-title">{title}</h2>
          <p className="section-subtitle mb-0">{subtitle}</p>
        </Reveal>

        {status === "loading" && (
          <div className="text-center py-5" role="status">
            <div className="spinner-border text-primary" aria-hidden="true" />
            <p className="text-secondary mt-3 mb-0">Loading…</p>
          </div>
        )}
        {status === "error" && (
          <div className="text-center py-5" role="alert">
            <p className="mb-3">
              We couldn't load this section. Check that the server is running,
              then try again.
            </p>
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {status === "ready" && count === 0 && (
          <p className="text-center text-secondary py-5 mb-0">
            Nothing here yet. Check back soon.
          </p>
        )}
        {status === "ready" && count > 0 && (
          <div className="row g-4">{children}</div>
        )}
      </div>
    </section>
  );
}

function Card({ item, index = 0, children }) {
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

/* ---------------------------------- Navbar --------------------------------- */

function Navbar({ active, user, onLogin, onSignup, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  return (
    <header className="tovna-header sticky-top">
      <nav className="navbar navbar-expand-lg" aria-label="Main navigation">
        <div className="container py-1">
          <a className="navbar-brand" href="#home" onClick={close}>
            <span className="text-primary">Tov</span>
            <span style={{ color: "var(--tovna-accent)" }}>Na</span>
          </a>

          <button
            className="navbar-toggler"
            type="button"
            aria-controls="main-menu"
            aria-expanded={isOpen}
            aria-label="Toggle navigation"
            onClick={() => setIsOpen((o) => !o)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div
            className={`collapse navbar-collapse ${isOpen ? "show" : ""}`}
            id="main-menu"
          >
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
              {NAV_LINKS.map(({ label, id }) => (
                <li className="nav-item" key={id}>
                  <a
                    className={`nav-link ${active === id ? "active" : ""}`}
                    href={`#${id}`}
                    aria-current={active === id ? "page" : undefined}
                    onClick={close}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="nav-auth d-lg-flex align-items-lg-center gap-lg-2 ms-lg-3">
              {user ? (
                <>
                  <span className="fw-semibold align-self-center me-lg-1">
                    👤 {user.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => {
                      close();
                      onLogout();
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => {
                      close();
                      onLogin();
                    }}
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      close();
                      onSignup();
                    }}
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

/* ----------------------------------- Hero ---------------------------------- */

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

      {/* Midground: a photo floats at a different depth (hidden on mobile) */}
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
            <a href="#destinations" className="btn btn-accent btn-lg">
              Explore destinations
            </a>
            <a href="#tours" className="btn btn-outline-light btn-lg">
              Plan my trip
            </a>
          </div>
        </div>
      </div>

      <a
        className="scroll-cue"
        href="#destinations"
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
        <a href="#tours" className="btn btn-accent btn-lg">
          Browse tours
        </a>
      </Reveal>
    </section>
  );
}

/* ------------------------------- Details modal ------------------------------ */

function DetailsModal({ selected, onClose }) {
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

/* ------------------------------------ Auth ---------------------------------- */

function AuthModal({ mode, onSwitch, onClose, onSuccess }) {
  const isSignup = mode === "signup";

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    // TODO: call your backend here (e.g. POST /auth/login) and use the real user it returns.
    onSuccess({ name: form.get("name") || email.split("@")[0], email });
  };

  return (
    <Modal
      title={isSignup ? "Create your account" : "Log in"}
      onClose={onClose}
      size="modal-sm"
    >
      <form className="p-4" onSubmit={handleSubmit}>
        <h2 className="h4 fw-bold mb-1">
          {isSignup ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-secondary small mb-4">
          {isSignup
            ? "Start planning your Cambodia trip."
            : "Log in to continue planning."}
        </p>

        {isSignup && (
          <div className="mb-3">
            <label className="form-label" htmlFor="auth-name">
              Name
            </label>
            <input
              id="auth-name"
              name="name"
              className="form-control"
              autoComplete="name"
              required
            />
          </div>
        )}
        <div className="mb-3">
          <label className="form-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            className="form-control"
            autoComplete="email"
            required
          />
        </div>
        <div className="mb-4">
          <label className="form-label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            minLength={6}
            className="form-control"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary w-100">
          {isSignup ? "Sign up" : "Log in"}
        </button>
        <p className="text-center small text-secondary mt-3 mb-0">
          {isSignup ? "Already have an account? " : "New to TovNa? "}
          <button
            type="button"
            className="btn btn-link p-0 align-baseline small"
            onClick={onSwitch}
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </form>
    </Modal>
  );
}

/* ---------------------------------- Footer --------------------------------- */

function Footer({ user, onLogin, onSignup }) {
  const links = [
    ["Destinations", "destinations"],
    ["Tours", "tours"],
    ["Activities", "activities"],
  ];

  return (
    <footer className="bg-dark text-white mt-4">
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-lg-5">
            <h3 className="fw-bold">TovNa</h3>
            <p className="text-light opacity-75">
              Discover Cambodia, plan your journey, and create unforgettable
              travel experiences.
            </p>
          </div>

          <div className="col-6 col-lg-3">
            <h6 className="fw-bold">Explore</h6>
            <ul className="list-unstyled mb-0">
              {links.map(([label, id]) => (
                <li className="mb-2" key={id}>
                  <a href={`#${id}`} className="text-light opacity-75">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-6 col-lg-4">
            <h6 className="fw-bold">Account</h6>
            {user ? (
              <p className="text-light opacity-75">Signed in as {user.name}.</p>
            ) : (
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  onClick={onLogin}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onSignup}
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>

        <hr className="my-4" />
        <div className="d-flex flex-wrap justify-content-between gap-2 text-secondary small">
          <span>
            © {new Date().getFullYear()} TovNa. Smart travel planning for
            Cambodia.
          </span>
          <a href="#home" className="text-light opacity-75">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------------- App ----------------------------------- */

export default function App() {
  const destinations = useApiList("/destinations/");
  const tours = useApiList("/tours/");
  const activities = useApiList("/activities/");
  const active = useActiveSection(SECTION_IDS);

  const [selected, setSelected] = useState(null); // { kind: "destination" | "tour", data }
  const [loadingId, setLoadingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState(null); // "login" | "signup" | null
  const [user, setUser] = useState(null);

  async function handleViewDestination(id) {
    setLoadingId(id);
    setNotice("");
    try {
      setSelected({
        kind: "destination",
        data: await fetchJson(`/destinations/${id}`),
      });
    } catch (error) {
      console.error("Error fetching destination:", error);
      setNotice("We couldn't load that destination. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <Navbar
        active={active}
        user={user}
        onLogin={() => setAuthMode("login")}
        onSignup={() => setAuthMode("signup")}
        onLogout={() => setUser(null)}
      />

      <main>
        <Hero />

        {notice && (
          <div className="container">
            <div className="alert alert-warning" role="alert">
              {notice}
            </div>
          </div>
        )}

        <Section
          id="destinations"
          title="Popular destinations"
          subtitle="Explore beautiful places and unforgettable experiences."
          tinted
          status={destinations.status}
          count={destinations.data.length}
          onRetry={destinations.retry}
        >
          {destinations.data.map((d, i) => (
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
                onClick={() => handleViewDestination(d.id)}
              >
                {loadingId === d.id ? "Loading…" : "View details"}
              </button>
            </Card>
          ))}
        </Section>

        <Section
          id="tours"
          title="Popular tours"
          subtitle="Find exciting tours and discover more of Cambodia."
          status={tours.status}
          count={tours.data.length}
          onRetry={tours.retry}
        >
          {tours.data.map((t, i) => (
            <Card item={t} index={i} key={t.id}>
              <h3 className="h5 fw-bold mb-1">{t.name}</h3>
              <p className="text-secondary small mb-3">
                🗓️ {t.duration_days} days
              </p>
              <p className="text-secondary" style={clampThree}>
                {t.description}
              </p>
              <div className="d-flex justify-content-between align-items-center mt-auto pt-2">
                <span className="price fs-5">{money(t.price)}</span>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => setSelected({ kind: "tour", data: t })}
                >
                  View tour
                </button>
              </div>
            </Card>
          ))}
        </Section>

        <Section
          id="activities"
          title="Popular activities"
          subtitle="Enjoy exciting activities and unforgettable experiences."
          tinted
          status={activities.status}
          count={activities.data.length}
          onRetry={activities.retry}
        >
          {activities.data.map((a, i) => (
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
          ))}
        </Section>

        <StoryBand />

        <section className="section">
          <div className="container">
            <Reveal blur className="text-center mb-5">
              <h2 className="section-title">
                Everything you need for your trip
              </h2>
              <p className="section-subtitle mb-0">
                Plan, discover and enjoy your Cambodia journey in one place.
              </p>
            </Reveal>
            <div className="row g-4">
              {FEATURES.map(({ icon, title, text }, i) => (
                <Reveal
                  className="col-sm-6 col-lg-3"
                  delay={i * 100}
                  key={title}
                >
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
      </main>

      <Footer
        user={user}
        onLogin={() => setAuthMode("login")}
        onSignup={() => setAuthMode("signup")}
      />

      {selected && (
        <DetailsModal selected={selected} onClose={() => setSelected(null)} />
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSwitch={() =>
            setAuthMode(authMode === "login" ? "signup" : "login")
          }
          onSuccess={(newUser) => {
            setUser(newUser);
            setAuthMode(null);
          }}
        />
      )}
    </>
  );
}
