import { useState } from "react";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Destinations", href: "#destinations" },
  { label: "Tours", href: "#tours" },
  { label: "Activities", href: "#activities" },
];

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState("#home");

  const handleNavigate = (href) => {
    setActive(href);
    setIsOpen(false); // close the mobile menu after a click
  };

  return (
    <header className="sticky-top bg-white border-bottom">
      <nav className="navbar navbar-expand-lg" aria-label="Main navigation">
        <div className="container">
          <a
            className="navbar-brand fw-bold"
            href="#home"
            onClick={() => handleNavigate("#home")}
          >
            TovNa
          </a>

          <button
            className="navbar-toggler"
            type="button"
            aria-controls="main-menu"
            aria-expanded={isOpen}
            aria-label="Toggle navigation"
            onClick={() => setIsOpen((open) => !open)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div
            className={`collapse navbar-collapse ${isOpen ? "show" : ""}`}
            id="main-menu"
          >
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
              {NAV_LINKS.map(({ label, href }) => (
                <li className="nav-item" key={href}>
                  <a
                    className={`nav-link ${active === href ? "active fw-semibold" : ""}`}
                    href={href}
                    aria-current={active === href ? "page" : undefined}
                    onClick={() => handleNavigate(href)}
                  >
                    {label}
                  </a>
                </li>
              ))}

              <li className="nav-item ms-lg-2">
                <a className="btn btn-outline-primary btn-sm" href="#login">
                  Log in
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="home" className="container py-5">
      <div className="text-center py-lg-5">
        <h1 className="display-4 fw-bold">Where are you going?</h1>
        <p className="lead">
          Discover amazing places and experiences in Cambodia with TovNa.
        </p>
        <a href="#destinations" className="btn btn-primary btn-lg">
          Explore destinations
        </a>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
      </main>
    </>
  );
}
