import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminHotels.css";

const PAGE_SIZE = 8;

const emptyForm = {
  destination_id: "",
  name: "",
  description: "",
  address: "",
  image_url: "",
  price_per_night: "",
  rating: "",
  total_rooms: "",
  is_active: true,
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Highest rated" },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function getInitialForm(hotel) {
  if (!hotel) return { ...emptyForm };

  return {
    destination_id: String(hotel.destination_id ?? ""),
    name: hotel.name || "",
    description: hotel.description || "",
    address: hotel.address || "",
    image_url: hotel.image_url || "",
    price_per_night: hotel.price_per_night ?? "",
    rating: hotel.rating ?? "",
    total_rooms: hotel.total_rooms ?? "",
    is_active: hotel.is_active ?? true,
  };
}

function validate(form) {
  const errors = {};
  const price = Number(form.price_per_night);
  const rating = Number(form.rating);
  const rooms = Number(form.total_rooms);

  if (!form.destination_id) errors.destination_id = "Select a destination.";
  if (!form.name.trim()) errors.name = "Hotel name is required.";

  if (form.price_per_night === "" || !Number.isFinite(price) || price < 0) {
    errors.price_per_night = "Enter a price of 0 or more.";
  }

  if (
    form.rating !== "" &&
    (!Number.isFinite(rating) || rating < 0 || rating > 5)
  ) {
    errors.rating = "Rating must be between 0 and 5.";
  }

  if (form.total_rooms !== "" && (!Number.isInteger(rooms) || rooms < 0)) {
    errors.total_rooms = "Enter a whole number, 0 or more.";
  }

  return errors;
}

function buildPayload(form) {
  return {
    destination_id: Number(form.destination_id),
    name: form.name.trim(),
    description: String(form.description).trim() || null,
    address: String(form.address).trim() || null,
    image_url: String(form.image_url).trim() || null,
    price_per_night: Number(form.price_per_night),
    rating: form.rating === "" ? null : Number(form.rating),
    total_rooms: form.total_rooms === "" ? null : Number(form.total_rooms),
    is_active: form.is_active,
  };
}

// One place for headers, token and error handling.
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

function HotelThumb({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className="hotel-image-placeholder">⌂</div>;
  }

  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  );
}

export default function AdminHotels() {
  const [hotels, setHotels] = useState([]);
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
  const [editingHotel, setEditingHotel] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const firstFieldRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const [hotelData, destinationData] = await Promise.all([
        request(`${API_URL}/hotels/`),
        request(`${API_URL}/destinations/`),
      ]);

      setHotels(Array.isArray(hotelData) ? hotelData : []);
      setDestinations(Array.isArray(destinationData) ? destinationData : []);
    } catch (err) {
      setPageError(err.message || "Unable to load hotels.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Success messages dismiss themselves.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Escape closes dialogs, background stops scrolling, first field gets focus.
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
      total: hotels.length,
      active: hotels.filter((hotel) => hotel.is_active).length,
      inactive: hotels.filter((hotel) => !hotel.is_active).length,
    }),
    [hotels],
  );

  const filteredHotels = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = hotels.filter((hotel) => {
      const destination = destinationMap.get(hotel.destination_id);

      const matchesSearch =
        !keyword ||
        [
          hotel.name,
          hotel.address,
          hotel.description,
          destination?.name,
          destination?.province,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && hotel.is_active) ||
        (statusFilter === "inactive" && !hotel.is_active);

      const matchesDestination =
        destinationFilter === "all" ||
        String(hotel.destination_id) === destinationFilter;

      return matchesSearch && matchesStatus && matchesDestination;
    });

    const sorters = {
      newest: (a, b) => b.id - a.id,
      name: (a, b) => a.name.localeCompare(b.name),
      price_asc: (a, b) => a.price_per_night - b.price_per_night,
      price_desc: (a, b) => b.price_per_night - a.price_per_night,
      rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
    };

    return [...result].sort(sorters[sortBy]);
  }, [hotels, destinationMap, search, statusFilter, destinationFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredHotels.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleHotels = filteredHotels.slice(pageStart, pageStart + PAGE_SIZE);

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
    setEditingHotel(null);
    setForm({ ...emptyForm });
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEditModal(hotel) {
    setEditingHotel(hotel);
    setForm(getInitialForm(hotel));
    setFormError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingHotel(null);
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

    const isEditing = Boolean(editingHotel);
    setSaving(true);

    try {
      await request(
        isEditing
          ? `${API_URL}/hotels/${editingHotel.id}`
          : `${API_URL}/hotels/`,
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
      setFormError(err.message || "Unable to save hotel.");
      setSaving(false);
    }
  }

  // Switch a hotel on or off without opening the edit form.
  async function handleToggleActive(hotel) {
    setBusyId(hotel.id);
    setPageError("");

    try {
      const nextForm = getInitialForm({
        ...hotel,
        is_active: !hotel.is_active,
      });

      await request(
        `${API_URL}/hotels/${hotel.id}`,
        { method: "PUT", body: JSON.stringify(buildPayload(nextForm)) },
        { auth: true },
      );

      setHotels((current) =>
        current.map((item) =>
          item.id === hotel.id ? { ...item, is_active: !item.is_active } : item,
        ),
      );
      setNotice(
        `${hotel.name} is now ${hotel.is_active ? "inactive" : "active"}.`,
      );
    } catch (err) {
      setPageError(err.message || "Unable to update hotel status.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const hotel = deleteTarget;
    setBusyId(hotel.id);
    setPageError("");

    try {
      await request(
        `${API_URL}/hotels/${hotel.id}`,
        { method: "DELETE" },
        { auth: true },
      );

      setNotice(`${hotel.name} was deleted.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setDeleteTarget(null);
      setPageError(
        err.message ||
          "Unable to delete hotel. Hotels with bookings or itineraries can't be deleted — set it to inactive instead.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const activeDestinations = destinations.filter((item) => item.is_active);
  const formDestinationMissing =
    editingHotel &&
    form.destination_id &&
    !activeDestinations.some((item) => String(item.id) === form.destination_id);

  return (
    <section className="admin-hotels-page">
      <div className="admin-hotels-heading">
        <div>
          <h1>Hotels</h1>
          <p>Add, edit and manage the hotels travelers can book on TovNa.</p>
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
            + Add hotel
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
          { key: "all", label: "Total hotels", value: counts.total, tone: "" },
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
            <h2>All hotels</h2>
            <p>
              {filteredHotels.length === 1
                ? "1 hotel found"
                : `${filteredHotels.length} hotels found`}
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
              placeholder="Search by hotel, address or destination"
              aria-label="Search hotels"
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
              aria-label="Sort hotels"
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
        ) : filteredHotels.length === 0 ? (
          <div className="hotel-empty">
            {hotels.length === 0 ? (
              <>
                <p>No hotels yet.</p>
                <button
                  type="button"
                  className="hotel-add-btn hotel-empty-btn"
                  onClick={openCreateModal}
                >
                  + Add your first hotel
                </button>
              </>
            ) : (
              <>
                <p>No hotels match your filters.</p>
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
                    <th>Hotel</th>
                    <th>Destination</th>
                    <th>Price / night</th>
                    <th>Rating</th>
                    <th>Rooms</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleHotels.map((hotel) => (
                    <tr key={hotel.id}>
                      <td>
                        <div className="hotel-name-cell">
                          <HotelThumb src={hotel.image_url} alt={hotel.name} />

                          <div>
                            <strong>{hotel.name}</strong>
                            <span>{hotel.address || `ID: ${hotel.id}`}</span>
                          </div>
                        </div>
                      </td>

                      <td>{getDestinationName(hotel.destination_id)}</td>

                      <td>{currency.format(Number(hotel.price_per_night))}</td>

                      <td>
                        {hotel.rating != null
                          ? `★ ${Number(hotel.rating).toFixed(1)}`
                          : "—"}
                      </td>

                      <td>{hotel.total_rooms ?? "—"}</td>

                      <td>
                        <button
                          type="button"
                          className={`hotel-status ${
                            hotel.is_active ? "is-active" : "is-inactive"
                          }`}
                          onClick={() => handleToggleActive(hotel)}
                          disabled={busyId === hotel.id}
                          title={
                            hotel.is_active
                              ? "Click to set inactive"
                              : "Click to set active"
                          }
                        >
                          {hotel.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>

                      <td>
                        <div className="hotel-row-actions">
                          <button
                            type="button"
                            className="hotel-edit-btn"
                            onClick={() => openEditModal(hotel)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="hotel-delete-btn"
                            disabled={busyId === hotel.id}
                            onClick={() => setDeleteTarget(hotel)}
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
                {Math.min(pageStart + PAGE_SIZE, filteredHotels.length)} of{" "}
                {filteredHotels.length}
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
            aria-labelledby="hotel-modal-title"
          >
            <div className="hotel-modal-heading">
              <div>
                <h2 id="hotel-modal-title">
                  {editingHotel ? "Edit hotel" : "Add hotel"}
                </h2>
                <p>
                  {editingHotel
                    ? "Update the hotel's details."
                    : "Fill in the details of the new hotel."}
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
                  Hotel name *
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    maxLength={150}
                    placeholder="e.g. Kep Beach Hotel"
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
                    placeholder="What makes this hotel a good stay?"
                  />
                </label>

                <label className="hotel-form-full">
                  Address
                  <input
                    name="address"
                    value={form.address}
                    onChange={updateField}
                    placeholder="e.g. Kep Beach, Cambodia"
                  />
                </label>

                <label className="hotel-form-full">
                  Image URL
                  <input
                    name="image_url"
                    value={form.image_url}
                    onChange={updateField}
                    placeholder="/images/kep-hotel.jpg"
                  />
                  {form.image_url.trim() && (
                    <img
                      key={form.image_url}
                      className="hotel-image-preview"
                      src={form.image_url.trim()}
                      alt="Hotel preview"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </label>

                <label>
                  Price per night (USD) *
                  <input
                    type="number"
                    name="price_per_night"
                    value={form.price_per_night}
                    onChange={updateField}
                    min="0"
                    step="0.01"
                    placeholder="e.g. 35.00"
                    aria-invalid={Boolean(fieldErrors.price_per_night)}
                  />
                  {fieldErrors.price_per_night && (
                    <small className="hotel-field-error">
                      {fieldErrors.price_per_night}
                    </small>
                  )}
                </label>

                <label>
                  Rating (0–5)
                  <input
                    type="number"
                    name="rating"
                    value={form.rating}
                    onChange={updateField}
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="e.g. 4.5"
                    aria-invalid={Boolean(fieldErrors.rating)}
                  />
                  {fieldErrors.rating && (
                    <small className="hotel-field-error">
                      {fieldErrors.rating}
                    </small>
                  )}
                </label>

                <label>
                  Total rooms
                  <input
                    type="number"
                    name="total_rooms"
                    value={form.total_rooms}
                    onChange={updateField}
                    min="0"
                    step="1"
                    placeholder="e.g. 30"
                    aria-invalid={Boolean(fieldErrors.total_rooms)}
                  />
                  {fieldErrors.total_rooms && (
                    <small className="hotel-field-error">
                      {fieldErrors.total_rooms}
                    </small>
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
                    : editingHotel
                      ? "Save changes"
                      : "Create hotel"}
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
            aria-labelledby="hotel-delete-title"
          >
            <h2 id="hotel-delete-title">Delete “{deleteTarget.name}”?</h2>
            <p>
              This can't be undone. Hotels that already have bookings or
              itineraries can't be deleted — set them to inactive instead.
            </p>

            <div className="hotel-modal-actions">
              <button
                type="button"
                className="hotel-cancel-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={busyId !== null}
              >
                Keep hotel
              </button>

              <button
                type="button"
                className="hotel-danger-btn"
                onClick={confirmDelete}
                disabled={busyId !== null}
              >
                {busyId !== null ? "Deleting..." : "Delete hotel"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
