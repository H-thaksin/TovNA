import { useEffect, useRef, useState } from "react";
import { fetchJson } from "./api";

// Loads a list from the API and tracks loading, ready, and error states.
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

  function retry() {
    setAttempt((previous) => previous + 1);
  }

  return { data, status, retry };
}

// Tracks scroll progress by updating the CSS variable --p.
// mode = "leave": progress increases as the element scrolls out.
// mode = "pass": progress increases as the element passes through the viewport.
export function useScrollProgress(mode = "leave") {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;

    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frame = 0;

    function update() {
      frame = 0;

      const { top, height } = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      if (height === 0) return;

      const raw =
        mode === "leave"
          ? -top / height
          : (viewportHeight - top) / (viewportHeight + height);

      const progress = Math.min(1, Math.max(0, raw));

      element.style.setProperty("--p", progress.toFixed(3));
    }

    function onScroll() {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    }

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

// Manages destination and tour detail pop-ups.
export function useDetails() {
  const [selected, setSelected] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [notice, setNotice] = useState("");

  // Fetch destination details, related tours, and activities.
  async function viewDestination(id) {
    setLoadingId(id);
    setNotice("");

    try {
      const [destination, tours, activities] = await Promise.all([
        fetchJson(`/destinations/${id}`),
        fetchJson("/tours/"),
        fetchJson("/activities/"),
      ]);

      const destinationTours = tours.filter(
        (tour) => Number(tour.destination_id) === Number(id),
      );

      const destinationActivities = activities.filter(
        (activity) => Number(activity.destination_id) === Number(id),
      );

      setSelected({
        kind: "destination",
        data: {
          ...destination,
          tours: destinationTours,
          activities: destinationActivities,
        },
      });
    } catch (error) {
      console.error("Error fetching destination details:", error);

      setNotice("We couldn't load that destination. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  // Open tour details.
  function viewTour(data) {
    setSelected({
      kind: "tour",
      data,
    });

    setNotice("");
  }

  // Close the details pop-up.
  function close() {
    setSelected(null);
    setNotice("");
  }

  return {
    selected,
    loadingId,
    notice,
    viewDestination,
    viewTour,
    close,
  };
}
