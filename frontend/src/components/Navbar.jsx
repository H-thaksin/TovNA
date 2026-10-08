import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

const NAV_LINKS = [
  { label: "Home", to: "/", end: true },
  { label: "Destinations", to: "/destinations" },
  { label: "Tours", to: "/tours" },
  { label: "Activities", to: "/activities" },
];

export default function Navbar({ user, onLogin, onSignup, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  return (
    <header className="tovna-header sticky-top">
      <nav className="navbar navbar-expand-lg" aria-label="Main navigation">
        <div className="container py-1">
          <Link className="navbar-brand" to="/" onClick={close}>
            <span className="text-primary">Tov</span>
            <span style={{ color: "var(--tovna-accent)" }}>Na</span>
          </Link>

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
              {NAV_LINKS.map(({ label, to, end }) => (
                <li className="nav-item" key={to}>
                  {/* NavLink adds the "active" class and aria-current for the page you're on */}
                  <NavLink
                    className="nav-link"
                    to={to}
                    end={end}
                    onClick={close}
                  >
                    {label}
                  </NavLink>
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
