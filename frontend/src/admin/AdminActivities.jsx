import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminActivities.css";

const PAGE_SIZE = 8;

const emptyForm = {
  destination_id: "",
  name: "",
  description: "",
  category: "",
  duration_hours: "",
  price: "",
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

async function request(url, options = {}, { auth = false } = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };

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

function getInitialForm(activity) {
  if (!activity) return { ...emptyForm };

  return {
    destination_id: String(activity.destination_id ?? ""),
    name: activity.name || "",
    description: activity.description || "",
    category: activity.category || "",
    duration_hours:
      activity.duration_hours == null ? "" : String(activity.duration_hours),
    price: String(activity.price ?? ""),
    image_url: activity.image_url || "",
    is_active: activity.is_active ?? true,
  };
}

function validate(form) {
  const errors = {};
  const duration = Number(form.duration_hours);
  const price = Number(form.price);

  if (!form.destination_id) {
    errors.destination_id = "Select a destination.";
  }

  if (!form.name.trim()) {
    errors.name = "Activity name is required.";
  }

  if (
    form.duration_hours !== "" &&
    (!Number.isFinite(duration) || duration <= 0 || duration > 99.9)
  ) {
    errors.duration_hours =
      "Duration must be greater than 0 and at most 99.9 hours.";
  }

  if (form.price === "" || !Number.isFinite(price) || price < 0) {
    errors.price = "Enter a price of 0 or more.";
  }

  return errors;
}

function buildPayload(form) {
  return {
    destination_id: Number(form.destination_id),
    name: form.name.trim(),
    description: form.description.trim() || null,
    category: form.category.trim() || null,
    duration_hours:
      form.duration_hours === "" ? null : Number(form.duration_hours),
    price: Number(form.price),
    image_url: form.image_url.trim() || null,
    is_active: form.is_active,
  };
}

function ActivityThumb({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className="hotel-image-placeholder">★</div>;
  }

  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  );
}

export default function AdminActivities() {
  const [activities, setActivities] = useState([]);
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const firstFieldRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const [activityData, destinationData] = await Promise.all([
        request(`${API_URL}/activities/admin/all`, {}, { auth: true }),
        request(`${API_URL}/destinations/`),
      ]);

      setActivities(Array.isArray(activityData) ? activityData : []);
      setDestinations(Array.isArray(destinationData) ? destinationData : []);
    } catch (err) {
      setPageError(err.message || "Unable to load activities.");
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
      total: activities.length,
      active: activities.filter((item) => item.is_active).length,
      inactive: activities.filter((item) => !item.is_active).length,
    }),
    [activities],
  );

  const categories = useMemo(
    () =>
      [
        ...new Set(
          activities.map((item) => item.category?.trim()).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [activities],
  );

  const filteredActivities = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = activities.filter((activity) => {
      const destination = destinationMap.get(activity.destination_id);

      const matchesSearch =
        !keyword ||
        [
          activity.name,
          activity.description,
          activity.category,
          destination?.name,
          destination?.province,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && activity.is_active) ||
        (statusFilter === "inactive" && !activity.is_active);

      const matchesDestination =
        destinationFilter === "all" ||
        String(activity.destination_id) === destinationFilter;

      const matchesCategory =
        categoryFilter === "all" || activity.category === categoryFilter;

      return (
        matchesSearch && matchesStatus && matchesDestination && matchesCategory
      );
    });

    const sorters = {
      newest: (a, b) => b.id - a.id,
      name: (a, b) => a.name.localeCompare(b.name),
      price_asc: (a, b) => Number(a.price) - Number(b.price),
      price_desc: (a, b) => Number(b.price) - Number(a.price),
      duration: (a, b) =>
        Number(a.duration_hours ?? 0) - Number(b.duration_hours ?? 0),
    };

    return [...result].sort(sorters[sortBy]);
  }, [
    activities,
    destinationMap,
    search,
    statusFilter,
    destinationFilter,
    categoryFilter,
    sortBy,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / PAGE_SIZE),
  );

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleActivities = filteredActivities.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    destinationFilter !== "all" ||
    categoryFilter !== "all";

  const activeDestinations = destinations.filter((item) => item.is_active);

  const formDestinationMissing =
    editingActivity &&
    form.destination_id &&
    !activeDestinations.some((item) => String(item.id) === form.destination_id);

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setDestinationFilter("all");
    setCategoryFilter("all");
    setSortBy("newest");
    setPage(1);
  }

  function getDestinationName(destinationId) {
    const destination = destinationMap.get(destinationId);

    return destination
      ? `${destination.name}, ${destination.province || ""}`.replace(/, $/, "")
      : `Destination #${destinationId}`;
  }

  function openCreateModal() {
    setEditingActivity(null);
    setForm({ ...emptyForm });
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEditModal(activity) {
    setEditingActivity(activity);
    setForm(getInitialForm(activity));
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal(force = false) {
    if (saving && !force) return;

    setModalOpen(false);
    setEditingActivity(null);
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

    const isEditing = Boolean(editingActivity);
    const activityName = form.name.trim();

    setSaving(true);

    try {
      await request(
        isEditing
          ? `${API_URL}/activities/${editingActivity.id}`
          : `${API_URL}/activities/`,
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(buildPayload(form)),
        },
        { auth: true },
      );

      setNotice(
        isEditing
          ? `${activityName} was updated.`
          : `${activityName} was created.`,
      );

      closeModal(true);
      setSaving(false);
      await loadData();
    } catch (err) {
      setFormError(err.message || "Unable to save activity.");
      setSaving(false);
    }
  }

  async function handleToggleActive(activity) {
    setBusyId(activity.id);
    setPageError("");

    try {
      const nextForm = getInitialForm({
        ...activity,
        is_active: !activity.is_active,
      });

      await request(
        `${API_URL}/activities/${activity.id}`,
        {
          method: "PUT",
          body: JSON.stringify(buildPayload(nextForm)),
        },
        { auth: true },
      );

      setActivities((current) =>
        current.map((item) =>
          item.id === activity.id
            ? { ...item, is_active: !item.is_active }
            : item,
        ),
      );

      setNotice(
        `${activity.name} is now ${activity.is_active ? "inactive" : "active"}.`,
      );
    } catch (err) {
      setPageError(err.message || "Unable to update activity status.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const activity = deleteTarget;
    setBusyId(activity.id);
    setPageError("");

    try {
      await request(
        `${API_URL}/activities/${activity.id}`,
        { method: "DELETE" },
        { auth: true },
      );

      setNotice(`${activity.name} was deleted.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setDeleteTarget(null);
      setPageError(
        err.message ||
          "Unable to delete activity. Activities connected to bookings or itineraries cannot be deleted. Set them to inactive instead.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-hotels-page admin-activities-page">
      <div className="admin-hotels-heading">
        <div>
          <h1>Activities</h1>
          <p>
            Add, edit and manage the activities travelers can book on TovNa.
          </p>
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
            + Add activity
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
          { key: "all", label: "Total activities", value: counts.total },
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
            className={`hotel-stat-card ${card.tone || ""} ${
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
            <h2>All activities</h2>
            <p>
              {filteredActivities.length === 1
                ? "1 activity found"
                : `${filteredActivities.length} activities found`}
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
              placeholder="Search activities"
              aria-label="Search activities"
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
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
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
              aria-label="Sort activities"
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
        ) : filteredActivities.length === 0 ? (
          <div className="hotel-empty">
            {activities.length === 0 ? (
              <>
                <p>No activities yet.</p>
                <button
                  type="button"
                  className="hotel-add-btn hotel-empty-btn"
                  onClick={openCreateModal}
                >
                  + Add your first activity
                </button>
              </>
            ) : (
              <>
                <p>No activities match your filters.</p>
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
                    <th>Activity</th>
                    <th>Destination</th>
                    <th>Category</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleActivities.map((activity) => (
                    <tr key={activity.id}>
                      <td>
                        <div className="hotel-name-cell">
                          <ActivityThumb
                            src={activity.image_url}
                            alt={activity.name}
                          />
                          <div>
                            <strong>{activity.name}</strong>
                            <span>ID: {activity.id}</span>
                          </div>
                        </div>
                      </td>

                      <td>{getDestinationName(activity.destination_id)}</td>
                      <td>{activity.category || "—"}</td>
                      <td>
                        {activity.duration_hours == null
                          ? "—"
                          : `${activity.duration_hours} ${
                              Number(activity.duration_hours) === 1
                                ? "hour"
                                : "hours"
                            }`}
                      </td>
                      <td>{currency.format(Number(activity.price))}</td>

                      <td>
                        <button
                          type="button"
                          className={`hotel-status ${
                            activity.is_active ? "is-active" : "is-inactive"
                          }`}
                          onClick={() => handleToggleActive(activity)}
                          disabled={busyId === activity.id}
                          title={
                            activity.is_active
                              ? "Click to set inactive"
                              : "Click to set active"
                          }
                        >
                          {activity.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>

                      <td>
                        <div className="hotel-row-actions">
                          <button
                            type="button"
                            className="hotel-edit-btn"
                            onClick={() => openEditModal(activity)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="hotel-delete-btn"
                            disabled={busyId === activity.id}
                            onClick={() => setDeleteTarget(activity)}
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
                {Math.min(pageStart + PAGE_SIZE, filteredActivities.length)} of{" "}
                {filteredActivities.length}
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
            aria-labelledby="activity-modal-title"
          >
            <div className="hotel-modal-heading">
              <div>
                <h2 id="activity-modal-title">
                  {editingActivity ? "Edit activity" : "Add activity"}
                </h2>
                <p>
                  {editingActivity
                    ? "Update the activity's details."
                    : "Fill in the details of the new activity."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeModal()}
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
                        {destination.name}
                        {destination.province
                          ? ` — ${destination.province}`
                          : ""}
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
                  Activity name *
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    maxLength={200}
                    placeholder="e.g. Kep Beach Relaxation"
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
                  Category
                  <input
                    name="category"
                    value={form.category}
                    onChange={updateField}
                    maxLength={100}
                    placeholder="e.g. Beach, Adventure"
                  />
                </label>

                <label>
                  Duration (hours)
                  <input
                    type="number"
                    name="duration_hours"
                    value={form.duration_hours}
                    onChange={updateField}
                    min="0.1"
                    max="99.9"
                    step="0.1"
                    placeholder="e.g. 2.5"
                    aria-invalid={Boolean(fieldErrors.duration_hours)}
                  />
                  {fieldErrors.duration_hours && (
                    <small className="hotel-field-error">
                      {fieldErrors.duration_hours}
                    </small>
                  )}
                </label>

                <label className="hotel-form-full">
                  Price per person (USD) *
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={updateField}
                    min="0"
                    step="0.01"
                    placeholder="e.g. 10.00"
                    aria-invalid={Boolean(fieldErrors.price)}
                  />
                  {fieldErrors.price && (
                    <small className="hotel-field-error">
                      {fieldErrors.price}
                    </small>
                  )}
                </label>

                <label className="hotel-form-full">
                  Image URL
                  <input
                    name="image_url"
                    value={form.image_url}
                    onChange={updateField}
                    placeholder="/images/kep-beach.jpg"
                  />
                  {form.image_url.trim() && (
                    <img
                      key={form.image_url}
                      className="hotel-image-preview"
                      src={form.image_url.trim()}
                      alt="Activity preview"
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
                  onClick={() => closeModal()}
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
                    : editingActivity
                      ? "Save changes"
                      : "Create activity"}
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
            aria-labelledby="activity-delete-title"
          >
            <h2 id="activity-delete-title">Delete “{deleteTarget.name}”?</h2>

            <p>
              This can't be undone. Activities connected to bookings or
              itineraries cannot be deleted. Set them to inactive instead.
            </p>

            <div className="hotel-modal-actions">
              <button
                type="button"
                className="hotel-cancel-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={busyId !== null}
              >
                Keep activity
              </button>

              <button
                type="button"
                className="hotel-danger-btn"
                onClick={confirmDelete}
                disabled={busyId !== null}
              >
                {busyId !== null ? "Deleting..." : "Delete activity"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
