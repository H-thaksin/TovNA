import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminTours.css";

const PAGE_SIZE = 8;

const emptyForm = {
  destination_id: "",
  name: "",
  description: "",
  duration_days: "1",
  price: "",
  max_people: "",
  image_url: "",
  is_active: true,
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "duration", label: "Shortest duration" },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function getInitialForm(tour) {
  if (!tour) return { ...emptyForm };

  return {
    destination_id: String(tour.destination_id ?? ""),
    name: tour.name || "",
    description: tour.description || "",
    duration_days: String(tour.duration_days ?? 1),
    price: String(tour.price ?? ""),
    max_people: tour.max_people == null ? "" : String(tour.max_people),
    image_url: tour.image_url || "",
    is_active: tour.is_active ?? true,
  };
}

function validate(form) {
  const errors = {};
  const duration = Number(form.duration_days);
  const price = Number(form.price);
  const maxPeople = Number(form.max_people);

  if (!form.destination_id) {
    errors.destination_id = "Select a destination.";
  }

  if (!form.name.trim()) {
    errors.name = "Tour name is required.";
  }

  if (
    form.duration_days === "" ||
    !Number.isInteger(duration) ||
    duration < 1
  ) {
    errors.duration_days = "Duration must be at least 1 day.";
  }

  if (form.price === "" || !Number.isFinite(price) || price < 0) {
    errors.price = "Enter a price of 0 or more.";
  }

  if (
    form.max_people !== "" &&
    (!Number.isInteger(maxPeople) || maxPeople < 1)
  ) {
    errors.max_people = "Maximum people must be at least 1.";
  }

  return errors;
}

function buildPayload(form) {
  return {
    destination_id: Number(form.destination_id),
    name: form.name.trim(),
    description: String(form.description).trim() || null,
    duration_days: Number(form.duration_days),
    price: Number(form.price),
    max_people: form.max_people === "" ? null : Number(form.max_people),
    image_url: String(form.image_url).trim() || null,
    is_active: form.is_active,
  };
}

async function request(url, options = {}, { auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (auth && (response.status === 401 || response.status === 403)) {
    throw new Error(
      "Your session has expired or you don't have permission. Please log in again.",
    );
  }

  if (!response.ok) {
    throw new Error(readError(data));
  }

  return data;
}

function TourThumb({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className="hotel-image-placeholder">✈</div>;
  }

  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  );
}

export default function AdminTours() {
  const [tours, setTours] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTour, setEditingTour] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const firstFieldRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const [tourData, destinationData] = await Promise.all([
        request(`${API_URL}/tours/`),
        request(`${API_URL}/destinations/`),
      ]);

      setTours(Array.isArray(tourData) ? tourData : []);
      setDestinations(Array.isArray(destinationData) ? destinationData : []);
    } catch (err) {
      setPageError(err.message || "Unable to load tours.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!modalOpen && !deleteTarget) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event) {
      if (event.key !== "Escape") return;

      if (deleteTarget) {
        if (busyId === null) setDeleteTarget(null);
      } else if (!saving) {
        closeModal();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    if (modalOpen) firstFieldRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, deleteTarget, saving, busyId]);

  const destinationMap = useMemo(
    () => new Map(destinations.map((item) => [item.id, item])),
    [destinations],
  );

  const counts = useMemo(
    () => ({
      total: tours.length,
      active: tours.filter((tour) => tour.is_active).length,
      inactive: tours.filter((tour) => !tour.is_active).length,
    }),
    [tours],
  );

  const filteredTours = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = tours.filter((tour) => {
      const destination = destinationMap.get(tour.destination_id);

      const matchesSearch =
        !keyword ||
        [tour.name, tour.description, destination?.name, destination?.province]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && tour.is_active) ||
        (statusFilter === "inactive" && !tour.is_active);

      const matchesDestination =
        destinationFilter === "all" ||
        String(tour.destination_id) === destinationFilter;

      return matchesSearch && matchesStatus && matchesDestination;
    });

    const sorters = {
      newest: (a, b) => b.id - a.id,
      name: (a, b) => a.name.localeCompare(b.name),
      price_asc: (a, b) => Number(a.price) - Number(b.price),
      price_desc: (a, b) => Number(b.price) - Number(a.price),
      duration: (a, b) => a.duration_days - b.duration_days,
    };

    return [...result].sort(sorters[sortBy]);
  }, [tours, destinationMap, search, statusFilter, destinationFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredTours.length / PAGE_SIZE));

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleTours = filteredTours.slice(pageStart, pageStart + PAGE_SIZE);

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    destinationFilter !== "all";

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setDestinationFilter("all");
    setPage(1);
  }

  function getDestinationName(destinationId) {
    const destination = destinationMap.get(destinationId);

    return destination
      ? `${destination.name}, ${destination.province}`
      : `Destination #${destinationId}`;
  }

  function openCreateModal() {
    setEditingTour(null);
    setForm({ ...emptyForm });
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEditModal(tour) {
    setEditingTour(tour);
    setForm(getInitialForm(tour));
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingTour(null);
    setForm({ ...emptyForm });
    setFormError("");
    setFieldErrors({});
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setFieldErrors((current) => {
      if (!current[name]) return current;

      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const errors = validate(form);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setFormError("Please fix the highlighted fields.");
      return;
    }

    const isEditing = Boolean(editingTour);
    setSaving(true);

    try {
      await request(
        isEditing ? `${API_URL}/tours/${editingTour.id}` : `${API_URL}/tours/`,
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(buildPayload(form)),
        },
        { auth: true },
      );

      setNotice(
        isEditing
          ? `${form.name.trim()} was updated.`
          : `${form.name.trim()} was created.`,
      );

      setSaving(false);
      closeModal();
      await loadData();
    } catch (err) {
      setFormError(err.message || "Unable to save tour.");
      setSaving(false);
    }
  }

  async function handleToggleActive(tour) {
    setBusyId(tour.id);
    setPageError("");

    try {
      const nextForm = getInitialForm({
        ...tour,
        is_active: !tour.is_active,
      });

      await request(
        `${API_URL}/tours/${tour.id}`,
        {
          method: "PUT",
          body: JSON.stringify(buildPayload(nextForm)),
        },
        { auth: true },
      );

      setTours((current) =>
        current.map((item) =>
          item.id === tour.id ? { ...item, is_active: !item.is_active } : item,
        ),
      );

      setNotice(
        `${tour.name} is now ${tour.is_active ? "inactive" : "active"}.`,
      );
    } catch (err) {
      setPageError(err.message || "Unable to update tour status.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const tour = deleteTarget;
    setBusyId(tour.id);
    setPageError("");

    try {
      await request(
        `${API_URL}/tours/${tour.id}`,
        { method: "DELETE" },
        { auth: true },
      );

      setNotice(`${tour.name} was deleted.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setDeleteTarget(null);
      setPageError(
        err.message ||
          "Unable to delete tour. Tours connected to bookings or itineraries cannot be deleted. Set them to inactive instead.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const activeDestinations = destinations.filter((item) => item.is_active);

  const formDestinationMissing =
    editingTour &&
    form.destination_id &&
    !activeDestinations.some((item) => String(item.id) === form.destination_id);

  return (
    <section className="admin-hotels-page">
      <div className="admin-hotels-heading">
        <div>
          <h1>Tours</h1>
          <p>Add, edit and manage the tours travelers can book on TovNa.</p>
        </div>

        <div className="hotel-heading-actions">
          <button
            type="button"
            className="hotel-refresh-btn"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>

          <button
            type="button"
            className="hotel-add-btn"
            onClick={openCreateModal}
          >
            + Add tour
          </button>
        </div>
      </div>

      {notice && (
        <div className="hotel-notice" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {pageError && (
        <div className="hotel-error" role="alert">
          <span>{pageError}</span>
          <div className="hotel-error-actions">
            <button type="button" onClick={loadData}>
              Try again
            </button>
            <button
              type="button"
              onClick={() => setPageError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="hotel-stats">
        {[
          { key: "all", label: "Total tours", value: counts.total, tone: "" },
          {
            key: "active",
            label: "Active",
            value: counts.active,
            tone: "active",
          },
          {
            key: "inactive",
            label: "Inactive",
            value: counts.inactive,
            tone: "inactive",
          },
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            className={`hotel-stat-card ${card.tone} ${
              statusFilter === card.key ? "is-selected" : ""
            }`}
            aria-pressed={statusFilter === card.key}
            onClick={() => {
              setStatusFilter(card.key);
              setPage(1);
            }}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </button>
        ))}
      </div>

      <div className="hotel-table-panel">
        <div className="hotel-table-heading">
          <div>
            <h2>All tours</h2>
            <p>
              {filteredTours.length === 1
                ? "1 tour found"
                : `${filteredTours.length} tours found`}
              {hasActiveFilters && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="hotel-link-btn"
                    onClick={resetFilters}
                  >
                    Clear filters
                  </button>
                </>
              )}
            </p>
          </div>

          <div className="hotel-filters">
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by tour or destination"
              aria-label="Search tours"
            />

            <select
              value={destinationFilter}
              onChange={(event) => {
                setDestinationFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by destination"
            >
              <option value="all">All destinations</option>
              {destinations.map((destination) => (
                <option key={destination.id} value={String(destination.id)}>
                  {destination.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort tours"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="hotel-skeleton-list" aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="hotel-skeleton-row" />
            ))}
          </div>
        ) : filteredTours.length === 0 ? (
          <div className="hotel-empty">
            {tours.length === 0 ? (
              <>
                <p>No tours yet.</p>
                <button
                  type="button"
                  className="hotel-add-btn hotel-empty-btn"
                  onClick={openCreateModal}
                >
                  + Add your first tour
                </button>
              </>
            ) : (
              <>
                <p>No tours match your filters.</p>
                <button
                  type="button"
                  className="hotel-link-btn"
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="hotel-table-wrapper">
              <table className="hotel-table">
                <thead>
                  <tr>
                    <th>Tour</th>
                    <th>Destination</th>
                    <th>Duration</th>
                    <th>Price / person</th>
                    <th>Max people</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleTours.map((tour) => (
                    <tr key={tour.id}>
                      <td>
                        <div className="hotel-name-cell">
                          <TourThumb src={tour.image_url} alt={tour.name} />
                          <div>
                            <strong>{tour.name}</strong>
                            <span>{`ID: ${tour.id}`}</span>
                          </div>
                        </div>
                      </td>

                      <td>{getDestinationName(tour.destination_id)}</td>

                      <td>
                        {tour.duration_days}{" "}
                        {tour.duration_days === 1 ? "day" : "days"}
                      </td>

                      <td>{currency.format(Number(tour.price))}</td>

                      <td>{tour.max_people ?? "—"}</td>

                      <td>
                        <button
                          type="button"
                          className={`hotel-status ${
                            tour.is_active ? "is-active" : "is-inactive"
                          }`}
                          onClick={() => handleToggleActive(tour)}
                          disabled={busyId === tour.id}
                          title={
                            tour.is_active
                              ? "Click to set inactive"
                              : "Click to set active"
                          }
                        >
                          {tour.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>

                      <td>
                        <div className="hotel-row-actions">
                          <button
                            type="button"
                            className="hotel-edit-btn"
                            onClick={() => openEditModal(tour)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="hotel-delete-btn"
                            disabled={busyId === tour.id}
                            onClick={() => setDeleteTarget(tour)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hotel-pagination">
              <span>
                Showing {pageStart + 1}–
                {Math.min(pageStart + PAGE_SIZE, filteredTours.length)} of{" "}
                {filteredTours.length}
              </span>

              <div>
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                >
                  Previous
                </button>

                <span>
                  Page {safePage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div
          className="hotel-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className="hotel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-modal-title"
          >
            <div className="hotel-modal-heading">
              <div>
                <h2 id="tour-modal-title">
                  {editingTour ? "Edit tour" : "Add tour"}
                </h2>
                <p>
                  {editingTour
                    ? "Update the tour's details."
                    : "Fill in the details of the new tour."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="hotel-form-grid">
                <label className="hotel-form-full">
                  Destination *
                  <select
                    ref={firstFieldRef}
                    name="destination_id"
                    value={form.destination_id}
                    onChange={updateField}
                    aria-invalid={Boolean(fieldErrors.destination_id)}
                  >
                    <option value="">Select a destination</option>

                    {activeDestinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.name} — {destination.province}
                      </option>
                    ))}

                    {formDestinationMissing && (
                      <option value={form.destination_id}>
                        {getDestinationName(Number(form.destination_id))}{" "}
                        (inactive)
                      </option>
                    )}
                  </select>
                  {fieldErrors.destination_id && (
                    <small className="hotel-field-error">
                      {fieldErrors.destination_id}
                    </small>
                  )}
                </label>

                <label className="hotel-form-full">
                  Tour name *
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    maxLength={200}
                    placeholder="e.g. Kep Coastal Escape"
                    aria-invalid={Boolean(fieldErrors.name)}
                  />
                  {fieldErrors.name && (
                    <small className="hotel-field-error">
                      {fieldErrors.name}
                    </small>
                  )}
                </label>

                <label className="hotel-form-full">
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    rows={3}
                    placeholder="Describe what travelers will experience..."
                  />
                </label>

                <label>
                  Duration (days) *
                  <input
                    type="number"
                    name="duration_days"
                    value={form.duration_days}
                    onChange={updateField}
                    min="1"
                    step="1"
                    aria-invalid={Boolean(fieldErrors.duration_days)}
                  />
                  {fieldErrors.duration_days && (
                    <small className="hotel-field-error">
                      {fieldErrors.duration_days}
                    </small>
                  )}
                </label>

                <label>
                  Price per person (USD) *
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={updateField}
                    min="0"
                    step="0.01"
                    placeholder="e.g. 40.00"
                    aria-invalid={Boolean(fieldErrors.price)}
                  />
                  {fieldErrors.price && (
                    <small className="hotel-field-error">
                      {fieldErrors.price}
                    </small>
                  )}
                </label>

                <label>
                  Maximum people
                  <input
                    type="number"
                    name="max_people"
                    value={form.max_people}
                    onChange={updateField}
                    min="1"
                    step="1"
                    placeholder="e.g. 12"
                    aria-invalid={Boolean(fieldErrors.max_people)}
                  />
                  {fieldErrors.max_people && (
                    <small className="hotel-field-error">
                      {fieldErrors.max_people}
                    </small>
                  )}
                </label>

                <label className="hotel-form-full">
                  Image URL
                  <input
                    name="image_url"
                    value={form.image_url}
                    onChange={updateField}
                    placeholder="/images/kep-tour.jpg"
                  />
                  {form.image_url.trim() && (
                    <img
                      key={form.image_url}
                      className="hotel-image-preview"
                      src={form.image_url.trim()}
                      alt="Tour preview"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </label>
              </div>

              <label className="hotel-active-toggle">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={updateField}
                />
                <span>Active — visible to travelers</span>
              </label>

              {formError && (
                <div className="hotel-error hotel-form-error" role="alert">
                  {formError}
                </div>
              )}

              <div className="hotel-modal-actions">
                <button
                  type="button"
                  className="hotel-cancel-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="hotel-save-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingTour
                      ? "Save changes"
                      : "Create tour"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div
          className="hotel-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && busyId === null) {
              setDeleteTarget(null);
            }
          }}
        >
          <section
            className="hotel-modal hotel-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tour-delete-title"
          >
            <h2 id="tour-delete-title">Delete “{deleteTarget.name}”?</h2>

            <p>
              This can't be undone. Tours connected to bookings or itineraries
              cannot be deleted. Set them to inactive instead.
            </p>

            <div className="hotel-modal-actions">
              <button
                type="button"
                className="hotel-cancel-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={busyId !== null}
              >
                Keep tour
              </button>

              <button
                type="button"
                className="hotel-danger-btn"
                onClick={confirmDelete}
                disabled={busyId !== null}
              >
                {busyId !== null ? "Deleting..." : "Delete tour"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
