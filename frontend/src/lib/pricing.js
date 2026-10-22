export const usd = (n) => `$${Number(n || 0).toFixed(2)}`;

// Works for ratings out of 5 or out of 10, and gives a short word for the score.
export function ratingLabel(rating) {
  const outOfTen = rating > 5 ? Number(rating) : Number(rating) * 2;
  if (outOfTen >= 9) return "Great";
  if (outOfTen >= 8) return "Very good";
  if (outOfTen >= 7) return "Good";
  return "Fair";
}

// Estimated taxes and fees. Change these to your real rates.
export const TAX_RATES = { accommodation: 0.02, vat: 0.1, service: 0.1 };

const round = (n) => Math.round(n * 100) / 100;

export function priceBreakdown(pricePerNight, nights = 1, rooms = 1) {
  const base = round(Number(pricePerNight) * nights * rooms);
  const accommodationTax = round(base * TAX_RATES.accommodation);
  const vat = round(base * TAX_RATES.vat);
  const service = round(base * TAX_RATES.service);
  const taxes = round(accommodationTax + vat + service);
  return {
    base,
    accommodationTax,
    vat,
    service,
    taxes,
    total: round(base + taxes),
  };
}
