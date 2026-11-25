import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { authFetch, imageUrl } from "../lib/api";
import {
  INACTIVE_STATUSES,
  TYPE_EMOJI,
  TYPE_LABELS,
  formatDate,
  isUpcoming,
  normalize,
  paymentStatusLabel,
  titleCase,
  transportEmoji,
  usd,
  STATUS_TONE,
} from "../lib/bookings";
import { CopyButton, StatusPill } from "../components/bookingUi";
import { SafeImage } from "../components/cards";
import { EmptyState, PrimaryButton } from "../components/ui";
import { colors, softShadow } from "../lib/theme";

const shortDate = (date, raw) =>
  date
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : raw || "";

// Small icon + text pill used for the key facts
const InfoChip = ({ icon, text }) =>
  text ? (
    <View style={styles.infoChip}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={styles.infoChipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  ) : null;

// Photo cover (tour / activity / hotel) or gradient + emoji (transport)
function Cover({ booking: b }) {
  if (b.isTransportation) {
    return (
      <LinearGradient
        colors={["#0f766e", "#134e4a"]}
        style={[StyleSheet.absoluteFill, styles.coverCenter]}
      >
        <Text style={{ fontSize: 64, marginBottom: 28 }}>
          {transportEmoji(b.transportKind)}
        </Text>
      </LinearGradient>
    );
  }
  return (
    <SafeImage
      uri={imageUrl({ image_url: b.image })}
      style={StyleSheet.absoluteFill}
      emoji={TYPE_EMOJI[b.bookingType]}
    />
  );
}

function BookingCard({
  booking: b,
  payment,
  cancelling,
  onOpen,
  onCancel,
  onPay,
}) {
  const isPending = b.statusKey === "pending";
  const isConfirmed = b.statusKey === "confirmed";
  const hasReference = Boolean(payment?.transaction_reference);
  const canPay = isConfirmed && !payment;
  const canEditReference =
    isConfirmed &&
    payment?.method === "ABA KHQR" &&
    payment.status === "pending";
  const awaiting =
    isConfirmed &&
    payment?.status === "pending" &&
    (payment.method === "Cash" || hasReference);
  const payTone = STATUS_TONE[payment?.status] ?? STATUS_TONE.pending;

  // "Today" / "Tomorrow" / "In 5 days" badge for active bookings
  const active = !INACTIVE_STATUSES.includes(b.statusKey);
  const countdown =
    active && b.daysToGo != null && b.daysToGo >= 0
      ? b.daysToGo === 0
        ? "Today"
        : b.daysToGo === 1
          ? "Tomorrow"
          : `In ${b.daysToGo} days`
      : null;

  // Key facts shown as chips
  let chips = [];
  if (b.isTransportation) {
    chips = [
      ["calendar-outline", shortDate(b.start, b.travelDateRaw)],
      [
        "people-outline",
        b.passengers
          ? `${b.passengers} ${b.passengers === 1 ? "passenger" : "passengers"}`
          : "",
      ],
      [
        "bus-outline",
        [titleCase(b.transport_type), b.transport_provider]
          .filter(Boolean)
          .join(" · "),
      ],
    ];
  } else if (b.isExperience) {
    chips = [
      ["calendar-outline", shortDate(b.start, b.serviceDateRaw)],
      [
        "people-outline",
        b.participants
          ? `${b.participants} ${b.participants === 1 ? "person" : "people"}`
          : "",
      ],
    ];
  } else {
    const dates = [
      shortDate(b.start, b.checkInRaw),
      shortDate(b.end, b.checkOutRaw),
    ]
      .filter(Boolean)
      .join(" → ");
    chips = [
      ["calendar-outline", dates],
      [
        "moon-outline",
        b.nights > 0
          ? `${b.nights} ${b.nights === 1 ? "night" : "nights"}`
          : "",
      ],
    ];
  }

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={onOpen}>
      <View style={styles.cardClip}>
        {/* Cover */}
        <View style={styles.cover}>
          <Cover booking={b} />
          <LinearGradient
            colors={["rgba(8,30,28,0.05)", "rgba(8,30,28,0.85)"]}
            locations={[0.3, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.coverTop}>
            <StatusPill status={b.status} />
            {!!countdown && (
              <View style={styles.countdown}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            )}
          </View>

          <View style={styles.coverInfo}>
            <Text style={styles.typeLabel}>
              {(TYPE_LABELS[b.bookingType] || "Booking").toUpperCase()}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {b.title}
            </Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {isPending && (
            <View style={styles.pendingNote}>
              <Ionicons name="hourglass-outline" size={14} color="#92580a" />
              <Text style={styles.hint}>Waiting for confirmation</Text>
            </View>
          )}

          <View style={styles.chips}>
            {chips.map(([icon, text]) => (
              <InfoChip key={icon} icon={icon} text={text} />
            ))}
          </View>

          <View style={styles.refRow}>
            <Text style={styles.refLabel}>Ref</Text>
            <Text style={styles.refCode} numberOfLines={1}>
              {b.booking_reference || `#${b.id}`}
            </Text>
            {!!b.booking_reference && <CopyButton text={b.booking_reference} />}
          </View>

          {payment && (
            <View style={styles.payBox}>
              <View style={styles.payRow}>
                <Text style={styles.factLabel}>Payment · {payment.method}</Text>
                <Text style={[styles.payStatus, { color: payTone.fg }]}>
                  {paymentStatusLabel(payment.status)}
                </Text>
              </View>
              {hasReference && (
                <Text style={styles.factLabel} numberOfLines={1}>
                  Ref: {payment.transaction_reference}
                </Text>
              )}
              {canEditReference && (
                <TouchableOpacity style={styles.smallOutline} onPress={onPay}>
                  <Text style={styles.smallOutlineText}>
                    {hasReference ? "Change reference" : "Submit ABA reference"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.footer}>
            <View>
              <Text style={styles.factLabel}>Total</Text>
              <Text style={styles.total}>{usd(b.total_amount)}</Text>
            </View>
            <View style={styles.actions}>
              {canPay && (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#146c43" }]}
                  onPress={onPay}
                >
                  <Text style={styles.btnText}>Pay now</Text>
                </TouchableOpacity>
              )}
              {isPending && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnDanger]}
                  disabled={cancelling}
                  onPress={onCancel}
                >
                  <Text style={[styles.btnText, { color: colors.danger }]}>
                    {cancelling ? "Cancelling…" : "Cancel"}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={onOpen}
              >
                <Text style={styles.btnText}>Details</Text>
              </TouchableOpacity>
            </View>
          </View>

          {awaiting && (
            <Text style={styles.hint}>Awaiting payment verification</Text>
          )}
          {payment?.status === "failed" && (
            <Text style={styles.hint}>
              Payment failed. Please contact the agency.
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map(([key, label, count]) => {
        const active = key === value;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(key)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {label} <Text style={{ opacity: 0.6 }}>{count}</Text>
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function BookingsScreen({ navigation }) {
  const { user, authReady, logout } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    setStatus((current) => (current === "ready" ? current : "loading"));

    const [bookingResult, paymentResult] = await Promise.allSettled([
      authFetch("/bookings/my?limit=200"),
      authFetch("/payments/"),
    ]);

    const failure =
      bookingResult.status === "rejected"
        ? bookingResult.reason
        : paymentResult.status === "rejected" &&
            paymentResult.reason?.status === 401
          ? paymentResult.reason
          : null;

    if (failure) {
      if (failure.status === 401) {
        await logout(); // token expired: the login prompt shows
        return;
      }
      setError(failure.message || "Unable to load your bookings.");
      setStatus("error");
      return;
    }

    setBookings(Array.isArray(bookingResult.value) ? bookingResult.value : []);
    if (paymentResult.status === "fulfilled") {
      setPayments(
        Array.isArray(paymentResult.value) ? paymentResult.value : [],
      );
      setPaymentError("");
    } else {
      setPayments([]);
      setPaymentError(
        paymentResult.reason?.message || "Payment information is unavailable.",
      );
    }
    setStatus("ready");
  }, [logout]);

  // Reload whenever the tab is opened so new bookings and payments show up
  useFocusEffect(
    useCallback(() => {
      if (authReady && user) load();
    }, [authReady, user, load]),
  );

  useEffect(() => {
    if (!user) {
      setBookings([]);
      setPayments([]);
      setStatus("idle");
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const cancelBooking = (booking) => {
    const label = booking.booking_reference || `#${booking.id}`;
    Alert.alert(
      "Cancel booking",
      `Cancel booking ${label}? This cannot be undone.`,
      [
        { text: "Keep booking", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: async () => {
            setCancellingId(booking.id);
            setNotice("");
            try {
              await authFetch(`/bookings/${booking.id}/cancel`, {
                method: "PATCH",
              });
              setNotice("Booking cancelled.");
            } catch (err) {
              if (err.status === 401) await logout();
              else
                Alert.alert(
                  "Couldn’t cancel",
                  err.message || "Unable to cancel this booking.",
                );
            } finally {
              setCancellingId(null);
              load();
            }
          },
        },
      ],
    );
  };

  const openDetails = (booking) =>
    navigation.navigate("BookingDetails", { id: booking.id, booking });
  const openPayment = () =>
    navigation.navigate("ComingSoon", { route: "payments" });

  const paymentsByBooking = useMemo(
    () => payments.reduce((map, p) => ({ ...map, [p.booking_id]: p }), {}),
    [payments],
  );
  const items = useMemo(() => bookings.map(normalize), [bookings]);
  const statuses = useMemo(
    () => [...new Set(items.map((b) => b.statusKey))],
    [items],
  );
  const types = useMemo(
    () => [...new Set(items.map((b) => b.bookingType))],
    [items],
  );

  const visible = items.filter(
    (b) =>
      (statusFilter === "all" || b.statusKey === statusFilter) &&
      (typeFilter === "all" || b.bookingType === typeFilter),
  );
  const upcoming = visible
    .filter(isUpcoming)
    .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
  const past = visible
    .filter((b) => !isUpcoming(b))
    .sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));

  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
  };

  if (!authReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <EmptyState
          icon="lock-closed-outline"
          title="Log in to see your bookings"
          text="Your trips, tours and hotel stays are saved to your account."
        >
          <PrimaryButton
            label="Log in"
            onPress={() => navigation.navigate("Login")}
          />
          <PrimaryButton
            label="Create account"
            outline
            onPress={() => navigation.navigate("Signup")}
          />
        </EmptyState>
      </SafeAreaView>
    );
  }

  const renderGroup = (title, list) =>
    list.length === 0 ? null : (
      <View style={{ marginTop: 24 }}>
        <Text style={styles.groupTitle}>
          {title} <Text style={styles.groupCount}>{list.length}</Text>
        </Text>
        <View style={{ gap: 18 }}>
          {list.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              payment={paymentsByBooking[b.id] || null}
              cancelling={cancellingId === b.id}
              onOpen={() => openDetails(b)}
              onCancel={() => cancelBooking(b)}
              onPay={openPayment}
            />
          ))}
        </View>
      </View>
    );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.heading}>My bookings</Text>
        <Text style={styles.subtitle}>
          Your hotel, transport, tour and activity reservations.
        </Text>

        {!!notice && (
          <TouchableOpacity
            style={styles.successBox}
            onPress={() => setNotice("")}
          >
            <Text style={styles.successText}>{notice}</Text>
          </TouchableOpacity>
        )}
        {!!paymentError && status === "ready" && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              We couldn’t load your payment information: {paymentError}
            </Text>
          </View>
        )}

        {(status === "loading" || status === "idle") && (
          <ActivityIndicator
            color={colors.primary}
            size="large"
            style={{ marginTop: 40 }}
          />
        )}

        {status === "error" && (
          <EmptyState
            icon="alert-circle-outline"
            title="We couldn’t load your bookings"
            text={error}
          >
            <PrimaryButton label="Try again" onPress={load} />
          </EmptyState>
        )}

        {status === "ready" && items.length === 0 && (
          <EmptyState
            icon="calendar-outline"
            title="No bookings yet"
            text="Your reservations will appear here once you book a tour, activity or hotel."
          >
            <PrimaryButton
              label="Browse tours"
              onPress={() =>
                navigation.navigate("Explore", {
                  category: "tours",
                  q: "",
                  stamp: Date.now(),
                })
              }
            />
          </EmptyState>
        )}

        {status === "ready" && items.length > 0 && (
          <>
            <Text style={styles.summary}>
              <Text style={styles.bold}>{items.length}</Text>{" "}
              {items.length === 1 ? "booking" : "bookings"} ·{" "}
              <Text style={styles.bold}>{items.filter(isUpcoming).length}</Text>{" "}
              upcoming
            </Text>

            {types.length > 1 && (
              <ChipRow
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  ["all", "All types", items.length],
                  ...types.map((t) => [
                    t,
                    TYPE_LABELS[t],
                    items.filter((b) => b.bookingType === t).length,
                  ]),
                ]}
              />
            )}
            {statuses.length > 1 && (
              <ChipRow
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  ["all", "Any status", items.length],
                  ...statuses.map((s) => [
                    s,
                    titleCase(s),
                    items.filter((b) => b.statusKey === s).length,
                  ]),
                ]}
              />
            )}

            {visible.length === 0 ? (
              <EmptyState
                icon="funnel-outline"
                title="No bookings match these filters"
              >
                <PrimaryButton
                  label="Clear filters"
                  outline
                  onPress={clearFilters}
                />
              </EmptyState>
            ) : (
              <>
                {renderGroup("Upcoming", upcoming)}
                {renderGroup("Past, cancelled and rejected", past)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 40 },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 5 },
  summary: { color: colors.muted, fontSize: 13.5, marginTop: 18 },
  bold: { color: colors.text, fontWeight: "800" },

  // filter chips: same look as the Explore page
  chipRow: { gap: 8, paddingTop: 12, paddingRight: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },
  chipTextActive: { color: colors.white },

  successBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#e8f7ee",
  },
  successText: { color: "#146c43", fontWeight: "700", fontSize: 13.5 },
  warnBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff7e0",
    borderWidth: 1,
    borderColor: "#f5d58a",
  },
  warnText: { color: "#7a5200", fontSize: 13 },
  groupTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
  },
  groupCount: { color: colors.muted, fontSize: 14, fontWeight: "600" },

  // ----- booking card -----
  card: {
    backgroundColor: colors.white,
    borderRadius: 26,
    ...softShadow,
  },
  cardClip: { borderRadius: 26, overflow: "hidden" },
  cover: { height: 165, backgroundColor: colors.primaryDark },
  coverCenter: { alignItems: "center", justifyContent: "center" },
  coverTop: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  countdown: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  countdownText: { color: colors.ink, fontSize: 11.5, fontWeight: "800" },
  coverInfo: { position: "absolute", left: 16, right: 16, bottom: 14 },
  typeLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: -0.3,
    marginTop: 3,
  },

  body: { padding: 16 },
  pendingNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  hint: { color: "#92580a", fontSize: 12.5, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  infoChipText: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: "700",
    flexShrink: 1,
  },

  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  refLabel: { color: colors.muted, fontSize: 12 },
  refCode: { flex: 1, color: colors.text, fontWeight: "800", fontSize: 13.5 },

  factLabel: { color: colors.muted, fontSize: 12.5 },
  payBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.bg,
    gap: 4,
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  payStatus: { fontSize: 12.5, fontWeight: "800" },
  smallOutline: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderWidth: 1.2,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallOutlineText: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 12.5,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f4",
  },
  total: { color: colors.text, fontSize: 21, fontWeight: "800" },
  actions: {
    flexDirection: "row",
    gap: 8,
    flexShrink: 1,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  btnDanger: { backgroundColor: "#fff0f0" },
  btnText: { color: colors.white, fontWeight: "800", fontSize: 12.5 },
});
