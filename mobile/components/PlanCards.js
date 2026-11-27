import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, softShadow } from "../lib/theme";

// Two entry cards for Home: the AI chat and the trip planner
export default function PlanCards({ onNavigate }) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={{ flex: 1 }}
        activeOpacity={0.9}
        onPress={() => onNavigate("ai")}
      >
        <LinearGradient colors={["#0f766e", "#0b2321"]} style={styles.card}>
          <View style={styles.iconDark}>
            <Ionicons name="sparkles" size={20} color="#fcd34d" />
          </View>
          <Text style={styles.titleLight}>AI assistant</Text>
          <Text style={styles.textLight}>Chat to plan your trip</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ flex: 1 }}
        activeOpacity={0.9}
        onPress={() => onNavigate("recommendations")}
      >
        <View style={[styles.card, styles.cardLight]}>
          <View style={styles.iconLight}>
            <Ionicons name="options-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.title}>Trip planner</Text>
          <Text style={styles.text}>Match places to your budget</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  card: {
    borderRadius: 22,
    padding: 16,
    minHeight: 112,
    justifyContent: "flex-end",
  },
  cardLight: { backgroundColor: colors.white, ...softShadow },
  iconDark: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconLight: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  titleLight: { color: colors.white, fontSize: 16.5, fontWeight: "800" },
  textLight: { color: "rgba(255,255,255,0.8)", fontSize: 12.5, marginTop: 2 },
  title: { color: colors.text, fontSize: 16.5, fontWeight: "800" },
  text: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
});
