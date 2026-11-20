import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./AdminLayout.css";

const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  bookings: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M16 5a3.2 3.2 0 0 1 0 6M18 14.8c2 .6 3.2 2.3 3.5 5.2" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  bed: (
    <>
      <path d="M3 19V7M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6" />
      <circle cx="7" cy="11" r="1.6" />
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
  bus: (
    <>
      <rect x="4" y="4" width="16" height="13" rx="2" />
      <path d="M4 11h16M8 20v-3M16 20v-3" />
    </>
  ),
  logout: (
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  external: (
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  ),
};

function Icon({ name, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const MENU_GROUPS = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", path: "/admin", icon: "dashboard" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Bookings", path: "/admin/bookings", icon: "bookings" },
      { label: "Payments", path: "/admin/payments", icon: "card" },
      { label: "Users", path: "/admin/users", icon: "users" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Destinations", path: "/admin/destinations", icon: "map" },
      { label: "Hotels", path: "/admin/hotels", icon: "bed" },
      { label: "Tours", path: "/admin/tours", icon: "route" },
      { label: "Activities", path: "/admin/activities", icon: "ticket" },
      { label: "Transportation", path: "/admin/transportation", icon: "bus" },
    ],
  },
];

const ALL_ITEMS = MENU_GROUPS.flatMap((group) => group.items);

export default function AdminLayout({ user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const initial = user?.name?.charAt(0)?.toUpperCase() || "A";

  // The page title follows the address, e.g. /admin/hotels -> "Hotels".
  const current =
    [...ALL_ITEMS]
      .sort((a, b) => b.path.length - a.path.length)
      .find(
        (item) =>
          pathname === item.path || pathname.startsWith(`${item.path}/`),
      ) ?? ALL_ITEMS[0];

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  // Close the phone menu with Escape, and stop the page behind it from scrolling.
  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const onKeyDown = (event) =>
      event.key === "Escape" && setSidebarOpen(false);
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="al-layout">
      <aside
        className={`al-sidebar ${sidebarOpen ? "is-open" : ""}`}
        aria-label="Admin sidebar"
      >
        <div className="al-brand">
          <span className="al-brand-mark" aria-hidden="true">
            T
          </span>
          <div>
            <strong>
              Tov<span>Na</span>
            </strong>
            <small>Admin panel</small>
          </div>
        </div>

        <nav className="al-nav" aria-label="Admin menu">
          {MENU_GROUPS.map((group) => (
            <div className="al-group" key={group.label}>
              <p className="al-group-label">{group.label}</p>

              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/admin"}
                  className={({ isActive }) =>
                    `al-link ${isActive ? "is-active" : ""}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="al-bottom">
          <Link to="/" className="al-site-link">
            <Icon name="external" size={16} />
            View website
          </Link>

          <div className="al-user">
            <div className="al-avatar">{initial}</div>
            <div className="al-user-info">
              <strong>{user?.name || "Administrator"}</strong>
              <span>Administrator</span>
            </div>
          </div>

          <button type="button" className="al-logout" onClick={handleLogout}>
            <Icon name="logout" size={16} />
            Log out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="al-overlay"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="al-main">
        <header className="al-topbar">
          <button
            type="button"
            className="al-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
          >
            <Icon name="menu" size={22} />
          </button>

          <div className="al-title">
            <span>TovNa Management</span>
            <strong>{current.label}</strong>
          </div>

          <div className="al-topbar-user">
            <div className="al-topbar-text">
              <strong>{user?.name || "Administrator"}</strong>
              {user?.email && <span>{user.email}</span>}
            </div>
            <div className="al-avatar al-avatar--small">{initial}</div>
          </div>
        </header>

        <main className="al-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
