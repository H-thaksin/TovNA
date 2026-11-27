import { useMemo } from "react";
import {
  Image,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useApiList, money } from "../lib/hooks";
import { transportEmoji } from "../lib/bookings";
import { getTransportImage } from "../lib/transport";
import { colors, shadow, softShadow } from "../lib/theme";

const TYPE_ICONS = {
  bus: "bus-outline",
  van: "car-outline",
  minivan: "car-sport-outline",
  boat: "boat-outline",
  ferry: "boat-outline",
};

function getTransportIcon(type) {
  const key = String(type || "").toLowerCase();
  return TYPE_ICONS[key] || "navigate-outline";
}

function formatDuration(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value <= 0) {
    return "Duration unavailable";
  }

  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;

  if (!hours) return `${remainingMinutes} minutes`;
  if (!remainingMinutes) return `${hours} hours`;

  return `${hours} hr ${remainingMinutes} min`;
}

const Tile = ({ icon, label, value, accent }) => (
  <View style={styles.tile}>
    <View style={styles.tileIcon}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </View>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text
      style={[styles.tileValue, accent && { color: colors.primary }]}
      numberOfLines={2}
    >
      {value}
    </Text>
  </View>
);

export default function TransportationDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.max(380, Math.round(height * 0.6)); // 60% of the screen
  const carWidth = Math.min(width * 0.92, 440);
  const carHeight = Math.round(carWidth * 0.62);
  const transportation = route.params?.transportation;
  const transportationId = route.params?.transportationId;

  const destinations = useApiList("/destinations/");

  const destinationMap = useMemo(
    () =>
      Object.fromEntries(
        destinations.data.map((destination) => [
          Number(destination.id),
          destination.name,
        ]),
      ),
    [destinations.data],
  );

  if (!transportation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={42}
            color={colors.muted}
          />
          <Text style={styles.errorTitle}>Transportation not found</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fromName =
    destinationMap[Number(transportation.from_destination_id)] ||
    "Starting location";

  const toName =
    destinationMap[Number(transportation.to_destination_id)] || "Destination";

  const transportType = String(transportation.type || "Transportation");
  const kind = transportType.toLowerCase();

  const share = () =>
    Share.share({
      message: `${transportation.provider || "Transportation"}: ${fromName} to ${toName} (${formatDuration(
        transportation.duration_minutes,
      )}) - ${money(transportation.price)} per passenger`,
    });

  const openBooking = () =>
    navigation.navigate("BookingForm", {
      kind: "transportation",
      item: transportation,
    });

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Gradient hero */}
        <LinearGradient
          colors={["#0f766e", "#134e4a"]}
          style={[
            styles.hero,
            { height: heroHeight, paddingTop: insets.top + 40 },
          ]}
        >
          <View
            style={[
              styles.heroRing,
              { width: carWidth, height: carHeight + 20 },
            ]}
          >
            <View
              style={[styles.heroGround, { width: carWidth * 0.72, bottom: 4 }]}
            />
            <View
              style={[
                styles.heroCircle,
                { width: carWidth, height: carHeight },
              ]}
            >
              {getTransportImage(kind) ? (
                <Image
                  source={getTransportImage(kind)}
                  style={{ width: carWidth, height: carHeight }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.heroEmoji}>{transportEmoji(kind)}</Text>
              )}
            </View>
          </View>

          <View style={styles.heroRoute}>
            <Text style={styles.heroRouteText} numberOfLines={1}>
              {fromName}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.white} />
            <Text style={styles.heroRouteText} numberOfLines={1}>
              {toName}
            </Text>
          </View>
        </LinearGradient>

        {/* Overlapping sheet */}
        <View style={styles.sheet}>
          <View style={styles.badgeRow}>
            <View style={styles.typeBadge}>
              <Ionicons
                name={getTransportIcon(kind)}
                size={13}
                color={colors.primary}
              />
              <Text style={styles.typeBadgeText}>
                {transportType.toUpperCase()}
              </Text>
            </View>

            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={13} color={colors.ink} />
              <Text style={styles.durationBadgeText}>
                {formatDuration(transportation.duration_minutes)}
              </Text>
            </View>
          </View>

          <Text style={styles.provider}>
            {transportation.provider || "Transportation provider"}
          </Text>
          <Text style={styles.heroSubtitle}>
            Travel comfortably to your destination
          </Text>

          {/* Route */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Travel route</Text>

            <View style={styles.routeNames}>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationLabel}>FROM</Text>
                <Text style={styles.locationName} numberOfLines={2}>
                  {fromName}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={styles.locationLabel}>TO</Text>
                <Text
                  style={[styles.locationName, { textAlign: "right" }]}
                  numberOfLines={2}
                >
                  {toName}
                </Text>
              </View>
            </View>

            <View style={styles.routeTrack}>
              <View style={styles.startDot} />
              <View style={styles.routeLine} />
              <View style={styles.routeMid}>
                <Ionicons
                  name={getTransportIcon(kind)}
                  size={16}
                  color={colors.white}
                />
              </View>
              <View style={styles.routeLine} />
              <View style={styles.endDot} />
            </View>
          </View>

          {/* Service information */}
          <View style={styles.grid}>
            <Tile
              icon="time-outline"
              label="Duration"
              value={formatDuration(transportation.duration_minutes)}
            />
            <Tile
              icon="cash-outline"
              label="Per passenger"
              value={money(transportation.price)}
              accent
            />
            <Tile
              icon="business-outline"
              label="Provider"
              value={transportation.provider || "Not specified"}
            />
            <Tile
              icon={getTransportIcon(kind)}
              label="Vehicle"
              value={transportType}
            />
          </View>

          {/* Description */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About this service</Text>
            <Text style={styles.description}>
              {transportation.description ||
                "No additional information is available for this service."}
            </Text>
          </View>

          <View style={styles.notice}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.noticeText}>
              Travel duration and prices are estimates. Please verify service
              details before your trip.
            </Text>
          </View>

          <Text style={styles.serviceId}>
            Service ID: {transportationId || transportation.id}
          </Text>
        </View>
      </ScrollView>

      {/* Floating back button over the hero */}
      <View style={[styles.floatBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={share}>
          <Ionicons name="share-outline" size={21} color={colors.text} />
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
          <Text style={styles.bottomLabel}>Price per passenger</Text>
          <Text style={styles.bottomPrice}>{money(transportation.price)}</Text>
        </View>

        <TouchableOpacity
          style={styles.bookButton}
          activeOpacity={0.85}
          onPress={openBooking}
        >
          <Text style={styles.bookButtonText}>Book this service</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 30 },

  // hero
  hero: {
    height: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  heroRing: {
    width: 300,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  heroGround: {
    position: "absolute",
    bottom: 8,
    width: 220,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  heroCircle: {
    width: 300,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 62 },
  heroImage: { width: 280, height: 180 },
  heroRoute: {
    position: "absolute",
    bottom: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "88%",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  heroRouteText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: "800",
    flexShrink: 1,
  },
  floatBar: {
    position: "absolute",
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },

  // sheet
  sheet: {
    marginTop: -40,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 20,
    paddingTop: 24,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  typeBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 1,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  durationBadgeText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  provider: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 31,
    letterSpacing: -0.5,
    marginTop: 14,
  },
  heroSubtitle: { fontSize: 13.5, color: colors.muted, marginTop: 6 },

  // cards
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 18,
    marginTop: 18,
    ...softShadow,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 14,
  },

  // route
  routeNames: { flexDirection: "row", gap: 12 },
  locationLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  routeTrack: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  startDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  endDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  routeLine: { flex: 1, height: 2, backgroundColor: colors.border },
  routeMid: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },

  // info tiles
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  tile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    ...softShadow,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileLabel: { fontSize: 12, color: colors.muted },
  tileValue: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.text,
    marginTop: 3,
  },

  description: { fontSize: 14, lineHeight: 23, color: colors.muted },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.primarySoft,
    padding: 15,
    borderRadius: 18,
    marginTop: 18,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.primaryDark,
  },
  serviceId: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: 18,
  },

  // bottom bar
  bottomBar: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  bookButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  bookButtonText: { color: colors.white, fontSize: 14.5, fontWeight: "800" },

  // not found
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 12,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 16,
  },
  errorButtonText: { color: colors.white, fontWeight: "800" },
});
