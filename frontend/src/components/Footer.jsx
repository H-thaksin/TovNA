import { Link } from "react-router-dom";

const LINKS = [
  ["Destinations", "/destinations"],
  ["Tours", "/tours"],
  ["Activities", "/activities"],
];

export default function Footer({ user, onLogin, onSignup }) {
  return (
    <footer className="bg-dark text-white mt-4">
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-lg-5">
            <h3 className="fw-bold">TovNa</h3>
            <p className="text-light opacity-75">
              Discover Cambodia, plan your journey, and create unforgettable
              travel experiences.
            </p>
          </div>

          <div className="col-6 col-lg-3">
            <h6 className="fw-bold">Explore</h6>
            <ul className="list-unstyled mb-0">
              {LINKS.map(([label, to]) => (
                <li className="mb-2" key={to}>
                  <Link to={to} className="text-light opacity-75">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-6 col-lg-4">
            <h6 className="fw-bold">Account</h6>
            {user ? (
              <p className="text-light opacity-75">Signed in as {user.name}.</p>
            ) : (
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  onClick={onLogin}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onSignup}
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>

        <hr className="my-4" />
        <div className="d-flex flex-wrap justify-content-between gap-2 text-secondary small">
          <span>
            © {new Date().getFullYear()} TovNa. Smart travel planning for
            Cambodia.
          </span>
          <a
            href="#top"
            className="text-light opacity-75"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0 });
            }}
          >
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
