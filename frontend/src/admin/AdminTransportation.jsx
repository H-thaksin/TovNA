import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminTransportation.css";

const PAGE_SIZE = 8;

const emptyForm = {
  from_destination_id: "",
  to_destination_id: "",
  type: "Bus",
  provider: "",
  duration_minutes: "",
  price: "",
  description: "",
  is_active: true,
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "type", label: "Transport type A–Z" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "duration", label: "Shortest duration" },
];

const TYPE_OPTIONS = [
  "Bus",
  "Van",
  "Taxi",
  "Private Car",
  "Ferry",
  "Train",
  "Other",
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

async function request(url, options = {}, { auth = false } = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

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

function getInitialForm(transportation) {
  if (!transportation) return { ...emptyForm };

  return {
    from_destination_id: String(transportation.from_destination_id ?? ""),
    to_destination_id: String(transportation.to_destination_id ?? ""),
    type: transportation.type || "Bus",
    provider: transportation.provider || "",
    duration_minutes:
      transportation.duration_minutes == null
        ? ""
        : String(transportation.duration_minutes),
    price: String(transportation.price ?? ""),
    description: transportation.description || "",
    is_active: transportation.is_active ?? true,
  };
}

function validate(form) {
  const errors = {};
  const duration =
    form.duration_minutes === "" ? null : Number(form.duration_minutes);
  const price = Number(form.price);

  if (!form.from_destination_id) {
    errors.from_destination_id = "Select a starting destination.";
  }

  if (!form.to_destination_id) {
    errors.to_destination_id = "Select an ending destination.";
  }

  if (
    form.from_destination_id &&
    form.to_destination_id &&
    form.from_destination_id === form.to_destination_id
  ) {
    errors.to_destination_id =
      "Starting and ending destinations must be different.";
  }

  if (!form.type.trim()) {
    errors.type = "Transportation type is required.";
  } else if (form.type.trim().length > 50) {
    errors.type = "Transportation type must be 50 characters or fewer.";
  }

  if (form.provider.trim().length > 150) {
    errors.provider = "Provider must be 150 characters or fewer.";
  }

  if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
    errors.duration_minutes = "Duration must be a positive whole number.";
  }

  if (form.price === "" || !Number.isFinite(price) || price < 0) {
    errors.price = "Enter a price of 0 or more.";
  }

  return errors;
}

function buildPayload(form) {
  return {
    from_destination_id: Number(form.from_destination_id),
    to_destination_id: Number(form.to_destination_id),
    type: form.type.trim(),
    provider: form.provider.trim() || null,
    duration_minutes:
      form.duration_minutes === "" ? null : Number(form.duration_minutes),
    price: Number(form.price),
    description: form.description.trim() || null,
    is_active: form.is_active,
  };
}

function formatDuration(minutes) {
  if (minutes == null || minutes === "") return "—";

  const value = Number(minutes);
  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;

  return `${hours} hr ${remainingMinutes} min`;
}

export default function AdminTransportation() {
  const [transportations, setTransportations] = useState([]);
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransportation, setEditingTransportation] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const firstFieldRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const [transportationData, destinationData] = await Promise.all([
        request(`${API_URL}/transportations/admin/all`, {}, { auth: true }),
        request(`${API_URL}/destinations/`),
      ]);

      setTransportations(
        Array.isArray(transportationData) ? transportationData : [],
      );
      setDestinations(Array.isArray(destinationData) ? destinationData : []);
    } catch (err) {
      setPageError(err.message || "Unable to load transportation services.");
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
      total: transportations.length,
      active: transportations.filter((item) => item.is_active).length,
      inactive: transportations.filter((item) => !item.is_active).length,
    }),
    [transportations],
  );

  const filteredTransportations = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = transportations.filter((item) => {
      const from = destinationMap.get(item.from_destination_id);
      const to = destinationMap.get(item.to_destination_id);

      const matchesSearch =
        !keyword ||
        [
          item.type,
          item.provider,
          item.description,
          from?.name,
          from?.province,
          to?.name,
          to?.province,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active) ||
        (statusFilter === "inactive" && !item.is_active);

      const matchesType =
        typeFilter === "all" ||
        item.type.toLowerCase() === typeFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesType;
    });

    const sorters = {
      newest: (a, b) => b.id - a.id,
      type: (a, b) => a.type.localeCompare(b.type),
      price_asc: (a, b) => Number(a.price) - Number(b.price),
      price_desc: (a, b) => Number(b.price) - Number(a.price),
      duration: (a, b) =>
        (a.duration_minutes ?? Infinity) - (b.duration_minutes ?? Infinity),
    };

    return [...result].sort(sorters[sortBy]);
  }, [
    transportations,
    destinationMap,
    search,
    statusFilter,
    typeFilter,
    sortBy,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransportations.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleTransportations = filteredTransportations.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "all" || typeFilter !== "all";

  const activeDestinations = destinations.filter((item) => item.is_active);

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setPage(1);
  }

  function getDestinationName(destinationId) {
    const destination = destinationMap.get(destinationId);

    return destination
      ? `${destination.name}, ${destination.province || "Cambodia"}`
      : `Destination #${destinationId}`;
  }

  function openCreateModal() {
    setEditingTransportation(null);
    setForm({ ...emptyForm });
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEditModal(transportation) {
    setEditingTransportation(transportation);
    setForm(getInitialForm(transportation));
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal(force = false) {
    if (saving && !force) return;

    setModalOpen(false);
    setEditingTransportation(null);
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

    const isEditing = Boolean(editingTransportation);
    const savedType = form.type.trim();

    setSaving(true);

    try {
      await request(
        isEditing
          ? `${API_URL}/transportations/${editingTransportation.id}`
          : `${API_URL}/transportations/`,
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(buildPayload(form)),
        },
        { auth: true },
      );

      setNotice(
        isEditing
          ? `${savedType} transportation was updated.`
          : `${savedType} transportation was created.`,
      );

      closeModal(true);
      await loadData();
    } catch (err) {
      setFormError(err.message || "Unable to save transportation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(transportation) {
    setBusyId(transportation.id);
    setPageError("");

    try {
      const nextForm = getInitialForm({
        ...transportation,
        is_active: !transportation.is_active,
      });

      await request(
        `${API_URL}/transportations/${transportation.id}`,
        {
          method: "PUT",
          body: JSON.stringify(buildPayload(nextForm)),
        },
        { auth: true },
      );

      setTransportations((current) =>
        current.map((item) =>
          item.id === transportation.id
            ? { ...item, is_active: !item.is_active }
            : item,
        ),
      );

      setNotice(
        `${transportation.type} is now ${
          transportation.is_active ? "inactive" : "active"
        }.`,
      );
    } catch (err) {
      setPageError(err.message || "Unable to update transportation status.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const transportation = deleteTarget;
    setBusyId(transportation.id);
    setPageError("");

    try {
      await request(
        `${API_URL}/transportations/${transportation.id}`,
        { method: "DELETE" },
        { auth: true },
      );

      setNotice(`${transportation.type} transportation was deleted.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setDeleteTarget(null);
      setPageError(
        err.message ||
          "Unable to delete this service. Services connected to bookings cannot be deleted. Set them to inactive instead.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const formFromMissing =
    editingTransportation &&
    form.from_destination_id &&
    !activeDestinations.some(
      (item) => String(item.id) === form.from_destination_id,
    );

  const formToMissing =
    editingTransportation &&
    form.to_destination_id &&
    !activeDestinations.some(
      (item) => String(item.id) === form.to_destination_id,
    );

  return (
    <section className="admin-hotels-page admin-transportation-page">
      <div className="admin-hotels-heading">
        <div>
          <h1>Transportation</h1>
          <p>
            Add, edit and manage the transportation services travelers can book
            on TovNa.
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
            + Add transportation
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
          {
            key: "all",
            label: "Total services",
            value: counts.total,
            tone: "",
          },
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
            <h2>All transportation services</h2>
            <p>
              {filteredTransportations.length === 1
                ? "1 service found"
                : `${filteredTransportations.length} services found`}
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
              placeholder="Search route, type or provider"
              aria-label="Search transportation"
            />

            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by transportation type"
            >
              <option value="all">All types</option>
              {[...new Set(transportations.map((item) => item.type))]
                .filter(Boolean)
                .sort()
                .map((type) => (
                  <option key={type} value={type}>
                    {type}
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
              aria-label="Sort transportation"
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
        ) : filteredTransportations.length === 0 ? (
          <div className="hotel-empty">
            {transportations.length === 0 ? (
              <>
                <p>No transportation services yet.</p>
                <button
                  type="button"
                  className="hotel-add-btn hotel-empty-btn"
                  onClick={openCreateModal}
                >
                  + Add your first service
                </button>
              </>
            ) : (
              <>
                <p>No services match your filters.</p>
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
                    <th>Route</th>
                    <th>Type / Provider</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleTransportations.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="transportation-route-cell">
                          <strong>
                            {destinationMap.get(item.from_destination_id)
                              ?.name || `#${item.from_destination_id}`}
                          </strong>
                          <span className="transportation-route-arrow">→</span>
                          <strong>
                            {destinationMap.get(item.to_destination_id)?.name ||
                              `#${item.to_destination_id}`}
                          </strong>
                          <small>ID: {item.id}</small>
                        </div>
                      </td>

                      <td>
                        <div className="transportation-provider-cell">
                          <strong>{item.type}</strong>
                          <span>
                            {item.provider || "No provider specified"}
                          </span>
                        </div>
                      </td>

                      <td>{formatDuration(item.duration_minutes)}</td>
                      <td>{currency.format(Number(item.price))}</td>

                      <td>
                        <button
                          type="button"
                          className={`hotel-status ${
                            item.is_active ? "is-active" : "is-inactive"
                          }`}
                          onClick={() => handleToggleActive(item)}
                          disabled={busyId === item.id}
                          title={
                            item.is_active
                              ? "Click to set inactive"
                              : "Click to set active"
                          }
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>

                      <td>
                        <div className="hotel-row-actions">
                          <button
                            type="button"
                            className="hotel-edit-btn"
                            onClick={() => openEditModal(item)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="hotel-delete-btn"
                            disabled={busyId === item.id}
                            onClick={() => setDeleteTarget(item)}
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
                {Math.min(
                  pageStart + PAGE_SIZE,
                  filteredTransportations.length,
                )}{" "}
                of {filteredTransportations.length}
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
            aria-labelledby="transportation-modal-title"
          >
            <div className="hotel-modal-heading">
              <div>
                <h2 id="transportation-modal-title">
                  {editingTransportation
                    ? "Edit transportation"
                    : "Add transportation"}
                </h2>
                <p>
                  {editingTransportation
                    ? "Update this transportation service's details."
                    : "Fill in the details of the new transportation service."}
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
                  Starting destination *
                  <select
                    ref={firstFieldRef}
                    name="from_destination_id"
                    value={form.from_destination_id}
                    onChange={updateField}
                    aria-invalid={Boolean(fieldErrors.from_destination_id)}
                  >
                    <option value="">Select starting destination</option>
                    {activeDestinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.name} — {destination.province}
                      </option>
                    ))}
                    {formFromMissing && (
                      <option value={form.from_destination_id}>
                        {getDestinationName(Number(form.from_destination_id))}{" "}
                        (inactive)
                      </option>
                    )}
                  </select>
                  {fieldErrors.from_destination_id && (
                    <small className="hotel-field-error">
                      {fieldErrors.from_destination_id}
                    </small>
                  )}
                </label>

                <label>
                  Ending destination *
                  <select
                    name="to_destination_id"
                    value={form.to_destination_id}
                    onChange={updateField}
                    aria-invalid={Boolean(fieldErrors.to_destination_id)}
                  >
                    <option value="">Select ending destination</option>
                    {activeDestinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.name} — {destination.province}
                      </option>
                    ))}
                    {formToMissing && (
                      <option value={form.to_destination_id}>
                        {getDestinationName(Number(form.to_destination_id))}{" "}
                        (inactive)
                      </option>
                    )}
                  </select>
                  {fieldErrors.to_destination_id && (
                    <small className="hotel-field-error">
                      {fieldErrors.to_destination_id}
                    </small>
                  )}
                </label>

                <label>
                  Transportation type *
                  <input
                    name="type"
                    list="transportation-type-options"
                    value={form.type}
                    onChange={updateField}
                    maxLength={50}
                    placeholder="e.g. Bus, Van, Taxi"
                    aria-invalid={Boolean(fieldErrors.type)}
                  />
                  <datalist id="transportation-type-options">
                    {TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type} />
                    ))}
                  </datalist>
                  {fieldErrors.type && (
                    <small className="hotel-field-error">
                      {fieldErrors.type}
                    </small>
                  )}
                </label>

                <label>
                  Provider
                  <input
                    name="provider"
                    value={form.provider}
                    onChange={updateField}
                    maxLength={150}
                    placeholder="e.g. Vireak Buntham"
                    aria-invalid={Boolean(fieldErrors.provider)}
                  />
                  {fieldErrors.provider && (
                    <small className="hotel-field-error">
                      {fieldErrors.provider}
                    </small>
                  )}
                </label>

                <label>
                  Duration (minutes)
                  <input
                    type="number"
                    name="duration_minutes"
                    value={form.duration_minutes}
                    onChange={updateField}
                    min="1"
                    step="1"
                    placeholder="e.g. 180"
                    aria-invalid={Boolean(fieldErrors.duration_minutes)}
                  />
                  {fieldErrors.duration_minutes && (
                    <small className="hotel-field-error">
                      {fieldErrors.duration_minutes}
                    </small>
                  )}
                </label>

                <label>
                  Price (USD) *
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={updateField}
                    min="0"
                    step="0.01"
                    placeholder="e.g. 12.00"
                    aria-invalid={Boolean(fieldErrors.price)}
                  />
                  {fieldErrors.price && (
                    <small className="hotel-field-error">
                      {fieldErrors.price}
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
                    placeholder="Describe this transportation service..."
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
                    : editingTransportation
                      ? "Save changes"
                      : "Create transportation"}
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
            aria-labelledby="transportation-delete-title"
          >
            <h2 id="transportation-delete-title">
              Delete this transportation service?
            </h2>

            <p>
              This will delete the {deleteTarget.type} service from{" "}
              {getDestinationName(deleteTarget.from_destination_id)} to{" "}
              {getDestinationName(deleteTarget.to_destination_id)}. Services
              connected to bookings cannot be deleted. Set them to inactive
              instead.
            </p>

            <div className="hotel-modal-actions">
              <button
                type="button"
                className="hotel-cancel-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={busyId !== null}
              >
                Keep service
              </button>

              <button
                type="button"
                className="hotel-danger-btn"
                onClick={confirmDelete}
                disabled={busyId !== null}
              >
                {busyId !== null ? "Deleting..." : "Delete service"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
