import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminDestinations.css";

const PAGE_SIZE = 8;

const emptyForm = {
  name: "",
  province: "",
  description: "",
  image_url: "",
  latitude: "",
  longitude: "",
  best_time: "",
  is_active: true,
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
  { value: "province", label: "Province A–Z" },
];

function getInitialForm(destination) {
  if (!destination) return { ...emptyForm };

  return {
    name: destination.name || "",
    province: destination.province || "",
    description: destination.description || "",
    image_url: destination.image_url || "",
    latitude: destination.latitude == null ? "" : String(destination.latitude),
    longitude:
      destination.longitude == null ? "" : String(destination.longitude),
    best_time: destination.best_time || "",
    is_active: destination.is_active ?? true,
  };
}

function validate(form) {
  const errors = {};
  const lat = Number(form.latitude);
  const lng = Number(form.longitude);

  if (!form.name.trim()) errors.name = "Destination name is required.";
  if (!form.province.trim()) errors.province = "Province is required.";

  if (
    form.latitude !== "" &&
    (!Number.isFinite(lat) || lat < -90 || lat > 90)
  ) {
    errors.latitude = "Latitude must be between -90 and 90.";
  }

  if (
    form.longitude !== "" &&
    (!Number.isFinite(lng) || lng < -180 || lng > 180)
  ) {
    errors.longitude = "Longitude must be between -180 and 180.";
  }

  // A pin needs both numbers.
  if (form.latitude !== "" && form.longitude === "" && !errors.longitude) {
    errors.longitude = "Enter the longitude too, or clear the latitude.";
  }

  if (form.longitude !== "" && form.latitude === "" && !errors.latitude) {
    errors.latitude = "Enter the latitude too, or clear the longitude.";
  }

  return errors;
}

function buildPayload(form) {
  return {
    name: form.name.trim(),
    province: form.province.trim(),
    description: String(form.description).trim() || null,
    image_url: String(form.image_url).trim() || null,
    latitude: form.latitude === "" ? null : Number(form.latitude),
    longitude: form.longitude === "" ? null : Number(form.longitude),
    best_time: String(form.best_time).trim() || null,
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

  if (!response.ok) throw new Error(readError(data));

  return data;
}

function DestinationThumb({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className="hotel-image-placeholder">⌖</div>;
  }

  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  );
}

export default function AdminDestinations() {
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
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const firstFieldRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const data = await request(`${API_URL}/destinations/`);
      setDestinations(Array.isArray(data) ? data : []);
    } catch (err) {
      setPageError(err.message || "Unable to load destinations.");
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

  const counts = useMemo(
    () => ({
      total: destinations.length,
      active: destinations.filter((item) => item.is_active).length,
      inactive: destinations.filter((item) => !item.is_active).length,
    }),
    [destinations],
  );

  const provinces = useMemo(
    () =>
      [
        ...new Set(
          destinations.map((item) => item.province?.trim()).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [destinations],
  );

  const filteredDestinations = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = destinations.filter((destination) => {
      const matchesSearch =
        !keyword ||
        [destination.name, destination.province, destination.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && destination.is_active) ||
        (statusFilter === "inactive" && !destination.is_active);

      const matchesProvince =
        provinceFilter === "all" || destination.province === provinceFilter;

      return matchesSearch && matchesStatus && matchesProvince;
    });

    const sorters = {
      newest: (a, b) => b.id - a.id,
      name: (a, b) => a.name.localeCompare(b.name),
      province: (a, b) =>
        (a.province || "").localeCompare(b.province || "") ||
        a.name.localeCompare(b.name),
    };

    return [...result].sort(sorters[sortBy]);
  }, [destinations, search, statusFilter, provinceFilter, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDestinations.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleDestinations = filteredDestinations.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "all" || provinceFilter !== "all";

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setProvinceFilter("all");
    setPage(1);
  }

  function openCreateModal() {
    setEditingDestination(null);
    setForm({ ...emptyForm });
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEditModal(destination) {
    setEditingDestination(destination);
    setForm(getInitialForm(destination));
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal(force = false) {
    if (saving && !force) return;

    setModalOpen(false);
    setEditingDestination(null);
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

    const isEditing = Boolean(editingDestination);
    const destinationName = form.name.trim();

    setSaving(true);

    try {
      await request(
        isEditing
          ? `${API_URL}/destinations/${editingDestination.id}`
          : `${API_URL}/destinations/`,
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(buildPayload(form)),
        },
        { auth: true },
      );

      setNotice(
        isEditing
          ? `${destinationName} was updated.`
          : `${destinationName} was created.`,
      );

      closeModal(true);
      setSaving(false);
      await loadData();
    } catch (err) {
      setFormError(err.message || "Unable to save destination.");
      setSaving(false);
    }
  }

  async function handleToggleActive(destination) {
    setBusyId(destination.id);
    setPageError("");

    try {
      const nextForm = getInitialForm({
        ...destination,
        is_active: !destination.is_active,
      });

      await request(
        `${API_URL}/destinations/${destination.id}`,
        { method: "PUT", body: JSON.stringify(buildPayload(nextForm)) },
        { auth: true },
      );

      setDestinations((current) =>
        current.map((item) =>
          item.id === destination.id
            ? { ...item, is_active: !item.is_active }
            : item,
        ),
      );

      setNotice(
        `${destination.name} is now ${
          destination.is_active ? "inactive" : "active"
        }.`,
      );
    } catch (err) {
      setPageError(err.message || "Unable to update destination status.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const destination = deleteTarget;
    setBusyId(destination.id);
    setPageError("");

    try {
      await request(
        `${API_URL}/destinations/${destination.id}`,
        { method: "DELETE" },
        { auth: true },
      );

      setNotice(`${destination.name} was deleted.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setDeleteTarget(null);
      setPageError(
        err.message ||
          "Unable to delete destination. Destinations used by hotels, tours, activities or transportation cannot be deleted. Set them to inactive instead.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-hotels-page admin-destinations-page">
      <div className="admin-hotels-heading">
        <div>
          <h1>Destinations</h1>
          <p>Add, edit and manage the places travelers can explore on TovNa.</p>
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
            + Add destination
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
          { key: "all", label: "Total destinations", value: counts.total },
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
            <h2>All destinations</h2>
            <p>
              {filteredDestinations.length === 1
                ? "1 destination found"
                : `${filteredDestinations.length} destinations found`}
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
              placeholder="Search by name or province"
              aria-label="Search destinations"
            />

            <select
              value={provinceFilter}
              onChange={(event) => {
                setProvinceFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by province"
            >
              <option value="all">All provinces</option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
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
              aria-label="Sort destinations"
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
        ) : filteredDestinations.length === 0 ? (
          <div className="hotel-empty">
            {destinations.length === 0 ? (
              <>
                <p>No destinations yet.</p>
                <button
                  type="button"
                  className="hotel-add-btn hotel-empty-btn"
                  onClick={openCreateModal}
                >
                  + Add your first destination
                </button>
              </>
            ) : (
              <>
                <p>No destinations match your filters.</p>
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
                    <th>Destination</th>
                    <th>Province</th>
                    <th>Best time</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleDestinations.map((destination) => {
                    const hasCoordinates =
                      destination.latitude != null &&
                      destination.longitude != null;

                    return (
                      <tr key={destination.id}>
                        <td>
                          <div className="hotel-name-cell">
                            <DestinationThumb
                              src={destination.image_url}
                              alt={destination.name}
                            />
                            <div>
                              <strong>{destination.name}</strong>
                              <span>ID: {destination.id}</span>
                            </div>
                          </div>
                        </td>

                        <td>{destination.province}</td>
                        <td>{destination.best_time || "—"}</td>

                        <td>
                          {hasCoordinates ? (
                            <a
                              className="hotel-link-btn"
                              href={`https://www.google.com/maps?q=${destination.latitude},${destination.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Open in Google Maps"
                            >
                              {Number(destination.latitude).toFixed(4)},{" "}
                              {Number(destination.longitude).toFixed(4)}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className={`hotel-status ${
                              destination.is_active
                                ? "is-active"
                                : "is-inactive"
                            }`}
                            onClick={() => handleToggleActive(destination)}
                            disabled={busyId === destination.id}
                            title={
                              destination.is_active
                                ? "Click to set inactive"
                                : "Click to set active"
                            }
                          >
                            {destination.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>

                        <td>
                          <div className="hotel-row-actions">
                            <button
                              type="button"
                              className="hotel-edit-btn"
                              onClick={() => openEditModal(destination)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="hotel-delete-btn"
                              disabled={busyId === destination.id}
                              onClick={() => setDeleteTarget(destination)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="hotel-pagination">
              <span>
                Showing {pageStart + 1}–
                {Math.min(pageStart + PAGE_SIZE, filteredDestinations.length)}{" "}
                of {filteredDestinations.length}
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
            aria-labelledby="destination-modal-title"
          >
            <div className="hotel-modal-heading">
              <div>
                <h2 id="destination-modal-title">
                  {editingDestination ? "Edit destination" : "Add destination"}
                </h2>
                <p>
                  {editingDestination
                    ? "Update the destination's details."
                    : "Fill in the details of the new destination."}
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
                <label>
                  Destination name *
                  <input
                    ref={firstFieldRef}
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    maxLength={150}
                    placeholder="e.g. Kampot"
                    aria-invalid={Boolean(fieldErrors.name)}
                  />
                  {fieldErrors.name && (
                    <small className="hotel-field-error">
                      {fieldErrors.name}
                    </small>
                  )}
                </label>

                <label>
                  Province *
                  <input
                    name="province"
                    value={form.province}
                    onChange={updateField}
                    maxLength={100}
                    list="province-options"
                    placeholder="e.g. Kampot"
                    aria-invalid={Boolean(fieldErrors.province)}
                  />
                  <datalist id="province-options">
                    {provinces.map((province) => (
                      <option key={province} value={province} />
                    ))}
                  </datalist>
                  {fieldErrors.province && (
                    <small className="hotel-field-error">
                      {fieldErrors.province}
                    </small>
                  )}
                </label>

                <label className="hotel-form-full">
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    rows={4}
                    placeholder="What makes this destination worth visiting?"
                  />
                </label>

                <label className="hotel-form-full">
                  Image URL
                  <input
                    name="image_url"
                    value={form.image_url}
                    onChange={updateField}
                    placeholder="/images/kampot.jpg"
                  />
                  {form.image_url.trim() && (
                    <img
                      key={form.image_url}
                      className="hotel-image-preview"
                      src={form.image_url.trim()}
                      alt="Destination preview"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </label>

                <label>
                  Latitude
                  <input
                    type="number"
                    name="latitude"
                    value={form.latitude}
                    onChange={updateField}
                    min="-90"
                    max="90"
                    step="any"
                    placeholder="e.g. 10.5942"
                    aria-invalid={Boolean(fieldErrors.latitude)}
                  />
                  {fieldErrors.latitude && (
                    <small className="hotel-field-error">
                      {fieldErrors.latitude}
                    </small>
                  )}
                </label>

                <label>
                  Longitude
                  <input
                    type="number"
                    name="longitude"
                    value={form.longitude}
                    onChange={updateField}
                    min="-180"
                    max="180"
                    step="any"
                    placeholder="e.g. 104.1640"
                    aria-invalid={Boolean(fieldErrors.longitude)}
                  />
                  {fieldErrors.longitude && (
                    <small className="hotel-field-error">
                      {fieldErrors.longitude}
                    </small>
                  )}
                </label>

                <label className="hotel-form-full">
                  Best time to visit
                  <input
                    name="best_time"
                    value={form.best_time}
                    onChange={updateField}
                    maxLength={100}
                    placeholder="e.g. November to April"
                  />
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
                    : editingDestination
                      ? "Save changes"
                      : "Create destination"}
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
            aria-labelledby="destination-delete-title"
          >
            <h2 id="destination-delete-title">Delete “{deleteTarget.name}”?</h2>

            <p>
              This can't be undone. Destinations used by hotels, tours,
              activities or transportation can't be deleted. Set them to
              inactive instead.
            </p>

            <div className="hotel-modal-actions">
              <button
                type="button"
                className="hotel-cancel-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={busyId !== null}
              >
                Keep destination
              </button>

              <button
                type="button"
                className="hotel-danger-btn"
                onClick={confirmDelete}
                disabled={busyId !== null}
              >
                {busyId !== null ? "Deleting..." : "Delete destination"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
