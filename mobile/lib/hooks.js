import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "./api";

// Same idea as the website's useApiList: { data, status, retry }
export function useApiList(path) {
  const [state, setState] = useState({ data: [], status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: "loading" }));

    fetchJson(path, controller.signal)
      .then((json) => {
        const list = Array.isArray(json)
          ? json
          : (json?.items ?? json?.results ?? json?.data ?? []);
        setState({ data: list, status: "ready" });
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ data: [], status: "error" });
      });

    return () => controller.abort();
  }, [path, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, retry };
}

export const money = (value) =>
  value == null || Number.isNaN(Number(value))
    ? "Ask for price"
    : `$${Number(value).toLocaleString()}`;

// Destination / tour quick view (same logic as the website's useDetails)
export function useDetails() {
  const [selected, setSelected] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [notice, setNotice] = useState("");

  async function viewDestination(id) {
    setLoadingId(id);
    setNotice("");
    try {
      const [destination, tours, activities] = await Promise.all([
        fetchJson(`/destinations/${id}`),
        fetchJson("/tours/"),
        fetchJson("/activities/"),
      ]);
      const list = (x) => (Array.isArray(x) ? x : []);
      setSelected({
        kind: "destination",
        data: {
          ...destination,
          tours: list(tours).filter(
            (t) => Number(t.destination_id) === Number(id),
          ),
          activities: list(activities).filter(
            (a) => Number(a.destination_id) === Number(id),
          ),
        },
      });
    } catch (error) {
      console.error("Error fetching destination details:", error);
      setNotice("We couldn’t load that destination. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  function viewTour(data) {
    setSelected({ kind: "tour", data });
    setNotice("");
  }

  function viewActivity(data) {
    setSelected({ kind: "activity", data });
    setNotice("");
  }

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
    viewActivity,
    close,
  };
}
