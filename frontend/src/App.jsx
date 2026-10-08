import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { TOKEN_KEY, fetchCurrentUser } from "./lib/api";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import Home from "./pages/Home";
import Destinations from "./pages/Destinations";
import Tours from "./pages/Tours";
import Activities from "./pages/Activities";

// Every new page starts at the top.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

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

export default function App() {
  const [authMode, setAuthMode] = useState(null); // "login" | "signup" | null
  const [user, setUser] = useState(null);

  // Restore the session after a page refresh.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    fetchCurrentUser(token)
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <>
      <ScrollToTop />
      <Navbar
        user={user}
        onLogin={() => setAuthMode("login")}
        onSignup={() => setAuthMode("signup")}
        onLogout={handleLogout}
      />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/tours" element={<Tours />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer
        user={user}
        onLogin={() => setAuthMode("login")}
        onSignup={() => setAuthMode("signup")}
      />

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
