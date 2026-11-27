import { API_URL } from "./api";

// Same settings as the website's lib/payment.js
export const ABA_KHQR = {
  image: "/images/aba-khqr.png", // served by the backend from frontend/public/images
  accountName: "THE EXACT NAME ABA SHOWS", // <- replace with the real merchant name
  bankName: "ABA Bank",
  currency: "USD",
};

export const abaQrUrl = () => `${API_URL}${ABA_KHQR.image}`;

// Hide the "Pay to" line until a real name is set
export const hasAccountName = () =>
  !!ABA_KHQR.accountName && !/^THE EXACT/i.test(ABA_KHQR.accountName);

// Where customers pay cash. Fill in the real details (empty lines are hidden).
export const CASH_INFO = {
  place: "",
  address: "",
  phone: "",
  hours: "",
};

// The payment process, shown to the customer before they choose a method
export const PAYMENT_FLOW = [
  {
    icon: "checkmark-circle-outline",
    title: "Booking confirmed",
    text: "The agency approves your booking.",
  },
  {
    icon: "card-outline",
    title: "You pay",
    text: "Pay with ABA KHQR or in cash.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "We verify",
    text: "The TovNa team checks your payment.",
  },
  {
    icon: "ribbon-outline",
    title: "Paid",
    text: "Your booking is fully paid.",
  },
];
