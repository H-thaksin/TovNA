import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { fetchJson, imageUrl } from "../lib/api";
import { money } from "../lib/hooks";
import { SafeImage } from "../components/cards";
import { colors, shadow, softShadow } from "../lib/theme";

export default function HotelDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialHotel = route.params?.hotel || null;
  const hotelId = route.params?.hotelId || initialHotel?.id;

  const [hotel, setHotel] = useState(initialHotel);
  const [loading, setLoading] = useState(!initialHotel);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hotelId) {
      setError("Hotel information is unavailable.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadHotel() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchJson(`/hotels/${hotelId}`, controller.signal);

        if (result?.message === "Hotel not found") {
          throw new Error("This hotel could not be found.");
        }

        setHotel(result);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Could not load hotel details.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadHotel();

    return () => controller.abort();
  }, [hotelId]);

  const goBack = () => navigation.goBack();

  const openBooking = () => {
    if (!hotel) return;

    navigation.navigate("HotelBookingForm", { hotel });
  };

  if (loading && !hotel) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Loading hotel details...</Text>
      </SafeAreaView>
    );
  }

  if (!hotel) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="bed-outline" size={48} color={colors.muted} />
        <Text style={styles.errorText}>{error || "Hotel not found."}</Text>

        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const rating = hotel.rating != null ? Number(hotel.rating).toFixed(1) : null;
  const price = money(hotel.price_per_night);

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Photo hero */}
        <View style={styles.hero}>
          <SafeImage
            uri={imageUrl(hotel)}
            style={StyleSheet.absoluteFill}
            emoji="🏨"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0)"]}
            style={styles.heroTopShade}
          />

          {rating !== null && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#fcd34d" />
              <Text style={styles.ratingBadgeText}>{rating}</Text>
            </View>
          )}
        </View>

        {/* Overlapping sheet */}
        <View style={styles.sheet}>
          <Text style={styles.name}>{hotel.name}</Text>

          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={16} color={colors.primary} />
            <Text style={styles.address}>{hotel.address || "Cambodia"}</Text>
          </View>

          {/* Quick facts */}
          <View style={styles.stats}>
            {rating !== null && (
              <View style={styles.stat}>
                <View style={[styles.statIcon, { backgroundColor: "#fff3d6" }]}>
                  <Ionicons name="star" size={16} color="#f59e0b" />
                </View>
                <View>
                  <Text style={styles.statValue}>{rating}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </View>
            )}

            {hotel.total_rooms != null && (
              <View style={styles.stat}>
                <View style={styles.statIcon}>
                  <Ionicons
                    name="bed-outline"
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.statValue}>{hotel.total_rooms}</Text>
                  <Text style={styles.statLabel}>Rooms</Text>
                </View>
              </View>
            )}

            <View style={styles.stat}>
              <View style={styles.statIcon}>
                <Ionicons
                  name="moon-outline"
                  size={16}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={styles.statValue}>{price}</Text>
                <Text style={styles.statLabel}>Per night</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this hotel</Text>
            <Text style={styles.description}>
              {hotel.description || "No description available yet."}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>

            <View style={styles.locationCard}>
              <View style={styles.locationIcon}>
                <Ionicons name="location" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>Hotel address</Text>
                <Text style={styles.locationDescription}>
                  {hotel.address || "Address not provided"}
                </Text>
              </View>
            </View>
          </View>

          {!!error && <Text style={styles.warning}>{error}</Text>}
        </View>
      </ScrollView>

      {/* Floating back button over the photo */}
      <View style={[styles.floatBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Booking bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 14) },
        ]}
      >
        <View>
          <Text style={styles.bottomLabel}>Starting from</Text>
          <Text style={styles.bottomPrice}>
            {price}
            <Text style={styles.perNight}> / night</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={styles.bookButton}
          onPress={openBooking}
          activeOpacity={0.85}
        >
          <Text style={styles.bookButtonText}>Book now</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  muted: { color: colors.muted, fontSize: 14 },
  errorText: { color: colors.text, fontSize: 15, textAlign: "center" },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  backButtonText: { color: colors.white, fontWeight: "800" },

  content: { paddingBottom: 30 },

  // hero
  hero: { height: 320, backgroundColor: colors.primaryDark },
  heroTopShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  ratingBadge: {
    position: "absolute",
    left: 20,
    bottom: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ratingBadgeText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  floatBar: { position: "absolute", left: 18, right: 18 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },

  // sheet
  sheet: {
    marginTop: -32,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  name: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  address: { flex: 1, color: colors.muted, fontSize: 13.5 },

  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  stat: {
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...softShadow,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { color: colors.text, fontSize: 14.5, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11.5, marginTop: 1 },

  section: { marginTop: 26 },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  description: { color: colors.muted, fontSize: 14, lineHeight: 23 },

  locationCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...softShadow,
  },
  locationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  locationTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  locationDescription: { color: colors.muted, fontSize: 13, marginTop: 3 },
  warning: { color: colors.danger, fontSize: 12, marginTop: 14 },

  // bottom bar
  bottomBar: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  perNight: { color: colors.muted, fontSize: 12, fontWeight: "500" },
  bookButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  bookButtonText: { color: colors.white, fontSize: 14.5, fontWeight: "800" },
});
