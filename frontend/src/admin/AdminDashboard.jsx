import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminDashboard.css";

const ICONS = {
  bookings: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M16 5a3.2 3.2 0 0 1 0 6M18 14.8c2 .6 3.2 2.3 3.5 5.2" />
    </>
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.2c-.4-1-1.3-1.5-2.5-1.5-1.5 0-2.5.8-2.5 1.9s1 1.6 2.5 2 2.5.9 2.5 2-1 1.9-2.5 1.9c-1.2 0-2.2-.5-2.6-1.6M12 6v1.7M12 16.3V18" />
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
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14 4.5L20 15M20 20v-5h-5" />
    </>
  ),
};

function Icon({ name, size = 22 }) {
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

const QUICK_LINKS = [
  { label: "Bookings", to: "/admin/bookings", icon: "bookings" },
  { label: "Payments", to: "/admin/payments", icon: "card" },
  { label: "Users", to: "/admin/users", icon: "users" },
  { label: "Destinations", to: "/admin/destinations", icon: "map" },
  { label: "Hotels", to: "/admin/hotels", icon: "bed" },
  { label: "Tours", to: "/admin/tours", icon: "route" },
  { label: "Activities", to: "/admin/activities", icon: "ticket" },
  { label: "Transportation", to: "/admin/transportation", icon: "bus" },
];

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const money = (value) =>
  `$${num(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Counts from the last shown value up (or down) to the new one.
function useCountUp(target, duration = 1200) {
  const end = num(target);
  const fromRef = useRef(prefersReducedMotion() ? end : 0);
  const [value, setValue] = useState(fromRef.current);

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = end;
      setValue(end);
      return undefined;
    }

    const from = fromRef.current;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // fast start, soft landing
      const current = from + (end - from) * eased;

      fromRef.current = current;
      setValue(current);

      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [end, duration]);

  return value;
}

function Count({ value, format }) {
  const current = useCountUp(value);
  return format ? format(current) : Math.round(current);
}

// Ring chart drawn with SVG, so it needs no chart library.
function BookingDonut({ segments, total }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = useCountUp(1, 1400); // 0 -> 1, so the ring sweeps in
  let offset = 0;

  return (
    <div className="ad-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="Bookings by status">
        <circle className="ad-donut-track" cx="70" cy="70" r={radius} />
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => {
              const length = (segment.value / total) * circumference * progress;
              const circle = (
                <circle
                  key={segment.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="16"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 70 70)"
                />
              );
              offset += length;
              return circle;
            })}
      </svg>
      <div className="ad-donut-center">
        <strong>
          <Count value={total} />
        </strong>
        <span>bookings</span>
      </div>
    </div>
  );
}

function SplitBar({ share }) {
  const progress = useCountUp(1, 1200);
  return <div style={{ width: `${share * progress}%` }} />;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem(TOKEN_KEY);

        if (!token) {
          throw new Error("Please log in again.");
        }

        const response = await fetch(`${API_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(readError(data));
        }

        setStats(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to load dashboard statistics.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => controller.abort();
  }, [attempt]);

  const refresh = () => setAttempt((count) => count + 1);

  if (loading && !stats) {
    return (
      <div className="ad-page" role="status" aria-label="Loading dashboard">
        <div className="ad-skeleton ad-skeleton--banner" />
        <div className="ad-stats">
          {[0, 1, 2, 3].map((key) => (
            <div className="ad-skeleton ad-skeleton--stat" key={key} />
          ))}
        </div>
        <div className="ad-skeleton ad-skeleton--panel" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="admin-error" role="alert">
        <h3>Unable to load dashboard</h3>
        <p>{error}</p>
        <button type="button" onClick={refresh}>
          Try again
        </button>
      </div>
    );
  }

  const bookings = stats?.bookings ?? {};
  const users = stats?.users ?? {};

  const totalBookings = num(bookings.total);
  const pending = num(bookings.pending);
  const confirmed = num(bookings.confirmed);

  const statuses = [
    { label: "Pending", value: pending, color: "#f59e0b" },
    { label: "Confirmed", value: confirmed, color: "#0f9d8a" },
    { label: "Rejected", value: num(bookings.rejected), color: "#ef4444" },
    { label: "Cancelled", value: num(bookings.cancelled), color: "#94a3b8" },
  ];

  const totalUsers = num(users.total);
  const customers = num(users.customers);
  const staff = num(users.staff);
  const customerShare = totalUsers > 0 ? (customers / totalUsers) * 100 : 0;

  const cards = [
    {
      label: "Total bookings",
      value: totalBookings,
      note: `${confirmed} confirmed`,
      icon: "bookings",
      tone: "teal",
    },
    {
      label: "Pending bookings",
      value: pending,
      note: pending > 0 ? "Waiting for review" : "All caught up",
      icon: "clock",
      tone: "amber",
      to: "/admin/bookings",
    },
    {
      label: "Total users",
      value: totalUsers,
      note: `${customers} customers, ${staff} staff`,
      icon: "users",
      tone: "violet",
      to: "/admin/users",
    },
    {
      label: "Total revenue",
      value: num(stats?.revenue),
      format: money,
      note: "From payments",
      icon: "dollar",
      tone: "green",
      to: "/admin/payments",
    },
  ];

  return (
    <div className="ad-page">
      {/* ---------- Welcome banner ---------- */}
      <section className="ad-banner" style={{ "--i": 0 }}>
        <div>
          <span className="ad-banner-eyebrow">Administrator</span>
          <h1>{greeting()}, welcome back</h1>
          <p>Here's what's happening with TovNa today.</p>
        </div>

        <div className="ad-banner-actions">
          {pending > 0 && (
            <Link to="/admin/bookings" className="ad-banner-alert">
              <strong>{pending}</strong>
              <span>
                pending {pending === 1 ? "booking" : "bookings"} to review
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          )}

          <button
            type="button"
            className="ad-refresh"
            onClick={refresh}
            disabled={loading}
          >
            <Icon name="refresh" size={16} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {error && (
        <div className="ad-inline-error" role="alert">
          Couldn't refresh the numbers: {error}
        </div>
      )}

      {/* ---------- Stat cards ---------- */}
      <section className="ad-stats" aria-label="Key numbers">
        {cards.map((card, index) => {
          const body = (
            <>
              <span className={`ad-stat-icon ad-tone-${card.tone}`}>
                <Icon name={card.icon} />
              </span>
              <div>
                <p>{card.label}</p>
                <strong>
                  <Count value={card.value} format={card.format} />
                </strong>
                <small>{card.note}</small>
              </div>
            </>
          );

          return card.to ? (
            <Link
              to={card.to}
              className="ad-stat"
              key={card.label}
              style={{ "--i": index + 1 }}
            >
              {body}
            </Link>
          ) : (
            <div
              className="ad-stat"
              key={card.label}
              style={{ "--i": index + 1 }}
            >
              {body}
            </div>
          );
        })}
      </section>

      {/* ---------- Panels ---------- */}
      <div className="ad-grid">
        <section className="ad-panel" style={{ "--i": 5 }}>
          <header className="ad-panel-head">
            <div>
              <h2>Booking overview</h2>
              <p>Current booking status</p>
            </div>
            <Link to="/admin/bookings" className="ad-link">
              View all
            </Link>
          </header>

          <div className="ad-overview">
            <BookingDonut segments={statuses} total={totalBookings} />

            <ul className="ad-legend">
              {statuses.map((status) => {
                const percent =
                  totalBookings > 0
                    ? Math.round((status.value / totalBookings) * 100)
                    : 0;

                return (
                  <li key={status.label}>
                    <span className="ad-legend-name">
                      <i style={{ backgroundColor: status.color }} />
                      {status.label}
                    </span>
                    <span className="ad-legend-value">
                      <strong>
                        <Count value={status.value} />
                      </strong>
                      <small>
                        <Count
                          value={percent}
                          format={(v) => `${Math.round(v)}%`}
                        />
                      </small>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="ad-panel" style={{ "--i": 6 }}>
          <header className="ad-panel-head">
            <div>
              <h2>User overview</h2>
              <p>Registered platform users</p>
            </div>
            <Link to="/admin/users" className="ad-link">
              Manage
            </Link>
          </header>

          <div className="ad-users-total">
            <strong>
              <Count value={totalUsers} />
            </strong>
            <span>total users</span>
          </div>

          <div
            className="ad-split"
            role="img"
            aria-label={`${customers} customers and ${staff} staff`}
          >
            <SplitBar share={customerShare} />
          </div>

          <ul className="ad-user-list">
            <li>
              <span>
                <i className="ad-dot ad-dot--customer" />
                Customers
              </span>
              <strong>
                <Count value={customers} />
              </strong>
            </li>
            <li>
              <span>
                <i className="ad-dot ad-dot--staff" />
                Staff (Admin &amp; Agent)
              </span>
              <strong>
                <Count value={staff} />
              </strong>
            </li>
          </ul>
        </section>
      </div>

      {/* ---------- Quick links ---------- */}
      <section className="ad-panel" style={{ "--i": 7 }}>
        <header className="ad-panel-head">
          <div>
            <h2>Manage your platform</h2>
            <p>Jump straight to a section</p>
          </div>
        </header>

        <div className="ad-quick">
          {QUICK_LINKS.map(({ label, to, icon }) => (
            <Link to={to} className="ad-quick-item" key={to}>
              <span>
                <Icon name={icon} size={20} />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
