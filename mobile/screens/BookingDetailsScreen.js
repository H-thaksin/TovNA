import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { authFetch, imageUrl } from "../lib/api";
import {
  STATUS_TEXT,
  STATUS_TONE,
  TYPE_EMOJI,
  TYPE_LABELS,
  formatDate,
  formatDateTime,
  normalize,
  paymentStatusLabel,
  titleCase,
  transportEmoji,
  usd,
} from "../lib/bookings";
import { CopyButton, StatusPill } from "../components/bookingUi";
import { SafeImage } from "../components/cards";
import { EmptyState, PrimaryButton } from "../components/ui";
import { colors, softShadow } from "../lib/theme";
import PaymentSheet from "../components/PaymentSheet";
import { getTransportImage } from "../lib/transport";

const Card = ({ title, icon, children, style }) => (
  <View style={[styles.card, style]}>
    {!!title && (
      <View style={styles.cardHead}>
        {!!icon && (
          <View style={styles.cardIcon}>
            <Ionicons name={icon} size={16} color={colors.primary} />
          </View>
        )}
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
    )}
    {children}
  </View>
);

const Tile = ({ icon, label, value }) => (
  <View style={styles.tile}>
    <View style={styles.tileIcon}>
      <Ionicons name={icon} size={17} color={colors.primary} />
    </View>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text style={styles.tileValue} numberOfLines={2}>
      {value || "—"}
    </Text>
  </View>
);

const PriceRow = ({ label, value, bold }) => (
  <View style={styles.priceRow}>
    <Text style={[styles.priceLabel, bold && styles.bold]}>{label}</Text>
    <Text style={[styles.priceValue, bold && styles.totalValue]}>{value}</Text>
  </View>
);

// Photo cover for hotels / tours / activities, gradient + emoji for transport
function HeroCover({ booking: b }) {
  if (b.isTransportation) {
    const vehicle = getTransportImage(b.transportKind);
    return (
      <LinearGradient
        colors={["#0f766e", "#134e4a"]}
        style={[StyleSheet.absoluteFill, styles.heroCenter]}
      >
        {vehicle ? (
          <Image
            source={vehicle}
            style={{ width: "86%", height: 200, marginBottom: 30 }}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ fontSize: 84, marginBottom: 30 }}>
            {transportEmoji(b.transportKind)}
          </Text>
        )}
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

export default function BookingDetailsScreen({ route, navigation }) {
  const { id, booking: initial } = route.params;
  const { user, authReady, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [booking, setBooking] = useState(initial ?? null);
  const [status, setStatus] = useState(initial ? "ready" : "loading"); // loading | ready | login | notfound | error
  const [error, setError] = useState("");

  const [payment, setPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("idle"); // idle | loading | ready | error
  const [paymentError, setPaymentError] = useState("");

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelMessage, setCancelMessage] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(async () => {
    // Only numbers can be booking IDs
    if (!/^\d+$/.test(String(id))) {
      setStatus("notfound");
      return;
    }
    if (!authReady) return;
    if (!user) {
      setBooking(null);
      setError("");
      setStatus("login");
      return;
    }

    setError("");
    try {
      const data = await authFetch(`/bookings/${id}`);
      setBooking(data);
      setStatus("ready");
    } catch (err) {
      if (err.status === 401) {
        await logout();
        setError("Your session has expired. Please log in again.");
        setStatus("login");
      } else if (err.status === 404) {
        setBooking(null);
        setStatus("notfound");
      } else {
        setError(err.message || "Unable to load booking.");
        setStatus((current) => (current === "ready" ? current : "error"));
      }
      return;
    }

    // The payment (if any) for this booking
    setPaymentStatus("loading");
    try {
      const list = await authFetch("/payments/");
      const mine = (Array.isArray(list) ? list : []).find(
        (p) => Number(p.booking_id) === Number(id),
      );
      setPayment(mine ?? null);
      setPaymentStatus("ready");
    } catch (err) {
      setPaymentError(
        err.message || "Payment information is temporarily unavailable.",
      );
      setPaymentStatus("error");
    }
  }, [id, authReady, user, logout]);

  // Reload each time the screen is shown (for example after coming back from payment)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const b = useMemo(() => (booking ? normalize(booking) : null), [booking]);

  const handleCancel = () => {
    Alert.alert(
      "Cancel this booking?",
      `Are you sure you want to cancel your booking for ${b.title}? This can’t be undone.`,
      [
        { text: "Keep booking", style: "cancel" },
        {
          text: "Confirm cancellation",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            setCancelError("");
            setCancelMessage("");
            try {
              const data = await authFetch(`/bookings/${id}/cancel`, {
                method: "PATCH",
              });
              // The cancel endpoint returns only { booking_id, status }, so merge just the status
              const updated = data?.booking ?? data ?? {};
              setBooking((current) => ({
                ...current,
                status: updated.status || "cancelled",
              }));
              setCancelMessage("Booking cancelled successfully.");
            } catch (err) {
              if (err.status === 401) {
                await logout();
                setCancelError(
                  "Your session has expired. Please log in again.",
                );
              } else {
                setCancelError(err.message || "Unable to cancel booking.");
              }
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Tabs");

  const openService = () => {
    const target = b?.target;
    if (!target) return;

    if (target.type === "hotels") {
      navigation.navigate("Hotels");
    } else if (target.type === "tours" || target.type === "activities") {
      navigation.navigate("Tabs", {
        screen: "Explore",
        params: {
          category: target.type,
          stamp: Date.now(),
        },
      });
    }
  };

  // ---------- Page states ----------
  if (status === "loading" || !authReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.muted}>Loading booking details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "login") {
    return (
      <SafeAreaView style={styles.safe}>
        <BackButton onPress={goBack} />
        <EmptyState
          icon="lock-closed-outline"
          title="Log in to see this booking"
          text={error || "Your reservations are saved to your account."}
        >
          <PrimaryButton
            label="Log in"
            onPress={() => navigation.navigate("Login")}
          />
        </EmptyState>
      </SafeAreaView>
    );
  }

  if (status === "notfound") {
    return (
      <SafeAreaView style={styles.safe}>
        <BackButton onPress={goBack} />
        <EmptyState
          icon="search-outline"
          title="Booking not found"
          text="This booking doesn’t exist, or you do not have permission to view it."
        >
          <PrimaryButton
            label="Back to My Bookings"
            onPress={() => navigation.navigate("Tabs", { screen: "Bookings" })}
          />
        </EmptyState>
      </SafeAreaView>
    );
  }

  if (status === "error" || !b) {
    return (
      <SafeAreaView style={styles.safe}>
        <BackButton onPress={goBack} />
        <EmptyState
          icon="alert-circle-outline"
          title="We couldn’t load this booking"
          text={error || "Something went wrong."}
        >
          <PrimaryButton label="Try again" onPress={load} />
        </EmptyState>
      </SafeAreaView>
    );
  }

  // ---------- Derived values ----------
  const { statusKey, daysToGo, isTransportation, isExperience } = b;
  const perUnit = isTransportation || isExperience;
  const unitNoun = isTransportation
    ? b.quantity === 1
      ? "passenger"
      : "passengers"
    : b.quantity === 1
      ? "participant"
      : "participants";
  const hasBreakdown = perUnit
    ? b.unitPrice !== null && b.quantity > 0
    : b.prices.some(([, amount]) => amount !== null);
  const startWord = isTransportation
    ? "Departure"
    : isExperience
      ? "Starts"
      : "Check-in";

  const countdown =
    ["cancelled", "rejected"].includes(statusKey) ||
    daysToGo == null ||
    daysToGo < 0
      ? null
      : daysToGo === 0
        ? `${startWord} today`
        : daysToGo === 1
          ? `${startWord} tomorrow`
          : `${startWord} in ${daysToGo} days`;

  const paid = payment?.status?.toLowerCase() === "paid";

  const steps = [
    {
      title: "Booking submitted",
      description: "Your reservation has been received.",
      done: Boolean(b.booking_date),
      current: statusKey === "pending",
    },
    {
      title: "Booking confirmed",
      description: "The agency has approved your reservation.",
      done: ["confirmed", "completed"].includes(statusKey),
      current: false,
    },
    {
      title: "Payment completed",
      description: paid
        ? "Your payment has been verified."
        : payment
          ? `Payment status: ${titleCase(payment.status)}.`
          : "Complete payment after your booking is confirmed.",
      done: paid,
      current: statusKey === "confirmed" && !paid,
    },
    {
      title: "Trip completed",
      description: "Enjoy your experience with TovNa!",
      done: statusKey === "completed",
      current: false,
    },
  ];

  const share = () =>
    Share.share({
      message: [
        `TovNa booking ${b.booking_reference || `#${b.id}`}`,
        b.title,
        `Status: ${titleCase(b.status)}`,
        b.start ? `${startWord}: ${formatDate(b.start)}` : null,
        `Total: ${usd(b.total_amount)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

  const payTone = STATUS_TONE[payment?.status] ?? STATUS_TONE.pending;

  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo hero */}
        <View style={styles.hero}>
          <HeroCover booking={b} />
          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)"]}
            style={styles.heroTopShade}
          />
        </View>

        {/* Overlapping sheet */}
        <View style={styles.sheet}>
          <View style={styles.badgeRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {(TYPE_LABELS[b.bookingType] || "Booking").toUpperCase()}
              </Text>
            </View>
            {!!countdown && (
              <View style={styles.countdown}>
                <Ionicons name="time-outline" size={13} color={colors.ink} />
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            )}
          </View>

          <Text style={styles.serviceTitle}>{b.title}</Text>
          <View style={styles.statusRow}>
            <StatusPill status={b.status} />
          </View>
          <Text style={styles.statusText}>
            {STATUS_TEXT[statusKey] ??
              "Check back here for updates on this booking."}
          </Text>

          {/* Reference */}
          <View style={styles.refCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.refLabel}>Booking reference</Text>
              <Text style={styles.refCode} numberOfLines={1}>
                {b.booking_reference || `#${b.id}`}
              </Text>
            </View>
            {!!b.booking_reference && <CopyButton text={b.booking_reference} />}
          </View>

          {/* Information */}
          <View style={styles.grid}>
            {isTransportation && (
              <>
                <Tile
                  icon="calendar-outline"
                  label="Travel date"
                  value={formatDate(b.start, b.travelDateRaw)}
                />
                <Tile
                  icon="people-outline"
                  label="Passengers"
                  value={b.passengers ? String(b.passengers) : ""}
                />
                <Tile
                  icon="bus-outline"
                  label="Transport"
                  value={titleCase(b.transport_type)}
                />
                <Tile
                  icon="business-outline"
                  label="Provider"
                  value={b.transport_provider}
                />
              </>
            )}
            {isExperience && (
              <>
                <Tile
                  icon="calendar-outline"
                  label={
                    b.bookingType === "tour" ? "Tour date" : "Activity date"
                  }
                  value={formatDate(b.start, b.serviceDateRaw)}
                />
                <Tile
                  icon="people-outline"
                  label={
                    b.bookingType === "tour" ? "Travelers" : "Participants"
                  }
                  value={b.participants ? String(b.participants) : ""}
                />
              </>
            )}
            {b.bookingType === "hotel" && (
              <>
                <Tile
                  icon="log-in-outline"
                  label="Check-in"
                  value={formatDate(b.start, b.checkInRaw)}
                />
                <Tile
                  icon="log-out-outline"
                  label="Check-out"
                  value={formatDate(b.end, b.checkOutRaw)}
                />
                <Tile
                  icon="bed-outline"
                  label="Rooms"
                  value={String(b.rooms)}
                />
                <Tile
                  icon="moon-outline"
                  label="Nights"
                  value={b.nights ? String(b.nights) : ""}
                />
              </>
            )}
            <Tile
              icon="finger-print-outline"
              label="Booking ID"
              value={String(b.id)}
            />
            <Tile
              icon="time-outline"
              label="Booked on"
              value={formatDateTime(b.booking_date)}
            />
          </View>

          {/* Cancel (pending bookings only) */}
          {statusKey === "pending" && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.cancelText}>Cancel booking</Text>
              )}
            </TouchableOpacity>
          )}
          {!!cancelMessage && (
            <View style={[styles.banner, { backgroundColor: "#e8f7ee" }]}>
              <Text style={[styles.bannerText, { color: "#146c43" }]}>
                {cancelMessage}
              </Text>
            </View>
          )}
          {!!cancelError && (
            <View style={[styles.banner, { backgroundColor: "#fff0f0" }]}>
              <Text style={[styles.bannerText, { color: colors.danger }]}>
                {cancelError}
              </Text>
            </View>
          )}

          {/* Price breakdown */}
          <Card title="Price breakdown" icon="receipt-outline">
            {perUnit ? (
              hasBreakdown ? (
                <PriceRow
                  label={`${usd(b.unitPrice)} × ${b.quantity} ${unitNoun}`}
                  value={usd(b.unitPrice * b.quantity)}
                />
              ) : (
                <Text style={styles.muted}>
                  A detailed breakdown isn’t available for this booking.
                </Text>
              )
            ) : hasBreakdown ? (
              b.prices.map(([label, amount]) => (
                <PriceRow
                  key={label}
                  label={label}
                  value={amount === null ? "—" : usd(amount)}
                />
              ))
            ) : (
              <Text style={styles.muted}>
                A detailed breakdown isn’t available for this booking.
              </Text>
            )}
            <View style={styles.divider} />
            <PriceRow label="Total" value={usd(b.total_amount)} bold />
          </Card>

          {/* Notes */}
          {!!b.notes && (
            <Card>
              <TouchableOpacity
                style={styles.notesHead}
                onPress={() => setNotesOpen((v) => !v)}
              >
                <Text style={styles.cardTitle}>Additional notes</Text>
                <Ionicons
                  name={notesOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.muted}
                />
              </TouchableOpacity>
              {notesOpen && (
                <Text style={[styles.muted, { marginTop: 10 }]}>{b.notes}</Text>
              )}
            </Card>
          )}

          {/* Progress */}
          <Card title="Booking progress" icon="git-commit-outline">
            {["cancelled", "rejected"].includes(statusKey) ? (
              <Text style={styles.muted}>
                This booking is {statusKey}. The normal booking progress has
                stopped.
              </Text>
            ) : (
              steps.map((step, index) => (
                <View key={step.title} style={styles.step}>
                  <View style={styles.rail}>
                    <View
                      style={[
                        styles.marker,
                        step.done && styles.markerDone,
                        step.current && styles.markerCurrent,
                      ]}
                    >
                      {step.done ? (
                        <Ionicons
                          name="checkmark"
                          size={15}
                          color={colors.white}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.markerText,
                            step.current && { color: colors.primary },
                          ]}
                        >
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    {index < steps.length - 1 && (
                      <View
                        style={[styles.line, step.done && styles.lineDone]}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 18 }}>
                    <Text
                      style={[
                        styles.stepTitle,
                        !step.done && !step.current && { color: colors.muted },
                      ]}
                    >
                      {step.title}
                    </Text>
                    <Text style={styles.stepText}>{step.description}</Text>
                  </View>
                </View>
              ))
            )}
          </Card>

          {/* Payment */}
          <Card title="Payment" icon="card-outline">
            {paymentStatus === "loading" && (
              <Text style={styles.muted}>Loading payment information…</Text>
            )}
            {paymentStatus === "error" && (
              <View
                style={[
                  styles.banner,
                  { backgroundColor: "#fff7e0", marginTop: 0 },
                ]}
              >
                <Text style={[styles.bannerText, { color: "#7a5200" }]}>
                  {paymentError}
                </Text>
              </View>
            )}

            {paymentStatus === "ready" && !payment && (
              <>
                <Text style={styles.text}>
                  No payment has been created for this booking yet.
                </Text>
                {statusKey === "confirmed" ? (
                  <>
                    <Text style={[styles.muted, { marginTop: 6 }]}>
                      Your booking is confirmed. You can now pay for it.
                    </Text>
                    <PrimaryButton
                      label="Pay now"
                      style={{ marginTop: 14 }}
                      onPress={() => setPayOpen(true)}
                    />
                  </>
                ) : (
                  <Text style={[styles.muted, { marginTop: 6 }]}>
                    Payment will become available after your booking is
                    confirmed.
                  </Text>
                )}
              </>
            )}

            {paymentStatus === "ready" && payment && (
              <>
                <View style={styles.payHead}>
                  <Text style={styles.text}>Payment #{payment.id}</Text>
                  <View
                    style={[styles.payPill, { backgroundColor: payTone.bg }]}
                  >
                    <Text style={[styles.payPillText, { color: payTone.fg }]}>
                      {paymentStatusLabel(payment.status)}
                    </Text>
                  </View>
                </View>
                <View style={styles.payGrid}>
                  <PriceRow label="Amount" value={usd(payment.amount)} />
                  <PriceRow label="Method" value={payment.method} />
                  <PriceRow
                    label="Reference"
                    value={payment.transaction_reference || "Not submitted"}
                  />
                  <PriceRow
                    label="Payment date"
                    value={formatDateTime(payment.paid_at)}
                  />
                </View>
                {payment.status?.toLowerCase() === "pending" && (
                  <Text style={styles.waiting}>
                    Your payment is waiting for verification by the TovNa team.
                  </Text>
                )}

                {statusKey === "confirmed" &&
                  payment.method === "ABA KHQR" &&
                  payment.status?.toLowerCase() === "pending" && (
                    <PrimaryButton
                      outline
                      style={{ marginTop: 14 }}
                      label={
                        payment.transaction_reference
                          ? "Change transaction reference"
                          : "Submit ABA reference"
                      }
                      onPress={() => setPayOpen(true)}
                    />
                  )}
              </>
            )}
          </Card>

          {/* Actions */}
          <View style={{ gap: 10, marginTop: 4 }}>
            {!!b.target && (
              <PrimaryButton
                outline
                label={`View ${b.bookingType}`}
                onPress={openService}
              />
            )}
            {isTransportation && (
              <PrimaryButton
                outline
                label="Find more transport"
                onPress={() => navigation.navigate("Transportation")}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating buttons over the photo */}
      <View style={[styles.floatBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.round} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.round} onPress={share}>
          <Ionicons name="share-outline" size={21} color={colors.text} />
        </TouchableOpacity>
      </View>
      {payOpen && (
        <PaymentSheet
          booking={booking}
          payment={payment}
          onClose={() => setPayOpen(false)}
          onChanged={() => load()}
          onConflict={() => {
            setPayOpen(false);
            load();
          }}
        />
      )}
    </View>
  );
}

function BackButton({ onPress }) {
  return (
    <TouchableOpacity style={[styles.round, { margin: 16 }]} onPress={onPress}>
      <Ionicons name="arrow-back" size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  content: { paddingBottom: 48 },

  // hero + floating buttons
  hero: { height: 290, backgroundColor: colors.primaryDark },
  heroCenter: { alignItems: "center", justifyContent: "center" },
  heroTopShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  floatBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },

  // overlapping sheet
  sheet: {
    marginTop: -32,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    paddingTop: 22,
    gap: 16,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  typeBadgeText: {
    color: colors.primary,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1,
  },
  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  countdownText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  serviceTitle: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 31,
    letterSpacing: -0.5,
    marginTop: -4,
  },
  statusRow: { flexDirection: "row" },
  statusText: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: -6,
  },

  refCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    ...softShadow,
  },
  refLabel: { color: colors.muted, fontSize: 12 },
  refCode: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginTop: 3,
  },

  // cards
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 18,
    ...softShadow,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    ...softShadow,
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileLabel: { color: colors.muted, fontSize: 12 },
  tileValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3,
  },

  cancelBtn: {
    height: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: colors.danger, fontWeight: "800", fontSize: 15 },
  banner: { borderRadius: 14, padding: 12 },
  bannerText: { fontSize: 13.5, fontWeight: "600", lineHeight: 19 },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  priceLabel: { color: colors.muted, fontSize: 14, flexShrink: 1 },
  priceValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  bold: { color: colors.text, fontWeight: "800" },
  totalValue: { color: colors.primary, fontSize: 21, fontWeight: "800" },
  divider: { height: 1, backgroundColor: "#f1f5f4", marginVertical: 8 },
  notesHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // progress timeline
  step: { flexDirection: "row", gap: 14 },
  rail: { alignItems: "center", width: 28 },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  markerDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  markerCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  markerText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  lineDone: { backgroundColor: colors.primary },
  stepTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  stepText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },

  payHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  payGrid: { backgroundColor: colors.bg, borderRadius: 16, padding: 12 },
  payPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  payPillText: { fontSize: 11.5, fontWeight: "800" },
  waiting: { color: "#92580a", fontSize: 13, marginTop: 12 },
  text: { color: colors.text, fontSize: 14.5, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
});
