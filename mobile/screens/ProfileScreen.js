import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { EmptyState, PrimaryButton } from "../components/ui";
import { colors, softShadow } from "../lib/theme";

function Row({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.rowIcon, danger && { backgroundColor: "#fff0f0" }]}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.danger : colors.primary}
        />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>
        {label}
      </Text>
      {!danger && (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const confirmLogout = () =>
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);

  if (!user) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg }}
        edges={["top"]}
      >
        <EmptyState
          icon="person-outline"
          title="Join TovNa"
          text="Log in to manage your bookings, payments and trips."
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

  const initial = (user.name || user.email || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Profile</Text>

        <LinearGradient colors={["#0b6b63", "#084f49"]} style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
            {!!user.role && (
              <View style={styles.role}>
                <Text style={styles.roleText}>
                  {String(user.role).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={styles.group}>
          <Row
            icon="calendar-outline"
            label="My bookings"
            onPress={() => navigation.navigate("Bookings")}
          />
          <Row
            icon="card-outline"
            label="My payments"
            onPress={() =>
              navigation.navigate("ComingSoon", { route: "payments" })
            }
          />
        </View>

        <View style={styles.group}>
          <Row
            icon="log-out-outline"
            label="Log out"
            danger
            onPress={confirmLogout}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 18,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 26,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 26, fontWeight: "800" },
  name: { color: colors.white, fontSize: 19, fontWeight: "800" },
  email: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  role: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  roleText: {
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  group: {
    marginTop: 18,
    backgroundColor: colors.white,
    borderRadius: 22,
    overflow: "hidden",
    ...softShadow,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, color: colors.text, fontSize: 15.5, fontWeight: "700" },
});
