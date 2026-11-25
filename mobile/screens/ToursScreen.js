import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useApiList, useDetails } from "../lib/hooks";
import { TourCard } from "../components/cards";
import DetailsModal from "../components/DetailsModal";
import { colors } from "../lib/theme";

export default function ToursScreen({ onNavigate }) {
  const { data, status, retry } = useApiList("/tours/");
  const details = useDetails();
  const [search, setSearch] = useState("");

  const filteredTours = useMemo(() => {
    const query = search.trim().toLowerCase();

    return data.filter((tour) => {
      if (tour.is_active === false) return false;

      return (
        !query ||
        tour.name?.toLowerCase().includes(query) ||
        tour.description?.toLowerCase().includes(query)
      );
    });
  }, [data, search]);

  function renderTour({ item }) {
    return (
      <TourCard
        item={item}
        onView={() => details.viewTour(item)}
        onBook={() => onNavigate("tour", { item, book: true })}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore Tours</Text>
        <Text style={styles.subtitle}>
          Find your next adventure in Cambodia.
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={colors.muted} />

        <TextInput
          style={styles.searchInput}
          placeholder="Search tours..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />

        {!!search && (
          <Ionicons
            name="close-circle"
            size={20}
            color={colors.muted}
            onPress={() => setSearch("")}
          />
        )}
      </View>

      {status === "loading" && data.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>Loading tours...</Text>
        </View>
      ) : status === "error" && data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="cloud-offline-outline"
            size={42}
            color={colors.muted}
          />
          <Text style={styles.message}>Couldn't load tours.</Text>
          <Text style={styles.retry} onPress={retry}>
            Try again
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTours}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTour}
          numColumns={1}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
          refreshControl={
            <RefreshControl
              refreshing={status === "loading"}
              onRefresh={retry}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {filteredTours.length} tours available
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="map-outline" size={42} color={colors.muted} />
              <Text style={styles.message}>No tours found.</Text>
              <Text style={styles.subtitle}>
                Try searching with another keyword.
              </Text>
            </View>
          }
        />
      )}

      <DetailsModal
        selected={details.selected}
        onClose={details.close}
        onNavigate={onNavigate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 5,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginHorizontal: 20,
    marginBottom: 18,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  resultCount: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 14,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 12,
  },
  message: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "700",
  },
  retry: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 15,
    padding: 10,
  },
});
