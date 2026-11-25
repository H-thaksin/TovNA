import { useState } from "react";
import {
  ImageBackground,
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
import { useApiList, useDetails } from "../lib/hooks";
import {
  ActivityRow,
  CardSkeleton,
  DestinationCard,
  RowSkeleton,
  TourCard,
} from "../components/cards";
import DetailsModal from "../components/DetailsModal";
import { colors, shadow } from "../lib/theme";

const CATEGORIES = [
  { icon: "compass-outline", label: "Places", route: "destinations" },
  { icon: "bed-outline", label: "Hotels", route: "hotels" },
  { icon: "map-outline", label: "Tours", route: "tours" },
  { icon: "ticket-outline", label: "Activities", route: "activities" },
  { icon: "bus-outline", label: "Transport", route: "transportation" },
];

// ---------- Pieces ----------

function Header({ user, onNavigate }) {
  const first = user?.name?.split(" ")[0];
  const initial = (user?.name || "").trim().charAt(0).toUpperCase();

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {user ? (
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => onNavigate("profile")}
          >
            <Text style={styles.avatarText}>{initial || "U"}</Text>
          </TouchableOpacity>
        ) : (
          <LinearGradient colors={["#0f766e", "#0b2321"]} style={styles.avatar}>
            <Text style={[styles.avatarText, { color: "#fcd34d" }]}>T</Text>
          </LinearGradient>
        )}
        <View>
          <Text style={styles.hello}>
            {first ? `Hello, ${first} 👋` : "Welcome to TovNa 👋"}
          </Text>
          <Text style={styles.where}>Where to next?</Text>
        </View>
      </View>

      {user ? (
        <TouchableOpacity
          style={styles.bell}
          onPress={() => onNavigate("notifications")}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={colors.text}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.loginPill}
          onPress={() => onNavigate("login")}
        >
          <Text style={styles.loginText}>Log in</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SearchBar({ onNavigate }) {
  const [query, setQuery] = useState("");
  const search = () => onNavigate("articles", { q: query.trim() });

  return (
    <View style={styles.search}>
      <Ionicons name="search" size={20} color={colors.muted} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search destinations, tours…"
        placeholderTextColor="#94a3a0"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={search}
      />
      <TouchableOpacity style={styles.searchBtn} onPress={search}>
        <Ionicons name="arrow-forward" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

function Categories({ onNavigate }) {
  return (
    <View style={styles.categories}>
      {CATEGORIES.map(({ icon, label, route }) => (
        <TouchableOpacity
          key={route}
          style={styles.category}
          onPress={() => onNavigate(route)}
        >
          <View style={styles.categoryIcon}>
            <Ionicons name={icon} size={24} color={colors.primary} />
          </View>
          <Text style={styles.categoryLabel}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PromoHero({ onNavigate }) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onNavigate("destinations")}
    >
      <ImageBackground
        source={require("../assets/hero/hero-background.jpg")}
        style={styles.promo}
        imageStyle={{ borderRadius: 28 }}
      >
        <LinearGradient
          colors={["rgba(11,35,33,0.25)", "rgba(11,35,33,0.88)"]}
          style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
        />
        <View style={styles.promoBadge}>
          <Text style={styles.promoBadgeText}>EXPLORE CAMBODIA</Text>
        </View>
        <Text style={styles.promoTitle}>
          Your next adventure{"\n"}starts{" "}
          <Text style={{ color: colors.accent }}>here.</Text>
        </Text>
        <View style={styles.promoBtn}>
          <Text style={styles.promoBtnText}>Start exploring</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.ink} />
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={10}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ErrorCard({ onRetry }) {
  return (
    <View style={styles.errorCard}>
      <Ionicons name="cloud-offline-outline" size={26} color={colors.muted} />
      <Text style={styles.errorText}>
        We couldn’t load this. Check that the server is running.
      </Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

// Handles loading / error / empty for one list
function Block({ list, skeleton, children }) {
  if (list.status === "loading") return skeleton;
  if (list.status === "error") return <ErrorCard onRetry={list.retry} />;
  if (list.data.length === 0)
    return <Text style={styles.empty}>Nothing here yet. Check back soon.</Text>;
  return children;
}

const HList = ({ children }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.hList}
    decelerationRate="fast"
  >
    {children}
  </ScrollView>
);

function StoryBanner({ onNavigate }) {
  return (
    <ImageBackground
      source={require("../assets/hero/story-band.jpg")}
      style={styles.story}
      imageStyle={{ borderRadius: 28 }}
    >
      <LinearGradient
        colors={["rgba(8,79,73,0.55)", "rgba(11,35,33,0.92)"]}
        style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
      />
      <Text style={styles.storyTitle}>Your Cambodia story starts here</Text>
      <Text style={styles.storyText}>
        From the temples of Angkor to the islands of the south, build a journey
        that feels like yours.
      </Text>
      <TouchableOpacity
        style={styles.storyBtn}
        onPress={() => onNavigate("tours")}
      >
        <Text style={styles.storyBtnText}>Browse tours</Text>
      </TouchableOpacity>
    </ImageBackground>
  );
}

// ---------- Screen ----------

export default function HomeScreen({ user, onNavigate }) {
  const destinations = useApiList("/destinations/");
  const tours = useApiList("/tours/");
  const activities = useApiList("/activities/");
  const hotels = useApiList("/hotels/");
  const details = useDetails();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    destinations.retry();
    tours.retry();
    activities.retry();
    hotels.retry();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        <Header user={user} onNavigate={onNavigate} />
        <SearchBar onNavigate={onNavigate} />
        <Categories onNavigate={onNavigate} />

        {!!details.notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{details.notice}</Text>
          </View>
        )}

        <PromoHero onNavigate={onNavigate} />

        <SectionHeader
          title="Popular destinations"
          onSeeAll={() => onNavigate("destinations")}
        />
        <Block
          list={destinations}
          skeleton={
            <HList>
              <CardSkeleton tall />
              <CardSkeleton tall />
            </HList>
          }
        >
          <HList>
            {destinations.data.slice(0, 6).map((item) => (
              <DestinationCard
                key={item.id}
                item={item}
                loading={details.loadingId === item.id}
                onView={() => details.viewDestination(item.id)}
              />
            ))}
          </HList>
        </Block>

        <SectionHeader
          title="Popular tours"
          onSeeAll={() => onNavigate("tours")}
        />
        <Block
          list={tours}
          skeleton={
            <HList>
              <CardSkeleton />
              <CardSkeleton />
            </HList>
          }
        >
          <HList>
            {tours.data.slice(0, 6).map((item) => (
              <TourCard
                key={item.id}
                item={item}
                onView={() => details.viewTour(item)}
                onBook={() => onNavigate("tour", { item, book: true })}
              />
            ))}
          </HList>
        </Block>

        <SectionHeader
          title="Things to do"
          onSeeAll={() => onNavigate("activities")}
        />
        <Block
          list={activities}
          skeleton={
            <View style={styles.vList}>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </View>
          }
        >
          <View style={styles.vList}>
            {activities.data.slice(0, 4).map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                onOpen={() => onNavigate("activity", { item })}
                onBook={() => onNavigate("activity", { item, book: true })}
              />
            ))}
          </View>
        </Block>

        <View style={{ marginTop: 30, paddingHorizontal: 20 }}>
          <StoryBanner onNavigate={onNavigate} />
        </View>
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: "800" },
  hello: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  where: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  bell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
    shadowOpacity: 0.06,
  },
  loginPill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  loginText: { color: colors.white, fontWeight: "800", fontSize: 13.5 },

  // Search
  search: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    paddingLeft: 18,
    paddingRight: 6,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.white,
    ...shadow,
    shadowOpacity: 0.08,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 15,
    color: colors.text,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // Categories
  categories: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 26,
  },
  category: { alignItems: "center", width: 64 },
  categoryIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryLabel: { color: colors.text, fontSize: 11.5, fontWeight: "700" },

  // Promo
  promo: {
    height: 200,
    marginHorizontal: 20,
    padding: 20,
    justifyContent: "flex-end",
  },
  promoBadge: {
    position: "absolute",
    top: 18,
    left: 20,
    backgroundColor: "rgba(245,158,11,0.22)",
    borderColor: "rgba(245,158,11,0.7)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  promoBadgeText: {
    color: "#fcd34d",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  promoTitle: {
    color: colors.white,
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 31,
    letterSpacing: -0.5,
  },
  promoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 14,
  },
  promoBtnText: { color: colors.ink, fontWeight: "800", fontSize: 13 },

  // Sections
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 30,
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  seeAll: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  hList: { paddingHorizontal: 20, gap: 14, paddingBottom: 14 },
  vList: { paddingHorizontal: 20, gap: 12 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 24 },

  errorCard: {
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 22,
    backgroundColor: colors.white,
  },
  errorText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: colors.white, fontWeight: "800" },

  notice: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff7e0",
    borderWidth: 1,
    borderColor: "#f5d58a",
  },
  noticeText: { color: "#7a5200", fontSize: 13 },

  // Story banner
  story: { padding: 24, minHeight: 210, justifyContent: "flex-end" },
  storyTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  storyText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 8,
  },
  storyBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 16,
  },
  storyBtnText: { color: colors.ink, fontWeight: "800", fontSize: 13.5 },
});
