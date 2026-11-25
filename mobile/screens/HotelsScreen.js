import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { useApiList, money } from "../lib/hooks";
import { imageUrl } from "../lib/api";
import { SafeImage } from "../components/cards";
import { colors, shadow, softShadow } from "../lib/theme";

// variant="large" -> full-width photo card, variant="grid" -> compact 2-column card
function HotelCard({ hotel, location, variant, onPress }) {
  const price = money(hotel.price_per_night);

  if (variant === "grid") {
    return (
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.gridCard}
        onPress={onPress}
      >
        <SafeImage uri={imageUrl(hotel)} style={styles.gridImage} emoji="🏨" />
        <View style={styles.gridBody}>
          <Text style={styles.gridSub} numberOfLines={1}>
            {location}
          </Text>
          <Text style={styles.gridTitle} numberOfLines={2}>
            {hotel.name}
          </Text>
          <View style={styles.gridPriceRow}>
            <Text style={styles.gridPrice}>{price}</Text>
            <Text style={styles.perNight}> / night</Text>
          </View>
          {!!hotel.address && (
            <View style={styles.metaRow}>
              <Ionicons
                name="location-outline"
                size={13}
                color={colors.muted}
              />
              <Text style={styles.metaText} numberOfLines={1}>
                {hotel.address}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.largeCard}
      onPress={onPress}
    >
      <SafeImage
        uri={imageUrl(hotel)}
        style={StyleSheet.absoluteFill}
        emoji="🏨"
      />
      <LinearGradient
        colors={["rgba(8,30,28,0)", "rgba(8,30,28,0.88)"]}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.priceBadge}>
        <Text style={styles.priceBadgeText}>{price}</Text>
        <Text style={styles.priceBadgeSub}> / night</Text>
      </View>

      <View style={styles.largeInfo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.largeTitle} numberOfLines={1}>
            {hotel.name}
          </Text>
          <View style={styles.largeSubRow}>
            <Ionicons name="location-sharp" size={12} color={colors.white} />
            <Text style={styles.largeSub} numberOfLines={1}>
              {[
                location,
                hotel.address && hotel.address !== location
                  ? hotel.address
                  : null,
              ]
                .filter(Boolean)
                .join("  •  ")}
            </Text>
          </View>
        </View>
        <View style={styles.arrowBtn}>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HotelsScreen({ navigation, route }) {
  const hotels = useApiList("/hotels/");
  const destinations = useApiList("/destinations/");

  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState("list"); // "list" | "grid"
  const destinationId = route.params?.destination;

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

  const filteredHotels = useMemo(() => {
    const query = search.trim().toLowerCase();

    return hotels.data
      .filter((hotel) => hotel.is_active !== false)
      .filter(
        (hotel) =>
          !destinationId ||
          Number(hotel.destination_id) === Number(destinationId),
      )
      .filter((hotel) => {
        if (!query) return true;

        const destination = destinationMap[Number(hotel.destination_id)] || "";

        return (
          hotel.name?.toLowerCase().includes(query) ||
          hotel.address?.toLowerCase().includes(query) ||
          destination.toLowerCase().includes(query)
        );
      });
  }, [hotels.data, destinationId, search, destinationMap]);

  const refresh = () => {
    hotels.retry();
    destinations.retry();
  };

  // Searching always uses the grid, like the reference Search screen
  const variant = search.trim() || layout === "grid" ? "grid" : "large";
  const destinationName = destinationMap[Number(destinationId)];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={hotels.status === "loading"}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>Hotels</Text>
            <Text style={styles.subtitle}>
              Find a comfortable place to stay
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="bed" size={22} color={colors.primary} />
          </View>
        </View>

        {/* Search + layout toggle */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search hotels or destinations"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {!!search ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="search" size={20} color={colors.text} />
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.layoutButton}
            onPress={() => setLayout((l) => (l === "list" ? "grid" : "list"))}
          >
            <Ionicons
              name={layout === "list" ? "grid-outline" : "albums-outline"}
              size={22}
              color={colors.white}
            />
          </TouchableOpacity>
        </View>

        {/* Active destination filter */}
        {!!destinationId && (
          <View style={styles.filterRow}>
            <View style={styles.filterChip}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={styles.filterText} numberOfLines={1}>
                {destinationName || "Selected destination"}
              </Text>
              <TouchableOpacity
                hitSlop={8}
                onPress={() => navigation.setParams({ destination: undefined })}
              >
                <Ionicons name="close" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {search.trim()
              ? "Search results"
              : destinationId
                ? "Hotels in this destination"
                : "Available hotels"}
          </Text>
          <Text style={styles.count}>{filteredHotels.length} hotels</Text>
        </View>

        {/* Body */}
        {hotels.status === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.message}>Loading hotels...</Text>
          </View>
        ) : hotels.status === "error" ? (
          <View style={styles.center}>
            <Ionicons
              name="cloud-offline-outline"
              size={42}
              color={colors.muted}
            />
            <Text style={styles.message}>
              Could not load hotels. Please try again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={hotels.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredHotels.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="bed-outline" size={42} color={colors.muted} />
            <Text style={styles.message}>
              {search
                ? "No hotels match your search."
                : "No hotels available in this destination yet."}
            </Text>
          </View>
        ) : (
          <View style={variant === "grid" ? styles.grid : styles.list}>
            {filteredHotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                variant={variant}
                location={
                  destinationMap[Number(hotel.destination_id)] ||
                  hotel.address ||
                  "Cambodia"
                }
                onPress={() =>
                  navigation.navigate("HotelDetails", {
                    hotelId: hotel.id,
                    hotel,
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
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
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: colors.primary, fontSize: 13, marginTop: 3 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  searchBox: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    backgroundColor: colors.white,
    borderRadius: 25,
    ...softShadow,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  layoutButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  filterRow: { flexDirection: "row", marginTop: 14 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: "100%",
  },
  filterText: {
    color: colors.primaryDark,
    fontSize: 12.5,
    fontWeight: "700",
    flexShrink: 1,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 14,
  },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  count: { color: colors.muted, fontSize: 12.5, fontWeight: "600" },

  list: { gap: 16 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },

  // large card
  largeCard: {
    height: 225,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: colors.primaryDark,
    ...shadow,
  },
  priceBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomLeftRadius: 18,
  },
  priceBadgeText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  priceBadgeSub: { color: colors.ink, fontSize: 11, fontWeight: "600" },
  largeInfo: {
    position: "absolute",
    left: 18,
    right: 14,
    bottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  largeTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  largeSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  largeSub: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  arrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // grid card
  gridCard: {
    width: "48%",
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 8,
    ...softShadow,
  },
  gridImage: {
    width: "100%",
    height: 130,
    borderRadius: 16,
    overflow: "hidden",
  },
  gridBody: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 4 },
  gridSub: { color: colors.muted, fontSize: 11.5 },
  gridTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 2,
  },
  gridPriceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 8 },
  gridPrice: { color: colors.text, fontSize: 16, fontWeight: "800" },
  perNight: { color: colors.muted, fontSize: 11.5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  metaText: { color: colors.muted, fontSize: 11.5, flexShrink: 1 },

  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 55,
    gap: 12,
  },
  message: { color: colors.muted, fontSize: 14, textAlign: "center" },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
  },
  retryText: { color: colors.white, fontWeight: "700" },
});
