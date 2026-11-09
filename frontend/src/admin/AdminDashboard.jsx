import { useEffect, useState } from "react";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
  }, []);

  if (loading) {
    return <div className="admin-message">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="admin-error">
        <h3>Unable to load dashboard</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  const cards = [
    {
      label: "Total Bookings",
      value: stats.bookings.total,
      icon: "▣",
      color: "blue",
    },
    {
      label: "Pending Bookings",
      value: stats.bookings.pending,
      icon: "◷",
      color: "orange",
    },
    {
      label: "Total Users",
      value: stats.users.total,
      icon: "♙",
      color: "purple",
    },
    {
      label: "Total Revenue",
      value: `$${Number(stats.revenue).toFixed(2)}`,
      icon: "$",
      color: "green",
    },
  ];

  const bookingStatuses = [
    { label: "Pending", value: stats.bookings.pending, color: "#f59e0b" },
    { label: "Confirmed", value: stats.bookings.confirmed, color: "#16a34a" },
    { label: "Rejected", value: stats.bookings.rejected, color: "#ef4444" },
    { label: "Cancelled", value: stats.bookings.cancelled, color: "#94a3b8" },
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-page-heading">
        <div>
          <h1>Dashboard Overview</h1>
          <p>Welcome back! Here's what's happening with TovNa.</p>
        </div>
        <span className="admin-role-badge">Administrator</span>
      </div>

      <div className="admin-stat-grid">
        {cards.map((card) => (
          <div className="admin-stat-card" key={card.label}>
            <div className={`admin-stat-icon ${card.color}`}>{card.icon}</div>
            <div>
              <p>{card.label}</p>
              <h2>{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h3>Booking Overview</h3>
              <p>Current booking status</p>
            </div>
            <strong>{stats.bookings.total} Total</strong>
          </div>

          <div className="admin-status-list">
            {bookingStatuses.map((status) => {
              const percentage =
                stats.bookings.total > 0
                  ? (status.value / stats.bookings.total) * 100
                  : 0;

              return (
                <div className="admin-status-item" key={status.label}>
                  <div className="admin-status-info">
                    <span>
                      <i style={{ backgroundColor: status.color }} />
                      {status.label}
                    </span>
                    <strong>{status.value}</strong>
                  </div>

                  <div className="admin-progress">
                    <div
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: status.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h3>User Overview</h3>
              <p>Registered platform users</p>
            </div>
          </div>

          <div className="admin-user-summary">
            <div className="admin-user-summary-item">
              <span className="user-dot customer-dot" />
              <span>Customers</span>
              <strong>{stats.users.customers}</strong>
            </div>

            <div className="admin-user-summary-item">
              <span className="user-dot staff-dot" />
              <span>Staff (Admin & Agent)</span>
              <strong>{stats.users.staff}</strong>
            </div>
          </div>

          <div className="admin-user-total">
            <span>Total registered users</span>
            <strong>{stats.users.total}</strong>
          </div>
        </section>
      </div>
    </div>
  );
}
