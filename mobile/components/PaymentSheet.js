import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { authFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usd } from "../lib/bookings";
import {
  ABA_KHQR,
  CASH_INFO,
  PAYMENT_FLOW,
  abaQrUrl,
  hasAccountName,
} from "../lib/payment";
import { PrimaryButton } from "./ui";
import { colors } from "../lib/theme";

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <View style={styles.copyRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text style={styles.copyValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <TouchableOpacity style={styles.copyBtn} onPress={copy}>
        <Text style={styles.copyBtnText}>{copied ? "Copied ✓" : "Copy"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const Step = ({ n, children }) => (
  <View style={styles.step}>
    <View style={styles.stepNum}>
      <Text style={styles.stepNumText}>{n}</Text>
    </View>
    <Text style={styles.stepText}>{children}</Text>
  </View>
);

// Pay for a confirmed booking: choose a method, pay, then send the transaction reference.
// booking: { id, booking_reference, total_amount }   payment: existing payment or null
export default function PaymentSheet({
  booking,
  payment,
  onClose,
  onChanged,
  onConflict,
}) {
  const { logout } = useAuth();

  const [method, setMethod] = useState("ABA KHQR");
  const [created, setCreated] = useState(payment || null);
  const [reference, setReference] = useState(
    payment?.transaction_reference || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [done, setDone] = useState(false);

  const bookingRef = booking.booking_reference || `#${booking.id}`;
  const amount = created?.amount ?? booking.total_amount;
  const isAba = created?.method === "ABA KHQR";
  const savedReference = created?.transaction_reference || "";
  const unchanged = reference.trim() === savedReference;

  const fail = async (err, fallback) => {
    if (err.status === 401) {
      await logout();
      onClose();
      return;
    }
    setError(err.message || fallback);
  };

  const createPayment = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await authFetch("/payments/checkout", {
        method: "POST",
        body: { booking_id: booking.id, method },
      });
      setCreated(data.payment);
      onChanged?.(data.payment);
    } catch (err) {
      if (err.status === 409) {
        // A payment already exists (for example created on another device)
        onConflict?.(err.message);
        return;
      }
      await fail(err, "Unable to create payment.");
    } finally {
      setBusy(false);
    }
  };

  const submitReference = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await authFetch(`/payments/${created.id}/reference`, {
        method: "PATCH",
        body: { transaction_reference: reference.trim() },
      });
      setCreated(data.payment);
      onChanged?.(data.payment);
      setDone(true);
    } catch (err) {
      await fail(err, "Unable to submit transaction reference.");
    } finally {
      setBusy(false);
    }
  };

  const title = !created
    ? "Pay for your booking"
    : done
      ? "Reference submitted"
      : isAba
        ? savedReference
          ? "Change your reference"
          : "Complete your payment"
        : "Pay in cash";

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => !busy && onClose()}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.white }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>Booking {bookingRef}</Text>
          </View>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            disabled={busy}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.total}>
            <Text style={styles.totalLabel}>Amount to pay</Text>
            <Text style={styles.totalValue}>{usd(amount)}</Text>
          </View>

          {/* ---------- Step 1: choose a method ---------- */}
          {!created && (
            <>
              <Text style={styles.h}>How payment works</Text>
              <View style={styles.flow}>
                {PAYMENT_FLOW.map((item, index) => (
                  <View key={item.title} style={styles.flowItem}>
                    <View
                      style={[
                        styles.flowIcon,
                        index === 1 && styles.flowIconOn,
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={index === 1 ? colors.white : colors.primary}
                      />
                    </View>
                    <Text style={styles.flowTitle}>{item.title}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.muted}>
                You are at step 2. After you pay, the TovNa team checks it and
                marks your booking as paid.
              </Text>

              <Text style={styles.h}>Choose a payment method</Text>
              {[
                {
                  key: "ABA KHQR",
                  icon: "phone-portrait-outline",
                  title: "ABA KHQR",
                  text: "Pay with your ABA Mobile app",
                },
                {
                  key: "Cash",
                  icon: "cash-outline",
                  title: "Cash",
                  text: "Pay cash to the travel agency",
                },
              ].map((option) => {
                const on = method === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.option, on && styles.optionOn]}
                    onPress={() => setMethod(option.key)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.radio, on && styles.radioOn]}>
                      {on && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.optionIcon}>
                      <Ionicons
                        name={option.icon}
                        size={22}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{option.title}</Text>
                      <Text style={styles.muted}>{option.text}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.note}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={colors.primaryDark}
                />
                <Text style={styles.noteText}>
                  Choose carefully: you can’t change the method after you
                  continue.{" "}
                  {method === "ABA KHQR"
                    ? "Next you will see a QR code to pay."
                    : "Your payment stays pending until the agency receives your cash."}
                </Text>
              </View>
            </>
          )}

          {/* ---------- Step 2: ABA KHQR ---------- */}
          {created && isAba && !done && (
            <>
              {!savedReference && (
                <>
                  <Text style={styles.h}>How to pay with ABA</Text>
                  <Step n={1}>
                    Take a <Text style={styles.bold}>screenshot</Text> of the QR
                    code below.
                  </Step>
                  <Step n={2}>
                    Open <Text style={styles.bold}>ABA Mobile</Text>, tap{" "}
                    <Text style={styles.bold}>Scan</Text>, then choose the
                    screenshot from your gallery.
                  </Step>
                  <Step n={3}>
                    Pay exactly <Text style={styles.bold}>{usd(amount)}</Text>{" "}
                    and write <Text style={styles.bold}>{bookingRef}</Text> in
                    the remark.
                  </Step>
                  <Step n={4}>
                    Copy the <Text style={styles.bold}>Transaction ID</Text>{" "}
                    from your ABA receipt and paste it below.
                  </Step>

                  <View style={styles.qrBox}>
                    {qrFailed ? (
                      <Text style={styles.qrError}>
                        The QR code couldn’t be loaded. Please contact the
                        agency to pay.
                      </Text>
                    ) : (
                      <Image
                        source={{ uri: abaQrUrl() }}
                        style={styles.qr}
                        resizeMode="contain"
                        onError={() => setQrFailed(true)}
                      />
                    )}
                  </View>

                  <CopyRow label="Amount" value={usd(amount)} />
                  <CopyRow
                    label="Remark (booking reference)"
                    value={bookingRef}
                  />
                  {hasAccountName() && (
                    <CopyRow
                      label={`Pay to (${ABA_KHQR.bankName})`}
                      value={ABA_KHQR.accountName}
                    />
                  )}
                </>
              )}

              <Text style={styles.h}>
                {savedReference
                  ? "Change your ABA transaction reference"
                  : "Enter your transaction reference"}
              </Text>
              <Text style={styles.muted}>
                Paste the Transaction ID shown in your ABA receipt. The agency
                will verify it.
              </Text>
              <TextInput
                style={styles.input}
                value={reference}
                onChangeText={setReference}
                placeholder="Transaction reference"
                placeholderTextColor="#94a3a0"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={100}
              />
            </>
          )}

          {/* ---------- Reference sent ---------- */}
          {created && isAba && done && (
            <View style={styles.success}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={34} color={colors.white} />
              </View>
              <Text style={styles.successTitle}>Thank you!</Text>
              <Text style={styles.successText}>
                We received your transaction reference. The TovNa team will
                verify your payment. You can follow its status in My payments.
              </Text>
            </View>
          )}

          {/* ---------- Cash ---------- */}
          {created && !isAba && (
            <>
              <View style={styles.success}>
                <View style={styles.successIcon}>
                  <Ionicons
                    name="cash-outline"
                    size={32}
                    color={colors.white}
                  />
                </View>
                <Text style={styles.successTitle}>Payment created</Text>
                <Text style={styles.successText}>
                  Please pay {usd(amount)} in cash to the travel agency. Your
                  payment stays pending until the agency confirms it.
                </Text>
              </View>
              {Object.entries({
                Place: CASH_INFO.place,
                Address: CASH_INFO.address,
                Phone: CASH_INFO.phone,
                Hours: CASH_INFO.hours,
              })
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <CopyRow key={label} label={label} value={value} />
                ))}
              <CopyRow label="Booking reference" value={bookingRef} />
            </>
          )}

          {!!error && (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ---------- Buttons ---------- */}
          <View style={{ marginTop: 22, gap: 10 }}>
            {!created ? (
              <PrimaryButton
                label="Continue"
                onPress={createPayment}
                loading={busy}
              />
            ) : isAba && !done ? (
              <PrimaryButton
                label={savedReference ? "Update reference" : "Submit reference"}
                onPress={submitReference}
                loading={busy}
                disabled={!reference.trim() || unchanged}
              />
            ) : (
              <PrimaryButton label="Done" onPress={onClose} />
            )}
            {!created || (isAba && !done) ? (
              <PrimaryButton
                label={created ? "I’ll do this later" : "Cancel"}
                outline
                onPress={onClose}
                disabled={busy}
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 20, paddingTop: 6, paddingBottom: 48 },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  totalLabel: { color: colors.primaryDark, fontWeight: "700" },
  totalValue: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  h: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 24,
    marginBottom: 10,
  },
  muted: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  bold: { color: colors.text, fontWeight: "800" },

  flow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  flowItem: { flex: 1, alignItems: "center", gap: 6 },
  flowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  flowIconOn: { backgroundColor: colors.primary },
  flowTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { color: colors.text, fontSize: 15.5, fontWeight: "800" },
  note: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  noteText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },

  step: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNumText: { color: colors.white, fontSize: 12.5, fontWeight: "800" },
  stepText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 21 },

  qrBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    marginVertical: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  qr: { width: 250, height: 250 },
  qrError: {
    color: colors.danger,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 20,
    padding: 20,
  },

  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  copyLabel: { color: colors.muted, fontSize: 12 },
  copyValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  copyBtn: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyBtnText: { color: colors.primary, fontWeight: "800", fontSize: 12.5 },

  input: {
    height: 56,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: 15.5,
  },

  success: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 8 },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#146c43",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  successText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 14.5,
    lineHeight: 22,
    marginTop: 8,
  },

  error: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 12,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#fff0f0",
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13.5, lineHeight: 19 },
});
