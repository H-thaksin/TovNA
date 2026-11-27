import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { authFetch } from "../lib/api";
import { formatDateTime, normalize, titleCase, usd } from "../lib/bookings";
import { StatusPill, TypeTile } from "../components/bookingUi";
import PaymentSheet from "../components/PaymentSheet";
import { EmptyState, PrimaryButton } from "../components/ui";
import { colors, softShadow } from "../lib/theme";

const Stat = ({ label, value }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

export default function PaymentsScreen({ navigation }) {
  const { user, authReady, logout } = useAuth();

  const [payments, setPayments] = useState([]);
  const [bookingMap, setBookingMap] = useState({});
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null); // { booking, payment }

  const load = useCallback(async () => {
    setError("");
    setStatus((current) => (current === "ready" ? current : "loading"));
    try {
      const data = await authFetch("/payments/");
      setPayments(Array.isArray(data) ? data : data?.payments || []);

      try {
        const bookingData = await authFetch("/bookings/my?limit=200");

        const bookingList = Array.isArray(bookingData)
          ? bookingData
          : bookingData?.bookings || [];

        setBookingMap(
          Object.fromEntries(bookingList.map((x) => [x.id, normalize(x)])),
        );
      } catch {
        // Booking images are optional.
      }

      setStatus("ready");
    } catch (err) {
      if (err.status === 401) {
        await logout();
        return;
      }
      setError(err.message || "Unable to load your payments.");
      setStatus("error");
    }
  }, [logout]);

  useFocusEffect(
    useCallback(() => {
      if (authReady && user) load();
    }, [authReady, user, load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const is = (p, s) => String(p.status || "").toLowerCase() === s;
    return {
      total: payments.length,
      paid: payments.filter((p) => is(p, "paid")).length,
      pending: payments.filter((p) => is(p, "pending")).length,
      totalPaid: payments
        .filter((p) => is(p, "paid"))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    };
  }, [payments]);

  const goBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Tabs");

  const updateLocal = (payment) =>
    setPayments((current) =>
      current.some((p) => p.id === payment.id)
        ? current.map((p) => (p.id === payment.id ? { ...p, ...payment } : p))
        : [payment, ...current],
    );

  const header = (
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.round} onPress={goBack}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.topTitle}>My payments</Text>
      <View style={{ width: 42 }} />
    </View>
  );

  if (!authReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        {header}
        <EmptyState
          icon="lock-closed-outline"
          title="Please log in"
          text="You need to log in to view your payment history."
        >
          <PrimaryButton
            label="Log in"
            onPress={() => navigation.navigate("Login")}
          />
        </EmptyState>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {header}
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
        <Text style={styles.sub}>
          View your payment history and transaction details.
        </Text>

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
            title="We couldn’t load your payments"
            text={error}
          >
            <PrimaryButton label="Try again" onPress={load} />
          </EmptyState>
        )}

        {status === "ready" && (
          <>
            <View style={styles.stats}>
              <Stat label="Total payments" value={stats.total} />
              <Stat label="Paid" value={stats.paid} />
              <Stat label="Pending" value={stats.pending} />
              <Stat label="Total paid" value={usd(stats.totalPaid)} />
            </View>

            {payments.length === 0 ? (
              <EmptyState
                icon="card-outline"
                title="No payments yet"
                text="Once you pay for a confirmed booking, it will appear here."
              >
                <PrimaryButton
                  label="View my bookings"
                  onPress={() =>
                    navigation.navigate("Tabs", { screen: "Bookings" })
                  }
                />
              </EmptyState>
            ) : (
              <View style={{ gap: 14 }}>
                {payments.map((p) => {
                  const canSubmit =
                    String(p.booking_status).toLowerCase() === "confirmed" &&
                    p.method === "ABA KHQR" &&
                    String(p.status).toLowerCase() === "pending";

                  return (
                    <View key={p.id} style={styles.card}>
                      <View style={styles.cardTop}>
                        {bookingMap[p.booking_id] && (
                          <TypeTile
                            booking={bookingMap[p.booking_id]}
                            size={56}
                          />
                        )}

                        <View style={{ flex: 1 }}>
                          <Text style={styles.eyebrow}>PAYMENT</Text>
                          <Text style={styles.cardTitle}>Payment #{p.id}</Text>
                          <Text style={styles.rowLabel}>
                            Booking {p.booking_reference || `#${p.booking_id}`}
                          </Text>
                        </View>
                        <StatusPill status={p.status} />
                      </View>

                      <View style={styles.rows}>
                        <Row label="Amount" value={usd(p.amount)} />
                        <Row label="Method" value={p.method || "—"} />
                        <Row
                          label="Transaction reference"
                          value={p.transaction_reference || "Not submitted"}
                        />
                        <Row
                          label="Paid at"
                          value={formatDateTime(p.paid_at)}
                        />
                        <Row
                          label="Booking status"
                          value={titleCase(p.booking_status)}
                        />
                      </View>

                      <View style={styles.actions}>
                        {canSubmit && (
                          <TouchableOpacity
                            style={[styles.btn, styles.btnOutline]}
                            onPress={() =>
                              setSheet({
                                booking: {
                                  id: p.booking_id,
                                  booking_reference: p.booking_reference,
                                  total_amount: p.amount,
                                },
                                payment: p,
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.btnText,
                                { color: colors.primary },
                              ]}
                            >
                              {p.transaction_reference
                                ? "Change reference"
                                : "Submit reference"}
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[
                            styles.btn,
                            { backgroundColor: colors.primary },
                          ]}
                          onPress={() =>
                            navigation.navigate("BookingDetails", {
                              id: p.booking_id,
                            })
                          }
                        >
                          <Text style={styles.btnText}>View booking</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {sheet && (
        <PaymentSheet
          booking={sheet.booking}
          payment={
            payments.find((p) => p.id === sheet.payment.id) ?? sheet.payment
          }
          onClose={() => setSheet(null)}
          onChanged={updateLocal}
          onConflict={() => {
            setSheet(null);
            load();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },
  content: { padding: 20, paddingTop: 8, paddingBottom: 48 },
  sub: { color: colors.muted, fontSize: 14, marginBottom: 16 },

  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  stat: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    ...softShadow,
  },
  statLabel: { color: colors.muted, fontSize: 12 },
  statValue: {
    color: colors.primary,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 4,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 16,
    ...softShadow,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  rows: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f4",
    gap: 8,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
  },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  btnOutline: { borderWidth: 1.4, borderColor: colors.primary },
  btnText: { color: colors.white, fontWeight: "800", fontSize: 13 },
});
