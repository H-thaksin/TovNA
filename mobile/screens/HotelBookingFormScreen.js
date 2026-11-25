import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useAuth } from "../lib/auth";
import { authFetch, imageUrl } from "../lib/api";
import { colors, shadow, softShadow } from "../lib/theme";
import { EmptyState } from "../components/ui";
import { SafeImage } from "../components/cards";

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return date;
};

const toISODate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const displayDate = (date) =>
  date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const formatMoney = (value) => `$${Number(value).toFixed(2)}`;

// Small − 1 + stepper used for nights and rooms
function Stepper({ value, min, max, onChange }) {
  return (
    <View style={styles.counter}>
      <TouchableOpacity
        style={[styles.counterButton, value <= min && styles.disabledButton]}
        disabled={value <= min}
        onPress={() => onChange(-1)}
      >
        <Ionicons name="remove" size={20} color={colors.primary} />
      </TouchableOpacity>

      <Text style={styles.count}>{value}</Text>

      <TouchableOpacity
        style={[styles.counterButton, value >= max && styles.disabledButton]}
        disabled={value >= max}
        onPress={() => onChange(1)}
      >
        <Ionicons name="add" size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

export default function HotelBookingFormScreen({ route, navigation }) {
  const { hotel } = route.params || {};
  const { user, authReady } = useAuth();
  const insets = useSafeAreaInsets();

  const validHotel = hotel?.id != null;

  const [checkIn, setCheckIn] = useState(tomorrow);
  const [nights, setNights] = useState(1);
  const [rooms, setRooms] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const unitPrice = Number(hotel?.price_per_night) || 0;

  const baseTotal = unitPrice * nights * rooms;
  const accommodationTax = baseTotal * 0.02;
  const vat = baseTotal * 0.1;
  const serviceCharge = baseTotal * 0.1;
  const total = baseTotal + accommodationTax + vat + serviceCharge;

  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + nights);

  const changeNights = (amount) => {
    setNights((current) => Math.min(14, Math.max(1, current + amount)));
  };

  const changeRooms = (amount) => {
    setRooms((current) => Math.min(20, Math.max(1, current + amount)));
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) return;

    setCheckIn(selectedDate);
  };

  const submitBooking = async () => {
    if (!user) {
      navigation.navigate("Login");
      return;
    }

    if (!validHotel) {
      setError("The selected hotel could not be found.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await authFetch("/bookings", {
        method: "POST",
        body: {
          hotel_id: hotel.id,
          check_in: toISODate(checkIn),
          nights,
          rooms,
        },
      });

      const booking = result.booking;

      if (!booking?.id) {
        throw new Error("The server did not return a booking ID.");
      }

      navigation.replace("BookingDetails", {
        id: booking.id,
        booking,
      });
    } catch (err) {
      if (err.status === 401) {
        setError("Your session has expired. Please log in again.");
      } else {
        setError(err.message || "Unable to create your hotel booking.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!authReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!validHotel) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          icon="alert-circle-outline"
          title="Hotel not found"
          text="Please go back and select a hotel."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Book a hotel</Text>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hotel summary */}
        <View style={styles.hotelCard}>
          <SafeImage
            uri={imageUrl(hotel)}
            style={styles.hotelImage}
            emoji="🏨"
          />

          <View style={styles.hotelInfo}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>HOTEL</Text>
            </View>
            <Text style={styles.hotelName} numberOfLines={2}>
              {hotel.name}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.hotelPrice}>{formatMoney(unitPrice)}</Text>
              <Text style={styles.perNight}> / night</Text>
            </View>
          </View>
        </View>

        {/* Dates */}
        <Text style={styles.sectionTitle}>Your dates</Text>

        <TouchableOpacity
          style={styles.dateCard}
          activeOpacity={0.9}
          onPress={() => setShowDatePicker(true)}
        >
          <View style={styles.dateCol}>
            <View style={styles.dateIcon}>
              <Ionicons
                name="log-in-outline"
                size={18}
                color={colors.primary}
              />
            </View>
            <Text style={styles.fieldLabel}>Check-in</Text>
            <Text style={styles.dateText}>{displayDate(checkIn)}</Text>
          </View>

          <View style={styles.dateArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.muted} />
            <Text style={styles.nightsPill}>
              {nights} {nights === 1 ? "night" : "nights"}
            </Text>
          </View>

          <View style={[styles.dateCol, { alignItems: "flex-end" }]}>
            <View style={styles.dateIcon}>
              <Ionicons
                name="log-out-outline"
                size={18}
                color={colors.primary}
              />
            </View>
            <Text style={styles.fieldLabel}>Check-out</Text>
            <Text style={styles.dateText}>{displayDate(checkOut)}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.tapHint}>Tap to change your check-in date</Text>

        {showDatePicker && (
          <DateTimePicker
            value={checkIn}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={tomorrow()}
            onChange={handleDateChange}
          />
        )}

        {Platform.OS === "ios" && showDatePicker && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => setShowDatePicker(false)}
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        )}

        {/* Stay */}
        <Text style={styles.sectionTitle}>Your stay</Text>

        <View style={styles.counterCard}>
          <View style={styles.counterIcon}>
            <Ionicons name="moon-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.counterTitle}>Nights</Text>
            <Text style={styles.counterSub}>Up to 14 nights</Text>
          </View>
          <Stepper value={nights} min={1} max={14} onChange={changeNights} />
        </View>

        <View style={styles.counterCard}>
          <View style={styles.counterIcon}>
            <Ionicons name="bed-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.counterTitle}>Rooms</Text>
            <Text style={styles.counterSub}>Up to 20 rooms</Text>
          </View>
          <Stepper value={rooms} min={1} max={20} onChange={changeRooms} />
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Booking summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {formatMoney(unitPrice)} × {nights}{" "}
              {nights === 1 ? "night" : "nights"} × {rooms}{" "}
              {rooms === 1 ? "room" : "rooms"}
            </Text>
            <Text style={styles.summaryValue}>{formatMoney(baseTotal)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Accommodation tax (2%)</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(accommodationTax)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>VAT (10%)</Text>
            <Text style={styles.summaryValue}>{formatMoney(vat)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service charge (10%)</Text>
            <Text style={styles.summaryValue}>
              {formatMoney(serviceCharge)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Estimated total</Text>
            <Text style={styles.totalPrice}>{formatMoney(total)}</Text>
          </View>
        </View>

        <View style={styles.noteBox}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.note}>
            Your booking will be submitted as pending and will require
            confirmation from the TovNa team.
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color={colors.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!user && (
          <Text style={styles.loginNote}>
            Please log in before submitting your booking.
          </Text>
        )}
      </ScrollView>

      {/* Sticky confirm bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 14) },
        ]}
      >
        <View>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomPrice}>{formatMoney(total)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={submitBooking}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.submitText}>
                {user ? "Confirm booking" : "Log in to book"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  content: { padding: 20, paddingTop: 10, paddingBottom: 30 },

  // hotel summary
  hotelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 10,
    ...softShadow,
  },
  hotelImage: {
    width: 104,
    height: 104,
    borderRadius: 18,
    overflow: "hidden",
  },
  hotelInfo: { flex: 1, paddingRight: 6 },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  hotelName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: 6,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  hotelPrice: { color: colors.primary, fontSize: 17, fontWeight: "800" },
  perNight: { color: colors.muted, fontSize: 12 },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 26,
    marginBottom: 12,
  },

  // dates
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 16,
    ...softShadow,
  },
  dateCol: { flex: 1 },
  dateIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  fieldLabel: { color: colors.muted, fontSize: 12 },
  dateText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "800",
    marginTop: 3,
  },
  dateArrow: { alignItems: "center", gap: 6, paddingHorizontal: 8 },
  nightsPill: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "800",
  },
  tapHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  doneButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    marginTop: 6,
  },
  doneText: { color: colors.primary, fontWeight: "800" },

  // counters
  counterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    ...softShadow,
  },
  counterIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  counterTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  counterSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  counter: { flexDirection: "row", alignItems: "center", gap: 12 },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: { opacity: 0.35 },
  count: {
    minWidth: 22,
    textAlign: "center",
    color: colors.text,
    fontWeight: "800",
    fontSize: 17,
  },

  // summary
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 18,
    marginTop: 14,
    ...softShadow,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
    gap: 12,
  },
  summaryLabel: { flex: 1, color: colors.muted, fontSize: 13.5 },
  summaryValue: { color: colors.text, fontWeight: "700", fontSize: 13.5 },
  divider: { height: 1, backgroundColor: "#f1f5f4", marginVertical: 10 },
  totalLabel: { color: colors.text, fontWeight: "800", fontSize: 15 },
  totalPrice: { color: colors.primary, fontWeight: "900", fontSize: 22 },

  noteBox: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  note: { flex: 1, color: colors.text, fontSize: 12.5, lineHeight: 19 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff0f0",
    borderRadius: 14,
    padding: 13,
    marginTop: 14,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13 },
  loginNote: { color: colors.muted, fontSize: 13, marginTop: 14 },

  // sticky bar
  bottomBar: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    ...shadow,
  },
  bottomLabel: { color: colors.muted, fontSize: 11.5 },
  bottomPrice: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 2,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 24,
  },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});
