import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { Ionicons } from "@expo/vector-icons";
import { useApiList, money } from "../lib/hooks";
import { getTransportImage } from "../lib/transport";
import { colors, shadow, softShadow } from "../lib/theme";

const TRANSPORT_TYPES = ["All", "Bus", "Van", "Minivan", "Boat", "Ferry"];

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

const SORT_LABELS = {
  default: "Recommended",
  low: "Price: low to high",
  high: "Price: high to low",
  duration: "Shortest trip",
};

// A horizontally scrolling row of pills
function PillRow({ label, icon, anyLabel, options, value, onChange }) {
  return (
    <View style={styles.pillBlock}>
      <View style={styles.pillLabelRow}>
        <Ionicons name={icon} size={15} color={colors.primary} />
        <Text style={styles.pillLabel}>{label}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillList}
      >
        <TouchableOpacity
          style={[styles.pill, !value && styles.pillActive]}
          onPress={() => onChange("")}
        >
          <Text style={[styles.pillText, !value && styles.pillTextActive]}>
            {anyLabel}
          </Text>
        </TouchableOpacity>

        {options.map((destination) => {
          const active = value === String(destination.id);
          return (
            <TouchableOpacity
              key={`${label}-${destination.id}`}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onChange(active ? "" : String(destination.id))}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {destination.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// The vehicle picture (falls back to an icon if there is no image)
function VehicleImage({ type }) {
  const source = getTransportImage(type);
  return (
    <View style={styles.vehicleTile}>
      {source ? (
        <Image
          source={source}
          style={styles.vehicleImage}
          resizeMode="contain"
        />
      ) : (
        <Ionicons
          name={getTransportIcon(type)}
          size={34}
          color={colors.primary}
        />
      )}
    </View>
  );
}

export default function TransportationScreen({ navigation, route }) {
  const transportations = useApiList("/transportations/");
  const destinations = useApiList("/destinations/");

  const [search, setSearch] = useState("");
  const [fromDestination, setFromDestination] = useState(
    route?.params?.fromDestinationId
      ? String(route.params.fromDestinationId)
      : "",
  );
  const [toDestination, setToDestination] = useState(
    route?.params?.toDestinationId ? String(route.params.toDestinationId) : "",
  );
  const [selectedType, setSelectedType] = useState("All");
  const [sortOrder, setSortOrder] = useState("default");

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

  const destinationOptions = useMemo(
    () =>
      [...destinations.data].sort((a, b) =>
        String(a.name).localeCompare(String(b.name)),
      ),
    [destinations.data],
  );

  const filteredTransportations = useMemo(() => {
    const query = search.trim().toLowerCase();

    let results = transportations.data.filter((item) => {
      const fromName = destinationMap[Number(item.from_destination_id)] || "";
      const toName = destinationMap[Number(item.to_destination_id)] || "";

      const matchesSearch =
        !query ||
        [item.provider, item.type, item.description, fromName, toName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesFrom =
        !fromDestination ||
        Number(item.from_destination_id) === Number(fromDestination);

      const matchesTo =
        !toDestination ||
        Number(item.to_destination_id) === Number(toDestination);

      const matchesType =
        selectedType === "All" ||
        String(item.type || "").toLowerCase() === selectedType.toLowerCase();

      return (
        item.is_active !== false &&
        matchesSearch &&
        matchesFrom &&
        matchesTo &&
        matchesType
      );
    });

    if (sortOrder === "low") {
      results.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortOrder === "high") {
      results.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortOrder === "duration") {
      results.sort(
        (a, b) => Number(a.duration_minutes) - Number(b.duration_minutes),
      );
    }

    return results;
  }, [
    transportations.data,
    destinationMap,
    search,
    fromDestination,
    toDestination,
    selectedType,
    sortOrder,
  ]);

  const refresh = () => {
    transportations.retry();
    destinations.retry();
  };

  const getDuration = (minutes) => {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value <= 0) return "Duration unavailable";

    const hours = Math.floor(value / 60);
    const remainingMinutes = value % 60;

    if (!hours) return `${remainingMinutes} min`;
    if (!remainingMinutes) return `${hours} hr`;
    return `${hours} hr ${remainingMinutes} min`;
  };

  const openDetails = (transportation) => {
    navigation.navigate("TransportationDetails", {
      transportationId: transportation.id,
      transportation,
    });
  };

  const clearFilters = () => {
    setSearch("");
    setFromDestination("");
    setToDestination("");
    setSelectedType("All");
    setSortOrder("default");
  };

  const cycleSort = () =>
    setSortOrder((current) => {
      if (current === "default") return "low";
      if (current === "low") return "high";
      if (current === "high") return "duration";
      return "default";
    });

  const hasFilters =
    !!search || !!fromDestination || !!toDestination || selectedType !== "All";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={transportations.status === "loading"}
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
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>Transportation</Text>
            <Text style={styles.subtitle}>Travel around Cambodia</Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="bus" size={22} color={colors.primary} />
          </View>
        </View>

        {/* Search + sort */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search routes or providers"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="search" size={20} color={colors.text} />
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.sortButton}
            onPress={cycleSort}
          >
            <Ionicons name="swap-vertical" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Route filter */}
        <View style={styles.routeFilter}>
          <PillRow
            label="From"
            icon="radio-button-on"
            anyLabel="Anywhere"
            options={destinationOptions}
            value={fromDestination}
            onChange={setFromDestination}
          />
          <View style={styles.filterDivider} />
          <PillRow
            label="To"
            icon="location"
            anyLabel="Anywhere"
            options={destinationOptions}
            value={toDestination}
            onChange={setToDestination}
          />
        </View>

        {/* Type chips (Ionicons so they can change colour) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeList}
        >
          {TRANSPORT_TYPES.map((type) => {
            const active = selectedType === type;
            return (
              <TouchableOpacity
                key={type}
                activeOpacity={0.85}
                style={[styles.typeChip, active && styles.typeChipActive]}
                onPress={() => setSelectedType(type)}
              >
                <Ionicons
                  name={
                    type === "All" ? "apps-outline" : getTransportIcon(type)
                  }
                  size={16}
                  color={active ? colors.white : colors.muted}
                />
                <Text
                  style={[styles.typeText, active && styles.typeTextActive]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Results header */}
        <View style={styles.resultsHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Available services</Text>
            <Text style={styles.resultsSubtitle}>
              {filteredTransportations.length} found · {SORT_LABELS[sortOrder]}
            </Text>
          </View>

          {hasFilters && (
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Body */}
        {transportations.status === "loading" ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateText}>Finding transportation...</Text>
          </View>
        ) : transportations.status === "error" ? (
          <View style={styles.stateBox}>
            <Ionicons
              name="cloud-offline-outline"
              size={42}
              color={colors.muted}
            />
            <Text style={styles.stateTitle}>Could not load services</Text>
            <Text style={styles.stateText}>
              Please check your connection and try again.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={transportations.retry}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredTransportations.length === 0 ? (
          <View style={styles.stateBox}>
            <Ionicons name="bus-outline" size={44} color={colors.muted} />
            <Text style={styles.stateTitle}>No services found</Text>
            <Text style={styles.stateText}>
              Try another route or change your filters.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={clearFilters}>
              <Text style={styles.retryText}>Clear filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredTransportations.map((item) => {
              const fromName =
                destinationMap[Number(item.from_destination_id)] ||
                "Starting location";
              const toName =
                destinationMap[Number(item.to_destination_id)] || "Destination";
              const type = String(item.type || "transport").toLowerCase();

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.serviceCard}
                  activeOpacity={0.92}
                  onPress={() => openDetails(item)}
                >
                  {/* Vehicle + provider + price */}
                  <View style={styles.cardTop}>
                    <VehicleImage type={type} />

                    <View style={styles.providerInfo}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>
                          {String(item.type || "Transport").toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.providerName} numberOfLines={2}>
                        {item.provider || "Transportation provider"}
                      </Text>
                      <View style={styles.durationRow}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={colors.muted}
                        />
                        <Text style={styles.durationText}>
                          {getDuration(item.duration_minutes)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.priceBox}>
                      <Text style={styles.price}>{money(item.price)}</Text>
                      <Text style={styles.perPerson}>per person</Text>
                    </View>
                  </View>

                  {/* Route */}
                  <View style={styles.routeBox}>
                    <View style={styles.routeSide}>
                      <View style={styles.routeDot} />
                      <Text style={styles.routeName} numberOfLines={1}>
                        {fromName}
                      </Text>
                    </View>

                    <View style={styles.routeLine} />
                    <Ionicons
                      name="arrow-forward-circle"
                      size={22}
                      color={colors.primary}
                    />
                    <View style={styles.routeLine} />

                    <View
                      style={[styles.routeSide, { justifyContent: "flex-end" }]}
                    >
                      <Text
                        style={[styles.routeName, { textAlign: "right" }]}
                        numberOfLines={1}
                      >
                        {toName}
                      </Text>
                      <View style={styles.routeDotEnd} />
                    </View>
                  </View>

                  {item.description ? (
                    <Text style={styles.description} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Action */}
                  <View style={styles.detailsButton}>
                    <Text style={styles.detailsText}>View details</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={15}
                      color={colors.white}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 14,
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
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.primary, marginTop: 3 },
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 25,
    paddingHorizontal: 18,
    height: 50,
    gap: 10,
    ...softShadow,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  sortButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // route filter
  routeFilter: {
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingVertical: 14,
    marginTop: 18,
    ...softShadow,
  },
  pillBlock: { gap: 10 },
  pillLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
  },
  pillLabel: { fontSize: 13, fontWeight: "800", color: colors.text },
  pillList: { gap: 8, paddingHorizontal: 16 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.bg,
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  pillTextActive: { color: colors.white },
  filterDivider: {
    height: 1,
    backgroundColor: "#f1f5f4",
    marginVertical: 12,
    marginHorizontal: 16,
  },

  // type chips
  typeList: { gap: 8, paddingVertical: 18, paddingRight: 8 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  typeChipActive: { backgroundColor: colors.primary },
  typeText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  typeTextActive: { color: colors.white },

  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: colors.text },
  resultsSubtitle: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  clearText: { fontSize: 12.5, fontWeight: "800", color: colors.primary },

  // service card
  list: { gap: 16 },
  serviceCard: {
    backgroundColor: colors.white,
    borderRadius: 26,
    padding: 14,
    ...shadow,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  vehicleTile: {
    width: 108,
    height: 84,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleImage: { width: 96, height: 62 },
  providerInfo: { flex: 1, alignItems: "flex-start", gap: 5 },
  typeBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: colors.primary,
  },
  providerName: {
    fontSize: 15.5,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 20,
  },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  durationText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  priceBox: { alignItems: "flex-end", alignSelf: "flex-start", paddingTop: 2 },
  price: { fontSize: 19, fontWeight: "800", color: colors.text },
  perPerson: { fontSize: 11, color: colors.muted, marginTop: 2 },

  routeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 14,
  },
  routeSide: { flex: 1.4, flexDirection: "row", alignItems: "center", gap: 8 },
  routeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  routeDotEnd: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  routeName: {
    flexShrink: 1,
    fontSize: 13.5,
    fontWeight: "800",
    color: colors.text,
  },
  routeLine: { flex: 0.4, height: 2, backgroundColor: colors.border },

  description: {
    fontSize: 12.5,
    color: colors.muted,
    lineHeight: 19,
    marginTop: 12,
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 999,
    marginTop: 14,
  },
  detailsText: { fontSize: 13.5, fontWeight: "800", color: colors.white },

  // states
  stateBox: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    marginTop: 5,
    ...softShadow,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: 12,
  },
  stateText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
    marginTop: 16,
  },
  retryText: { color: colors.white, fontSize: 13, fontWeight: "800" },
});
