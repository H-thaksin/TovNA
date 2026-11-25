// Helpers shared by My Bookings and Booking Details (same logic as the website).
import { colors } from "./theme";

// The backend saves some details in `notes`, like "Check-in: 2026-10-20; Nights: 2; Base: 180.00".
export function getNoteValue(notes, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = (notes || "").match(
    new RegExp(`(?:^|;)\\s*${escaped}:\\s*([^;]+)`, "i"),
  );
  return match ? match[1].trim() : "";
}

export function getPriceValue(notes, label) {
  const value = getNoteValue(notes, label);
  const amount = Number(value);
  return value && Number.isFinite(amount) ? amount : null;
}

// "2026-10-20" is read as a local date; null means "not a date"
export function parseDate(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const formatDate = (date, fallback) =>
  date
    ? date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : fallback || "—";

export function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return value || "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const titleCase = (text) =>
  String(text || "Unknown").replace(/^\w/, (c) => c.toUpperCase());

export const usd = (amount) =>
  `$${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const INACTIVE_STATUSES = ["cancelled", "canceled", "rejected"];

export const STATUS_TEXT = {
  pending: "Your booking has been received and is waiting for confirmation.",
  confirmed: "Your reservation is confirmed. We look forward to welcoming you.",
  rejected: "This booking could not be confirmed.",
  completed: "This booking is complete. Thank you for travelling with TovNa.",
  cancelled: "This booking was cancelled.",
};

export const STATUS_TONE = {
  pending: { bg: "#fff3d6", fg: "#92580a" },
  confirmed: { bg: "#e8f7ee", fg: "#146c43" },
  paid: { bg: "#e8f7ee", fg: "#146c43" },
  completed: { bg: colors.primarySoft, fg: colors.primaryDark },
  rejected: { bg: "#fff0f0", fg: colors.danger },
  cancelled: { bg: "#fff0f0", fg: colors.danger },
  canceled: { bg: "#fff0f0", fg: colors.danger },
  failed: { bg: "#fff0f0", fg: colors.danger },
  refunded: { bg: "#eef2f1", fg: "#5b6573" },
};

export const TYPE_LABELS = {
  hotel: "Hotels",
  transportation: "Transport",
  tour: "Tours",
  activity: "Activities",
};
export const TYPE_EMOJI = {
  hotel: "🏨",
  transportation: "🚌",
  tour: "🧭",
  activity: "🎟️",
};

const TRANSPORT_EMOJI = {
  bus: "🚌",
  van: "🚐",
  minivan: "🚐",
  boat: "⛴️",
  ferry: "⛴️",
  taxi: "🚕",
  train: "🚆",
  flight: "✈️",
};
export const transportEmoji = (kind) => TRANSPORT_EMOJI[kind] ?? "🚌";

export function paymentStatusLabel(status) {
  const labels = {
    pending: "Payment pending",
    paid: "Paid",
    failed: "Payment failed",
    refunded: "Refunded",
  };
  return labels[status] || titleCase(status);
}

export function getBookingType(b) {
  if (b.transportation_id != null) return "transportation";
  if (b.tour_id != null) return "tour";
  if (b.activity_id != null) return "activity";
  return "hotel";
}

const PRICE_ITEMS = [
  ["Base price", "Base"],
  ["Accommodation tax", "Accommodation tax"],
  ["VAT", "VAT"],
  ["Service charge", "Service charge"],
];

// Prepare one booking for display
export function normalize(booking) {
  const notes = booking.notes || "";
  const bookingType = getBookingType(booking);
  const isTransportation = bookingType === "transportation";
  const isExperience = bookingType === "tour" || bookingType === "activity";
  const item = booking.items?.[0] || {};

  const serviceDateRaw = item.service_date || "";
  const checkInRaw =
    booking.check_in ||
    getNoteValue(notes, "Check-in") ||
    (bookingType === "hotel" ? serviceDateRaw : "");
  const checkOutRaw = booking.check_out || getNoteValue(notes, "Check-out");
  const travelDateRaw = getNoteValue(notes, "Travel date");

  const startRaw = isTransportation
    ? travelDateRaw
    : isExperience
      ? serviceDateRaw
      : checkInRaw;
  const start = parseDate(startRaw);

  const passengers = Number(getNoteValue(notes, "Passengers")) || 0;
  const participants = Number(booking.participants) || 0;
  const unit = Number(
    isTransportation ? booking.transport_unit_price : item.unit_price,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const titles = {
    transportation: `${booking.from_destination || "Departure"} → ${booking.to_destination || "Destination"}`,
    tour: booking.tour_name || "Tour booking",
    activity: booking.activity_name || "Activity booking",
    hotel: booking.hotel_name || "Hotel booking",
  };

  const targets = {
    hotel:
      booking.hotel_id != null
        ? { type: "hotels", id: booking.hotel_id }
        : null,
    tour:
      booking.tour_id != null ? { type: "tours", id: booking.tour_id } : null,
    activity:
      booking.activity_id != null
        ? { type: "activities", id: booking.activity_id }
        : null,
    transportation: null,
  };

  return {
    ...booking,
    notes,
    bookingType,
    isTransportation,
    isExperience,
    serviceDateRaw,
    checkInRaw,
    checkOutRaw,
    travelDateRaw,
    start,
    end: parseDate(checkOutRaw),
    passengers,
    participants,
    quantity: isTransportation ? passengers : participants,
    unitPrice: Number.isFinite(unit) ? unit : null,
    nights: Number(booking.nights ?? getNoteValue(notes, "Nights")) || 0,
    rooms: booking.rooms || getNoteValue(notes, "Rooms") || "1",
    statusKey: String(booking.status || "unknown").toLowerCase(),
    title: titles[bookingType],
    image: booking.hotel_image || booking.tour_image || booking.activity_image,
    transportKind: String(booking.transport_type || "").toLowerCase(),
    target: targets[bookingType],
    daysToGo: start ? Math.round((start - today) / 86400000) : null,
    prices: PRICE_ITEMS.map(([label, noteLabel]) => [
      label,
      getPriceValue(notes, noteLabel),
    ]),
  };
}

export function isUpcoming(b) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return (
    !INACTIVE_STATUSES.includes(b.statusKey) &&
    (b.end ?? b.start ?? startOfToday) >= startOfToday
  );
}
