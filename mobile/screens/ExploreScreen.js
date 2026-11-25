import { useEffect, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";

import { useApiList, useDetails } from "../lib/hooks";
import { DestinationCard, TourCard, ActivityRow } from "../components/cards";
import DetailsModal from "../components/DetailsModal";
import { colors, shadow } from "../lib/theme";

const CATEGORIES = [
  { key: "destinations", label: "Destinations", icon: "location-outline" },
  { key: "tours", label: "Tours", icon: "map-outline" },
  { key: "activities", label: "Activities", icon: "bicycle-outline" },
];

// which fields are searched for each category
const SEARCH_FIELDS = {
  destinations: ["name", "province"],
  tours: ["name", "description"],
  activities: ["name", "category", "description"],
};

const useFiltered = (data, fields, query) =>
  useMemo(
    () =>
      data
        .filter((item) => item.is_active !== false)
        .filter(
          (item) =>
            !query ||
            fields.some((f) =>
              item[f]?.toString().toLowerCase().includes(query),
            ),
        ),
    [data, fields, query],
  );

export default function ExploreScreen({
  onNavigate,
  initialCategory = "destinations",
}) {
  const destinations = useApiList("/destinations/");
  const tours = useApiList("/tours/");
  const activities = useApiList("/activities/");
  const details = useDetails();

  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [layout, setLayout] = useState("list"); // "list" | "grid"

  useEffect(() => {
    if (CATEGORIES.some((c) => c.key === initialCategory)) {
      setActiveCategory(initialCategory);
      setSearch("");
    }
  }, [initialCategory]);

  const query = search.trim().toLowerCase();

  const filteredDestinations = useFiltered(
    destinations.data,
    SEARCH_FIELDS.destinations,
    query,
  );
  const filteredTours = useFiltered(tours.data, SEARCH_FIELDS.tours, query);
  const filteredActivities = useFiltered(
    activities.data,
    SEARCH_FIELDS.activities,
    query,
  );

  const currentList = {
    destinations: {
      data: filteredDestinations,
      status: destinations.status,
      retry: destinations.retry,
      empty: "No destinations available yet.",
      searching: "No destinations match your search.",
      loading: "Loading destinations...",
      countLabel: "places",
    },
    tours: {
      data: filteredTours,
      status: tours.status,
      retry: tours.retry,
      empty: "No tours available yet.",
      searching: "No tours match your search.",
      loading: "Loading tours...",
      countLabel: "tours",
    },
    activities: {
      data: filteredActivities,
      status: activities.status,
      retry: activities.retry,
      empty: "No activities available yet.",
      searching: "No activities match your search.",
      loading: "Loading activities...",
      countLabel: "activities",
    },
  }[activeCategory];

  const refresh = () => {
    setRefreshing(true);
    destinations.retry();
    tours.retry();
    activities.retry();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Searching always uses the 2-column grid, like the reference "Search" screen
  const variant = query || layout === "grid" ? "grid" : "large";

  const renderItems = () => {
    if (activeCategory === "destinations") {
      return filteredDestinations.map((item) => (
        <DestinationCard
          key={item.id}
          item={item}
          variant={variant}
          onView={() => details.viewDestination(item.id)}
        />
      ));
    }

    if (activeCategory === "tours") {
      return filteredTours.map((item) => (
        <TourCard
          key={item.id}
          item={item}
          variant={variant}
          onView={() => details.viewTour(item)}
          onBook={() => onNavigate("tour", { item, book: true })}
        />
      ));
    }

    return filteredActivities.map((item) => (
      <ActivityRow
        key={item.id}
        item={item}
        variant={variant}
        onOpen={() => details.viewActivity(item)}
        onBook={() => onNavigate("activity", { item, book: true })}
      />
    ));
  };

  const activeLabel = CATEGORIES.find((c) => c.key === activeCategory)?.label;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.heading}>Explore Cambodia</Text>
            <Text style={styles.subtitle}>
              Discover places, tours and activities
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="compass" size={24} color={colors.primary} />
          </View>
        </View>

        {/* Search + layout toggle */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${activeCategory}...`}
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
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
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((category) => {
            const isActive = activeCategory === category.key;
            return (
              <TouchableOpacity
                key={category.key}
                activeOpacity={0.85}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => {
                  setActiveCategory(category.key);
                  setSearch("");
                }}
              >
                <Ionicons
                  name={category.icon}
                  size={16}
                  color={isActive ? "#fff" : colors.muted}
                />
                <Text
                  style={[styles.chipText, isActive && styles.chipTextActive]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {query ? `Results in ${activeLabel}` : activeLabel}
          </Text>
          <Text style={styles.count}>
            {currentList.data.length} {currentList.countLabel}
          </Text>
        </View>

        {!!details.notice && (
          <Text style={styles.notice}>{details.notice}</Text>
        )}

        {/* Body */}
        {currentList.status === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.message}>{currentList.loading}</Text>
          </View>
        ) : currentList.status === "error" ? (
          <View style={styles.center}>
            <Ionicons
              name="cloud-offline-outline"
              size={38}
              color={colors.muted}
            />
            <Text style={styles.message}>
              We couldn't load {activeCategory}.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={currentList.retry}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : currentList.data.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={38} color={colors.muted} />
            <Text style={styles.message}>
              {search ? currentList.searching : currentList.empty}
            </Text>
          </View>
        ) : (
          <View style={variant === "grid" ? styles.grid : styles.list}>
            {renderItems()}
          </View>
        )}
      </ScrollView>

      {details.selected && (
        <DetailsModal
          selected={details.selected}
          onClose={details.close}
          onNavigate={onNavigate}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heading: { color: colors.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: colors.primary, fontSize: 13.5, marginTop: 4 },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
    ...shadow,
    shadowOpacity: 0.05,
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

  chips: { gap: 10, paddingVertical: 20 },
  chip: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  retryText: { color: "#fff", fontWeight: "700" },
  notice: { color: "#b45309", fontSize: 13, marginBottom: 12 },
});
