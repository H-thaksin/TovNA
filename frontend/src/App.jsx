import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { TOKEN_KEY, fetchCurrentUser } from "./lib/api";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";

// Customer pages
import Home from "./pages/Home";
import Destinations from "./pages/Destinations";
import Tours from "./pages/Tours";
import Activities from "./pages/Activities";
import ArticlePage from "./pages/ArticlePage";
import Articles from "./pages/Articles";
import Hotels from "./pages/Hotels";
import HotelDetail from "./pages/Hoteldetail";
import HotelBooking from "./pages/Hotelbooking";
import MyBookings from "./pages/MyBookings";
import BookingDetails from "./pages/BookingDetails";
import MyPayments from "./pages/MyPayments";
import Transportation from "./pages/Transportation";

// Admin pages
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminUsers from "./admin/AdminUsers";
import AdminBookings from "./admin/AdminBookings";
import AdminDestinations from "./admin/AdminDestinations";
import AdminHotels from "./admin/AdminHotels";
import AdminTours from "./admin/AdminTours";
import AdminActivities from "./admin/AdminActivities";
import AdminTransportation from "./admin/AdminTransportation";
import AdminPayments from "./admin/AdminPayments";

// Scroll to the top when changing pages.
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

// Customer-facing 404 page.
function NotFound() {
  return (
    <section className="section text-center">
      <div className="container">
        <h1 className="fw-bold">Page not found</h1>
        <p className="text-secondary">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
      </div>
    </section>
  );
}

// Shown for admin URLs that have no page yet. It prints the path so a
// wrong sidebar link is easy to spot.
function AdminComingSoon() {
  const { pathname } = useLocation();

  return (
    <div>
      <h1>Coming Soon</h1>
      <p className="text-secondary">
        No admin page exists for <code>{pathname}</code> yet.
      </p>
    </div>
  );
}

// Protect all admin routes.
function AdminGuard({ user, authReady }) {
  if (!authReady) {
    return <div className="admin-message">Checking permissions...</div>;
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default function App() {
  const [authMode, setAuthMode] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");

  const openLogin = () => setAuthMode("login");
  const openSignup = () => setAuthMode("signup");

  // Restore the login session after a page refresh.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setAuthReady(true);
      return;
    }

    fetchCurrentUser(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => {
        setAuthReady(true);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <>
      <ScrollToTop />

      {/* Hide the customer navbar inside the admin panel. */}
      {!isAdminPage && (
        <Navbar
          user={user}
          onLogin={openLogin}
          onSignup={openSignup}
          onLogout={handleLogout}
        />
      )}

      <main>
        <Routes>
          {/* Customer website routes */}
          <Route path="/" element={<Home />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/tours" element={<Tours />} />
          <Route path="/activities" element={<Activities />} />

          <Route path="/articles" element={<Articles />} />
          <Route path="/articles/:type" element={<Articles />} />
          <Route
            path="/articles/:type/:id"
            element={<ArticlePage onLogin={openLogin} />}
          />

          <Route path="/hotels" element={<Hotels />} />
          <Route path="/hotels/:id" element={<HotelDetail />} />
          <Route
            path="/hotels/:id/booking"
            element={<HotelBooking onLogin={openLogin} />}
          />

          <Route path="/transportation" element={<Transportation />} />

          {/* Customer account pages */}
          <Route
            path="/my-bookings"
            element={
              <MyBookings
                user={user}
                authReady={authReady}
                onLogin={openLogin}
              />
            }
          />
          <Route
            path="/my-bookings/:id"
            element={<BookingDetails user={user} onLogin={openLogin} />}
          />
          <Route
            path="/payments"
            element={
              <MyPayments
                user={user}
                authReady={authReady}
                onLogin={openLogin}
              />
            }
          />

          {/* Protected admin routes */}
          <Route element={<AdminGuard user={user} authReady={authReady} />}>
            <Route
              path="/admin"
              element={<AdminLayout user={user} onLogout={handleLogout} />}
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers currentUser={user} />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="destinations" element={<AdminDestinations />} />
              <Route path="hotels" element={<AdminHotels />} />
              <Route path="tours" element={<AdminTours />} />
              <Route path="activities" element={<AdminActivities />} />
              <Route path="transportation" element={<AdminTransportation />} />
              <Route path="payments" element={<AdminPayments />} />

              {/* Any other admin URL shows the placeholder. */}
              <Route path="*" element={<AdminComingSoon />} />
            </Route>
          </Route>

          {/* Keep the 404 route last. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Hide the customer footer inside the admin panel. */}
      {!isAdminPage && (
        <Footer user={user} onLogin={openLogin} onSignup={openSignup} />
      )}

      {/* Login and registration modal */}
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
