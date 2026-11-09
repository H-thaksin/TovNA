import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, TOKEN_KEY, readError } from "../lib/api";
import "./AdminPayments.css";

const PAGE_SIZE = 8;

const STATUS_OPTIONS = ["pending", "paid", "failed", "refunded"];

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

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusClass(status) {
  return `payment-status payment-status-${String(status || "unknown").toLowerCase()}`;
}

function getInitialStats() {
  return {
    total_payments: 0,
    paid_count: 0,
    pending_count: 0,
    failed_count: 0,
    refunded_count: 0,
    total_revenue: 0,
    total_payment_amount: 0,
  };
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(getInitialStats);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [statusDraft, setStatusDraft] = useState("pending");
  const [updateError, setUpdateError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const [paymentData, statsData] = await Promise.all([
        request(`${API_URL}/payments/`, {}, { auth: true }),
        request(`${API_URL}/payments/admin/stats`, {}, { auth: true }),
      ]);

      setPayments(Array.isArray(paymentData) ? paymentData : []);
      setStats({ ...getInitialStats(), ...(statsData || {}) });
    } catch (err) {
      setPageError(err.message || "Unable to load payment information.");
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

  const counts = useMemo(
    () => [
      {
        key: "all",
        label: "Total payments",
        value: stats.total_payments,
        tone: "",
      },
      {
        key: "paid",
        label: "Paid",
        value: stats.paid_count,
        tone: "paid",
      },
      {
        key: "pending",
        label: "Pending",
        value: stats.pending_count,
        tone: "pending",
      },
      {
        key: "failed",
        label: "Failed",
        value: stats.failed_count,
        tone: "failed",
      },
      {
        key: "refunded",
        label: "Refunded",
        value: stats.refunded_count,
        tone: "refunded",
      },
    ],
    [stats],
  );

  const filteredPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = payments.filter((payment) => {
      const matchesSearch =
        !keyword ||
        [
          payment.id,
          payment.booking_id,
          payment.booking_reference,
          payment.customer_name,
          payment.customer_email,
          payment.method,
          payment.transaction_reference,
        ]
          .filter((value) => value !== null && value !== undefined)
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "all" || payment.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    const sorters = {
      newest: (a, b) => b.id - a.id,
      oldest: (a, b) => a.id - b.id,
      amount_high: (a, b) => Number(b.amount) - Number(a.amount),
      amount_low: (a, b) => Number(a.amount) - Number(b.amount),
    };

    return [...result].sort(sorters[sortBy] || sorters.newest);
  }, [payments, search, statusFilter, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / PAGE_SIZE),
  );

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;

  const visiblePayments = filteredPayments.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setSortBy("newest");
    setPage(1);
  }

  function openPaymentDetails(payment) {
    setSelectedPayment(payment);
    setStatusDraft(payment.status || "pending");
    setUpdateError("");
  }

  function closePaymentDetails() {
    if (updating) return;

    setSelectedPayment(null);
    setUpdateError("");
  }

  async function handleStatusUpdate(event) {
    event.preventDefault();

    if (!selectedPayment) return;

    if (!STATUS_OPTIONS.includes(statusDraft)) {
      setUpdateError("Please select a valid payment status.");
      return;
    }

    if (statusDraft === selectedPayment.status) {
      setUpdateError("Choose a different status before saving.");
      return;
    }

    setUpdating(true);
    setUpdateError("");
    setBusyId(selectedPayment.id);

    try {
      const result = await request(
        `${API_URL}/payments/${selectedPayment.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: statusDraft }),
        },
        { auth: true },
      );

      const updatedPayment = result?.payment;

      if (!updatedPayment) {
        throw new Error("The server did not return the updated payment.");
      }

      setPayments((current) =>
        current.map((payment) =>
          payment.id === updatedPayment.id ? updatedPayment : payment,
        ),
      );

      setSelectedPayment(updatedPayment);
      setStatusDraft(updatedPayment.status);

      const refreshedStats = await request(
        `${API_URL}/payments/admin/stats`,
        {},
        { auth: true },
      );

      setStats({ ...getInitialStats(), ...(refreshedStats || {}) });

      setNotice(
        `Payment #${updatedPayment.id} status changed to ${formatStatus(
          updatedPayment.status,
        )}.`,
      );
    } catch (err) {
      setUpdateError(err.message || "Unable to update payment status.");
    } finally {
      setUpdating(false);
      setBusyId(null);
    }
  }

  return (
    <section className="admin-hotels-page admin-payments-page">
      <div className="admin-hotels-heading">
        <div>
          <h1>Payment Management</h1>
          <p>
            View customer payments, monitor payment activity and update payment
            statuses on TovNa.
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

      <div className="payment-revenue-card">
        <div>
          <span>Total revenue from paid payments</span>
          <strong>{currency.format(Number(stats.total_revenue || 0))}</strong>
          <small>Based on payments currently marked as paid</small>
        </div>
        <div className="payment-revenue-icon" aria-hidden="true">
          $
        </div>
      </div>

      <div className="hotel-stats payment-stats">
        {counts.map((card) => (
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
            <strong>{Number(card.value || 0).toLocaleString("en-US")}</strong>
          </button>
        ))}
      </div>

      <div className="hotel-table-panel">
        <div className="hotel-table-heading">
          <div>
            <h2>All payments</h2>
            <p>
              {filteredPayments.length === 1
                ? "1 payment found"
                : `${filteredPayments.length} payments found`}
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

          <div className="hotel-filters payment-filters">
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search customer, booking or transaction"
              aria-label="Search payments"
            />

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter payments by status"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort payments"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount_high">Amount: high to low</option>
              <option value="amount_low">Amount: low to high</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="hotel-skeleton-list" aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="hotel-skeleton-row" />
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="hotel-empty">
            {payments.length === 0 ? (
              <p>No payment records found.</p>
            ) : (
              <>
                <p>No payments match your search or filters.</p>
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
              <table className="hotel-table payment-table">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Customer</th>
                    <th>Booking reference</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Paid at</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visiblePayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div className="payment-id-cell">
                          <strong>#{payment.id}</strong>
                          <small>Booking ID: {payment.booking_id}</small>
                        </div>
                      </td>

                      <td>
                        <div className="payment-customer-cell">
                          <strong>{payment.customer_name || "Unknown"}</strong>
                          <span>{payment.customer_email || "—"}</span>
                        </div>
                      </td>

                      <td>
                        <strong className="payment-reference">
                          {payment.booking_reference || "—"}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {currency.format(Number(payment.amount || 0))}
                        </strong>
                      </td>

                      <td>{payment.method || "—"}</td>

                      <td>
                        <span className={getStatusClass(payment.status)}>
                          {formatStatus(payment.status)}
                        </span>
                      </td>

                      <td>{formatDate(payment.paid_at)}</td>

                      <td>
                        <button
                          type="button"
                          className="hotel-edit-btn"
                          onClick={() => openPaymentDetails(payment)}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hotel-pagination">
              <span>
                Showing {pageStart + 1}–
                {Math.min(pageStart + PAGE_SIZE, filteredPayments.length)} of{" "}
                {filteredPayments.length}
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

      {selectedPayment && (
        <div
          className="hotel-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePaymentDetails();
            }
          }}
        >
          <section
            className="hotel-modal payment-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-details-title"
          >
            <div className="hotel-modal-heading">
              <div>
                <h2 id="payment-details-title">Payment details</h2>
                <p>
                  Payment #{selectedPayment.id} ·{" "}
                  {selectedPayment.booking_reference || "No booking reference"}
                </p>
              </div>

              <button
                type="button"
                onClick={closePaymentDetails}
                disabled={updating}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="payment-details-grid">
              <div>
                <span>Customer</span>
                <strong>{selectedPayment.customer_name || "Unknown"}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{selectedPayment.customer_email || "—"}</strong>
              </div>

              <div>
                <span>Payment amount</span>
                <strong>
                  {currency.format(Number(selectedPayment.amount || 0))}
                </strong>
              </div>

              <div>
                <span>Payment method</span>
                <strong>{selectedPayment.method || "—"}</strong>
              </div>

              <div>
                <span>Booking status</span>
                <strong>{formatStatus(selectedPayment.booking_status)}</strong>
              </div>

              <div>
                <span>Booking total</span>
                <strong>
                  {currency.format(Number(selectedPayment.booking_total || 0))}
                </strong>
              </div>

              <div>
                <span>Transaction reference</span>
                <strong>{selectedPayment.transaction_reference || "—"}</strong>
              </div>

              <div>
                <span>Paid at</span>
                <strong>{formatDate(selectedPayment.paid_at)}</strong>
              </div>
            </div>

            {selectedPayment.booking_status === "cancelled" && (
              <div className="payment-cancelled-warning" role="alert">
                This payment belongs to a cancelled booking. Check the
                cancellation and refund policy before changing its status.
              </div>
            )}

            <form onSubmit={handleStatusUpdate}>
              <div className="payment-status-editor">
                <label htmlFor="payment-status-select">
                  Update payment status
                </label>

                <select
                  id="payment-status-select"
                  value={statusDraft}
                  onChange={(event) => {
                    setStatusDraft(event.target.value);
                    setUpdateError("");
                  }}
                  disabled={updating}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </div>

              {updateError && (
                <div className="hotel-error hotel-form-error" role="alert">
                  {updateError}
                </div>
              )}

              <div className="hotel-modal-actions">
                <button
                  type="button"
                  className="hotel-cancel-btn"
                  onClick={closePaymentDetails}
                  disabled={updating}
                >
                  Close
                </button>

                <button
                  type="submit"
                  className="hotel-save-btn"
                  disabled={
                    updating ||
                    statusDraft === selectedPayment.status ||
                    busyId === selectedPayment.id
                  }
                >
                  {updating ? "Updating..." : "Update status"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
