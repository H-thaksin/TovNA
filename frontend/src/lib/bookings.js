// Helpers shared by the My Bookings list and the booking details page.

// The backend saves some details in `notes`, like "Check-in: 2026-10-20; Nights: 2; Base: 180.00".
export function getNoteValue(notes, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = (notes || "").match(
    new RegExp(`(?:^|;\\s*)${escaped}:\\s*([^;]+)`, "i"),
  );
  return match ? match[1].trim() : "";
}

// "2026-10-20" is read as a local date. Anything else is left to the browser; null means "not a date".
export function parseDate(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const formatDate = (date, fallback) =>
  date
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date)
    : fallback || "—";

export const titleCase = (text) =>
  String(text || "Unknown").replace(/^\w/, (c) => c.toUpperCase());

// A plain-language line for each status, shown on the details page.
export const STATUS_TEXT = {
  pending: "Your booking has been received and is waiting for confirmation.",
  confirmed: "Your reservation is confirmed. We look forward to welcoming you.",
  completed: "This stay is complete. Thank you for travelling with TovNa.",
  cancelled: "This booking was cancelled.",
};

const noteAmount = (notes, label) => {
  const value = parseFloat(getNoteValue(notes, label));
  return Number.isFinite(value) ? value : null;
};

// Prepare one booking for display: real dates, nights, rooms, price lines and a status key.
export function normalize(booking) {
  const checkInRaw =
    booking.check_in || getNoteValue(booking.notes, "Check-in");
  const checkOutRaw =
    booking.check_out || getNoteValue(booking.notes, "Check-out");

  return {
    ...booking,
    checkInRaw,
    checkOutRaw,
    start: parseDate(checkInRaw),
    end: parseDate(checkOutRaw),
    nights:
      Number(booking.nights ?? getNoteValue(booking.notes, "Nights")) || 0,
    rooms: Number(getNoteValue(booking.notes, "Rooms")) || 1,
    statusKey: String(booking.status || "unknown").toLowerCase(),
    breakdown: {
      base: noteAmount(booking.notes, "Base"),
      accommodationTax: noteAmount(booking.notes, "Accommodation tax"),
      vat: noteAmount(booking.notes, "VAT"),
      service: noteAmount(booking.notes, "Service charge"),
    },
  };
}
