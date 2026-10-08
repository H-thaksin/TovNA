import { useEffect, useRef, useState } from "react";
import { fetchJson } from "./api";

// Loads a list from the API and tracks loading / ready / error.
export function useApiList(path) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchJson(path, controller.signal)
      .then((items) => {
        setData(items);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error(`Error fetching ${path}:`, error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [path, attempt]);

  return { data, status, retry: () => setAttempt((n) => n + 1) };
}

// Writes --p (0 to 1) on the element as it scrolls. No React re-renders, so scrolling stays smooth.
// "leave": 0 at the top of the page, 1 once the element has scrolled out. "pass": 0 as it enters, 1 as it exits.
export function useScrollProgress(mode = "leave") {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const { top, height } = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (top > vh || top + height < 0) return; // off screen
      const raw = mode === "leave" ? -top / height : (vh - top) / (vh + height);
      el.style.setProperty("--p", Math.min(1, Math.max(0, raw)).toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [mode]);

  return ref;
}

// Details pop-up state shared by the home page and the list pages.
export function useDetails() {
  const [selected, setSelected] = useState(null); // { kind: "destination" | "tour", data }
  const [loadingId, setLoadingId] = useState(null);
  const [notice, setNotice] = useState("");

  async function viewDestination(id) {
    setLoadingId(id);
    setNotice("");
    try {
      setSelected({
        kind: "destination",
        data: await fetchJson(`/destinations/${id}`),
      });
    } catch (error) {
      console.error("Error fetching destination:", error);
      setNotice("We couldn't load that destination. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  return {
    selected,
    loadingId,
    notice,
    viewDestination,
    viewTour: (data) => setSelected({ kind: "tour", data }),
    close: () => setSelected(null),
  };
}
