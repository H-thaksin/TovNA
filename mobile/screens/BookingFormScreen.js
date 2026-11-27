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
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { authFetch } from "../lib/api";
import { colors, softShadow } from "../lib/theme";
import { EmptyState } from "../components/ui";

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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function BookingFormScreen({ route, navigation }) {
  const { kind, item } = route.params || {};
  const { user, authReady } = useAuth();

  const isTour = kind === "tour";
  const isActivity = kind === "activity";
  const isTransportation = kind === "transportation";

  const validService =
    item && item.id && (isTour || isActivity || isTransportation);

  const maxParticipants = isTransportation
    ? 20
    : isTour
      ? Math.max(1, Number(item?.max_people) || 50)
      : 50;

  const [date, setDate] = useState(tomorrow);
  const [participants, setParticipants] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const unitPrice = Number(item?.price) || 0;
  const total = unitPrice * participants;

  const changeParticipants = (amount) => {
    setParticipants((current) =>
      Math.min(maxParticipants, Math.max(1, current + amount)),
    );
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) return;

    setDate(selectedDate);
  };

  const submitBooking = async () => {
    if (!user) {
      navigation.navigate("Login");
      return;
    }

    if (!validService) {
      setError("The selected service could not be found.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      let body;
      let endpoint;

      if (isTour) {
        body = {
          tour_id: item.id,
          tour_date: toISODate(date),
          participants,
        };
        endpoint = "/bookings/tours";
      } else if (isActivity) {
        body = {
          activity_id: item.id,
          activity_date: toISODate(date),
          participants,
        };
        endpoint = "/bookings/activities";
      } else if (isTransportation) {
        body = {
          transportation_id: item.id,
          travel_date: toISODate(date),
          passengers: participants,
        };
        endpoint = "/bookings/transportation";
      }

      const result = await authFetch(endpoint, {
        method: "POST",
        body,
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
        setError(err.message || "Unable to create your booking.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!validService) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState
          icon="alert-circle-outline"
          title="Service not found"
          text="Please go back and select a tour or activity."
        />
      </SafeAreaView>
    );
  }

  if (!authReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {isTour ? "Book a tour" : "Book an activity"}
        </Text>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.serviceCard}>
          <View style={styles.serviceIcon}>
            <Ionicons
              name={isTour ? "map-outline" : "ticket-outline"}
              size={25}
              color={colors.primary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.serviceType}>
              {isTour ? "TOUR" : "ACTIVITY"}
            </Text>
            <Text style={styles.serviceName}>{item.name}</Text>
            <Text style={styles.unitPrice}>
              ${unitPrice.toFixed(2)} / person
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Choose your date</Text>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Booking date</Text>
            <Text style={styles.dateText}>{displayDate(date)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={date}
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

        <Text style={styles.sectionTitle}>
          {isTransportation ? "Number of passengers" : "Number of participants"}
        </Text>

        <View style={styles.participantCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.participantTitle}>Participants</Text>
            <Text style={styles.fieldLabel}>
              {isTransportation
                ? "Choose how many passengers are travelling"
                : isTour && item.max_people
                  ? `Maximum ${item.max_people} people`
                  : "Choose how many people are joining"}
            </Text>
          </View>

          <View style={styles.counter}>
            <TouchableOpacity
              style={[
                styles.counterButton,
                participants <= 1 && styles.disabledButton,
              ]}
              disabled={participants <= 1}
              onPress={() => changeParticipants(-1)}
            >
              <Ionicons name="remove" size={20} color={colors.primary} />
            </TouchableOpacity>

            <Text style={styles.count}>{participants}</Text>

            <TouchableOpacity
              style={[
                styles.counterButton,
                participants >= maxParticipants && styles.disabledButton,
              ]}
              disabled={participants >= maxParticipants}
              onPress={() => changeParticipants(1)}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Booking summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Price per person</Text>
            <Text style={styles.summaryValue}>${unitPrice.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Participants</Text>
            <Text style={styles.summaryValue}>{participants}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Estimated total</Text>
            <Text style={styles.totalPrice}>${total.toFixed(2)}</Text>
          </View>

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

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={submitBooking}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.submitText}>
                {user ? "Confirm booking" : "Log in to book"}
              </Text>
              <Ionicons name="arrow-forward" size={19} color={colors.white} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 17,
    marginBottom: 28,
    ...softShadow,
  },
  serviceIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceType: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  serviceName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 3,
  },
  unitPrice: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 5,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 8,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 24,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  dateText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  doneButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    marginBottom: 20,
  },
  doneText: {
    color: colors.primary,
    fontWeight: "800",
  },
  participantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 25,
  },
  participantTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 5,
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.35,
  },
  count: {
    minWidth: 20,
    textAlign: "center",
    color: colors.text,
    fontWeight: "800",
    fontSize: 17,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 7,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  summaryValue: {
    color: colors.text,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  totalLabel: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
  },
  totalPrice: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 22,
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 12,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff0f0",
    borderRadius: 12,
    padding: 13,
    marginBottom: 15,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
  },
  loginNote: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 12,
  },
  submitButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  submitDisabled: {
    opacity: 0.65,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
});
