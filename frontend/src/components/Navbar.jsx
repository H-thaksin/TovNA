import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import "./Navbar.css";
import logo from "../assets/logo.png";

// Main site links. Account pages live in the user menu instead.
const NAV_LINKS = [
  { label: "Home", to: "/", end: true },
  { label: "AI Assistant", to: "/ai-assistant" },
  { label: "Explore", to: "/articles" },
  { label: "Hotels", to: "/hotels" },
  { label: "Transportation", to: "/transportation" },
  { label: "Recommendations", to: "/recommendations" },
];

function UserMenu({ user, onLogout, onNavigate }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const isAdmin = user.role === "admin";
  const displayName = user.name || user.email || "Account";
  const initial = displayName.trim().charAt(0).toUpperCase();

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleSelect() {
    setOpen(false);
    onNavigate();
  }

  return (
    <div className="nb-user" ref={menuRef}>
      <button
        type="button"
        className={`nb-user-trigger ${open ? "is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="nb-user-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="nb-user-name">{displayName}</span>
        <span className="nb-user-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="nb-user-menu" role="menu">
          <div className="nb-user-menu-header">
            <strong>{displayName}</strong>
            {user.email && <span>{user.email}</span>}
          </div>

          <Link
            to="/my-bookings"
            role="menuitem"
            className="nb-user-item"
            onClick={handleSelect}
          >
            My Bookings
          </Link>

          <Link
            to="/payments"
            role="menuitem"
            className="nb-user-item"
            onClick={handleSelect}
          >
            My Payments
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              role="menuitem"
              className="nb-user-item"
              onClick={handleSelect}
            >
              Admin panel
            </Link>
          )}

          <div className="nb-user-divider" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="nb-user-item is-danger"
            onClick={() => {
              setOpen(false);
              onNavigate();
              onLogout();
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar({ user, onLogin, onSignup, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  const close = () => setIsOpen(false);

  // A soft shadow appears once the page scrolls under the bar.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the phone menu when the page changes or Escape is pressed.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && setIsOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <header className={`nb-header ${scrolled ? "is-scrolled" : ""}`}>
      <nav className="container nb-inner" aria-label="Main navigation">
        <Link
          className="nb-brand"
          to="/"
          onClick={close}
          aria-label="TovNa home"
        >
          <img
            src={logo}
            alt="TovNa"
            className="nb-brand-logo nb-brand-logo--full"
          />
        </Link>

        <button
          className="nb-toggle"
          type="button"
          aria-controls="main-menu"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className={`nb-burger ${isOpen ? "is-open" : ""}`} />
        </button>

        <div className={`nb-panel ${isOpen ? "is-open" : ""}`} id="main-menu">
          <ul className="nb-links">
            {NAV_LINKS.map(({ label, to, end }) => (
              <li key={to}>
                <NavLink className="nb-link" to={to} end={end} onClick={close}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="nb-auth">
            {user ? (
              <UserMenu user={user} onLogout={onLogout} onNavigate={close} />
            ) : (
              <>
                <button
                  type="button"
                  className="nb-btn nb-btn--ghost"
                  onClick={() => {
                    close();
                    onLogin();
                  }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className="nb-btn nb-btn--solid"
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
      </nav>
    </header>
  );
}
