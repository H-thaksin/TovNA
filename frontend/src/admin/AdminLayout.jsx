import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./AdminLayout.css";

const menuItems = [
  { label: "Dashboard", path: "/admin", icon: "▦" },
  { label: "Bookings", path: "/admin/bookings", icon: "▣" },
  { label: "Users", path: "/admin/users", icon: "♙" },
  { label: "Destinations", path: "/admin/destinations", icon: "⌖" },
  { label: "Hotels", path: "/admin/hotels", icon: "⌂" },
  { label: "Tours", path: "/admin/tours", icon: "✈" },
  { label: "Activities", path: "/admin/activities", icon: "✧" },
  { label: "Transportation", path: "/admin/transportation", icon: "⇄" },
  { label: "Payments", path: "/admin/payments", icon: "＄" },
];

export default function AdminLayout({ user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-brand">
          <h2>TovNa</h2>
          <span>ADMIN PANEL</span>
        </div>

        <nav className="admin-nav">
          <p className="admin-nav-label">MAIN MENU</p>

          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `admin-nav-link ${isActive ? "active" : ""}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-user">
            <div className="admin-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>
            <div className="admin-user-info">
              <strong>{user?.name || "Administrator"}</strong>
              <span>Administrator</span>
            </div>
          </div>

          <button className="admin-logout" onClick={handleLogout}>
            ↪ Log out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="admin-overlay"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>

          <div>
            <span className="admin-topbar-title">TovNa Management</span>
          </div>

          <div className="admin-topbar-user">
            <span>{user?.email}</span>
            <div className="admin-avatar small">
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
