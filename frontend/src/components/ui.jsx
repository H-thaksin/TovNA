import { useEffect, useRef, useState } from "react";

export const clampThree = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export const money = (value) =>
  value == null || Number.isNaN(Number(value))
    ? "Ask for price"
    : `$${Number(value).toLocaleString()}`;

// Fades and lifts its content into place the first time it scrolls into view.
export function Reveal({
  as: Tag = "div",
  delay = 0,
  blur = false,
  className = "",
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") return setVisible(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${blur ? "reveal--blur" : ""} ${visible ? "is-visible" : ""} ${className}`}
      style={{ "--d": delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function SafeImage({ src, alt, style, className, eager = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`d-flex align-items-center justify-content-center fs-1 ${className ?? ""}`}
        style={{
          background: "linear-gradient(135deg, #0f766e, #134e4a)",
          color: "rgba(255,255,255,.85)",
          ...style,
        }}
      >
        🌿
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

// Bootstrap's modal styles without its JavaScript.
export function Modal({ title, onClose, size = "modal-lg", children }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, []);

  return (
    <>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={onClose}
      >
        <div
          className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content tovna-card tovna-card--static">
            <button
              type="button"
              className="btn-close position-absolute top-0 end-0 m-3"
              style={{ zIndex: 2 }}
              aria-label="Close"
              onClick={onClose}
            />
            {children}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

// A titled block with loading / error / empty states. Leave `title` out on list pages.
export function Section({
  id,
  title,
  subtitle,
  status,
  count,
  onRetry,
  tinted,
  action,
  children,
}) {
  return (
    <section id={id} className={`section ${tinted ? "bg-white" : ""}`}>
      <div className="container">
        {title && (
          <Reveal blur className="text-center mb-5">
            <h2 className="section-title">{title}</h2>
            {subtitle && <p className="section-subtitle mb-0">{subtitle}</p>}
          </Reveal>
        )}

        {status === "loading" && (
          <div className="text-center py-5" role="status">
            <div className="spinner-border text-primary" aria-hidden="true" />
            <p className="text-secondary mt-3 mb-0">Loading…</p>
          </div>
        )}
        {status === "error" && (
          <div className="text-center py-5" role="alert">
            <p className="mb-3">
              We couldn't load this section. Check that the server is running,
              then try again.
            </p>
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {status === "ready" && count === 0 && (
          <p className="text-center text-secondary py-5 mb-0">
            Nothing here yet. Check back soon.
          </p>
        )}
        {status === "ready" && count > 0 && (
          <>
            <div className="row g-4">{children}</div>
            {action && <div className="text-center mt-5">{action}</div>}
          </>
        )}
      </div>
    </section>
  );
}

export function PageHeader({ title, subtitle }) {
  return (
    <header className="page-hero">
      <div className="container text-center">
        <h1 className="rise">{title}</h1>
        <p className="rise" style={{ "--d": 120 }}>
          {subtitle}
        </p>
      </div>
    </header>
  );
}
