import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";

// Main site links. Account pages live in the user menu instead.
const NAV_LINKS = [
  { label: "Home", to: "/", end: true },
  { label: "Articles", to: "/articles" },
  { label: "Hotels", to: "/hotels" },
  { label: "Destinations", to: "/destinations" },
  { label: "Tours", to: "/tours" },
  { label: "Activities", to: "/activities" },
  { label: "Transportation", to: "/transportation" },
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
    <div className="nav-user" ref={menuRef}>
      <button
        type="button"
        className={`nav-user-trigger ${open ? "is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="nav-user-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="nav-user-name">{displayName}</span>
        <span className="nav-user-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="nav-user-menu" role="menu">
          <div className="nav-user-menu-header">
            <strong>{displayName}</strong>
            {user.email && <span>{user.email}</span>}
          </div>

          <Link
            to="/my-bookings"
            role="menuitem"
            className="nav-user-item"
            onClick={handleSelect}
          >
            My Bookings
          </Link>

          <Link
            to="/payments"
            role="menuitem"
            className="nav-user-item"
            onClick={handleSelect}
          >
            My Payments
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              role="menuitem"
              className="nav-user-item"
              onClick={handleSelect}
            >
              Admin panel
            </Link>
          )}

          <div className="nav-user-divider" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="nav-user-item is-danger"
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
                    className="nav-link tovna-nav-link"
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
                <UserMenu user={user} onLogout={onLogout} onNavigate={close} />
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
