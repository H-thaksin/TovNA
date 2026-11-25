import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { imageUrl } from "../lib/api";
import { money } from "../lib/hooks";
import { colors, shadow, softShadow } from "../lib/theme";

export function SafeImage({ uri, style, emoji = "🏞️" }) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <LinearGradient
        colors={["#0f766e", "#134e4a"]}
        style={[style, { alignItems: "center", justifyContent: "center" }]}
      >
        <Text style={{ fontSize: 36 }}>{emoji}</Text>
      </LinearGradient>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

// ---------- Loading skeleton (unchanged) ----------
function Pulse({ style }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[{ backgroundColor: "#e3ebe8", opacity }, style]} />
  );
}

export function CardSkeleton({ tall }) {
  return (
    <View style={{ width: tall ? 250 : 270 }}>
      <Pulse style={{ height: tall ? 310 : 150, borderRadius: 24 }} />
      {!tall && (
        <>
          <Pulse
            style={{ height: 16, width: "70%", borderRadius: 8, marginTop: 14 }}
          />
          <Pulse
            style={{ height: 12, width: "40%", borderRadius: 6, marginTop: 10 }}
          />
        </>
      )}
    </View>
  );
}

export function RowSkeleton() {
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      <Pulse style={{ width: 88, height: 88, borderRadius: 18 }} />
      <View style={{ flex: 1, gap: 10 }}>
        <Pulse style={{ height: 15, width: "75%", borderRadius: 8 }} />
        <Pulse style={{ height: 12, width: "45%", borderRadius: 6 }} />
      </View>
    </View>
  );
}

// =====================================================================
// NEW: shared card with two variants used by the Explore page
//   variant="large" -> full-width photo card   (like "Nearby places")
//   variant="grid"  -> compact 2-column card   (like "Search results")
// =====================================================================
function PlaceCard({
  variant,
  item,
  emoji,
  subtitle, // small text: province / category / duration
  meta, // extra info line
  metaIcon,
  badge, // yellow badge (large) / blue tag (grid)
  price, // formatted price string or null
  priceSuffix,
  loading,
  onPress,
  onBook,
}) {
  if (variant === "grid") {
    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.92}
        onPress={onPress}
      >
        <View>
          <SafeImage
            uri={imageUrl(item)}
            style={styles.gridImage}
            emoji={emoji}
          />
          {!!badge && (
            <View style={styles.gridBadge}>
              <Text style={styles.gridBadgeText}>{badge}</Text>
            </View>
          )}
          {loading && (
            <View style={[styles.loadingOverlay, { borderRadius: 14 }]}>
              <ActivityIndicator color={colors.white} />
            </View>
          )}
        </View>

        <View style={styles.gridBody}>
          <Text style={styles.gridSub} numberOfLines={1}>
            {subtitle || " "}
          </Text>
          <Text style={styles.gridTitle} numberOfLines={2}>
            {item.name}
          </Text>

          {!!price && (
            <View style={styles.gridPriceRow}>
              <Text style={styles.gridPrice}>{price}</Text>
              {!!priceSuffix && (
                <Text style={styles.mutedText}> {priceSuffix}</Text>
              )}
            </View>
          )}

          {!!meta && (
            <View style={styles.inline}>
              <Ionicons name={metaIcon} size={13} color={colors.muted} />
              <Text
                style={[styles.mutedText, { flexShrink: 1 }]}
                numberOfLines={1}
              >
                {meta}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // large
  return (
    <TouchableOpacity
      style={styles.largeCard}
      activeOpacity={0.92}
      onPress={onPress}
    >
      <SafeImage
        uri={imageUrl(item)}
        style={StyleSheet.absoluteFill}
        emoji={emoji}
      />
      <LinearGradient
        colors={["rgba(8,30,28,0)", "rgba(8,30,28,0.85)"]}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {!!badge && (
        <View style={styles.largeBadge}>
          <Text style={styles.largeBadgeText}>{badge}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.white} />
        </View>
      )}

      <View style={styles.largeInfo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.largeTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.largeSubRow}>
            <Ionicons name="location-sharp" size={12} color={colors.white} />
            <Text style={styles.largeSub} numberOfLines={1}>
              {[subtitle, meta].filter(Boolean).join("  •  ") || "Cambodia"}
            </Text>
          </View>
        </View>

        {!!onBook && (
          <TouchableOpacity
            style={styles.largeBook}
            onPress={onBook}
            activeOpacity={0.85}
          >
            <Text style={styles.largeBookText}>Book</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ---------- Destination ----------
// No `variant` -> your original tall card (Home horizontal list keeps working)
export function DestinationCard({ item, loading, onView, variant }) {
  if (variant) {
    return (
      <PlaceCard
        variant={variant}
        item={item}
        emoji="🏝️"
        subtitle={item.province}
        meta={item.best_time ? `Best: ${item.best_time}` : null}
        metaIcon="sunny-outline"
        badge={null}
        loading={loading}
        onPress={onView}
      />
    );
  }

  return (
    <TouchableOpacity
      style={styles.destCard}
      activeOpacity={0.92}
      onPress={onView}
    >
      <SafeImage
        uri={imageUrl(item)}
        style={StyleSheet.absoluteFill}
        emoji="🏝️"
      />
      <LinearGradient
        colors={["rgba(8,30,28,0.05)", "rgba(8,30,28,0.88)"]}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      {!!item.province && (
        <View style={styles.glass}>
          <Ionicons name="location" size={12} color={colors.white} />
          <Text style={styles.glassText}>{item.province}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.white} />
        </View>
      )}

      <View style={styles.destInfo}>
        <Text style={styles.destName} numberOfLines={2}>
          {item.name}
        </Text>
        {!!item.best_time && (
          <View style={styles.destMeta}>
            <Ionicons name="sunny-outline" size={14} color="#fcd34d" />
            <Text style={styles.destMetaText}>Best: {item.best_time}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ---------- Tour ----------
export function TourCard({ item, onView, onBook, variant }) {
  if (variant) {
    return (
      <PlaceCard
        variant={variant}
        item={item}
        emoji="🧭"
        subtitle={
          item.duration_days != null ? `${item.duration_days} days` : null
        }
        meta={
          item.max_people != null ? `Up to ${item.max_people} travelers` : null
        }
        metaIcon="people-outline"
        badge={money(item.price)}
        price={money(item.price)}
        priceSuffix="/ person"
        onPress={onView}
        onBook={variant === "large" ? onBook : undefined}
      />
    );
  }

  return (
    <TouchableOpacity
      style={styles.tourCard}
      activeOpacity={0.92}
      onPress={onView}
    >
      <View>
        <SafeImage uri={imageUrl(item)} style={styles.tourImage} emoji="🧭" />
        {item.duration_days != null && (
          <View style={styles.glass}>
            <Ionicons name="time-outline" size={12} color={colors.white} />
            <Text style={styles.glassText}>{item.duration_days} days</Text>
          </View>
        )}
      </View>

      <View style={styles.tourBody}>
        <Text style={styles.tourTitle} numberOfLines={2}>
          {item.name}
        </Text>
        {item.max_people != null && (
          <View style={styles.inline}>
            <Ionicons name="people-outline" size={14} color={colors.muted} />
            <Text style={styles.mutedText}>
              Up to {item.max_people} travelers
            </Text>
          </View>
        )}

        <View style={styles.tourFooter}>
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}
          >
            <Text style={styles.price}>{money(item.price)}</Text>
            <Text style={styles.mutedText}>/ person</Text>
          </View>
          <TouchableOpacity style={styles.roundBtn} onPress={onBook}>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ---------- Activity ----------
export function ActivityRow({ item, onOpen, onBook, variant }) {
  if (variant) {
    return (
      <PlaceCard
        variant={variant}
        item={item}
        emoji="🎟️"
        subtitle={item.category}
        meta={
          item.duration_hours != null ? `${item.duration_hours} hours` : null
        }
        metaIcon="time-outline"
        badge={money(item.price)}
        price={money(item.price)}
        priceSuffix="/ person"
        onPress={onOpen}
        onBook={variant === "large" ? onBook : undefined}
      />
    );
  }

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.9} onPress={onOpen}>
      <SafeImage uri={imageUrl(item)} style={styles.rowImage} emoji="🎟️" />

      <View style={{ flex: 1 }}>
        {!!item.category && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.category}</Text>
          </View>
        )}
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.inline}>
          {item.duration_hours != null && (
            <>
              <Ionicons name="time-outline" size={13} color={colors.muted} />
              <Text style={styles.mutedText}>{item.duration_hours}h</Text>
              <Text style={styles.mutedText}>·</Text>
            </>
          )}
          <Text style={styles.rowPrice}>{money(item.price)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.bookPill} onPress={onBook}>
        <Text style={styles.bookPillText}>Book</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  glass: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  glassText: { color: colors.white, fontSize: 11.5, fontWeight: "700" },
  inline: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  mutedText: { color: colors.muted, fontSize: 12.5 },
  price: { color: colors.primary, fontSize: 19, fontWeight: "800" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ----- NEW: large variant -----
  largeCard: {
    width: "100%",
    height: 215,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: colors.primaryDark,
    ...shadow,
  },
  largeBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomLeftRadius: 18,
  },
  largeBadgeText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
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
  largeBook: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  largeBookText: { color: colors.ink, fontWeight: "800", fontSize: 12.5 },

  // ----- NEW: grid variant -----
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
  gridBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  gridBadgeText: { color: colors.white, fontSize: 11, fontWeight: "800" },
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

  // ----- original styles (unchanged) -----
  destCard: {
    width: 250,
    height: 310,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.primaryDark,
    ...shadow,
  },
  destInfo: { position: "absolute", left: 16, right: 16, bottom: 16 },
  destName: {
    color: colors.white,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  destMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  destMetaText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12.5,
    fontWeight: "600",
  },

  tourCard: {
    width: 270,
    backgroundColor: colors.white,
    borderRadius: 24,
    overflow: "hidden",
    ...softShadow,
  },
  tourImage: { width: "100%", height: 150 },
  tourBody: { padding: 14 },
  tourTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  tourFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 10,
    backgroundColor: colors.white,
    borderRadius: 22,
    ...softShadow,
  },
  rowImage: { width: 88, height: 88, borderRadius: 16, overflow: "hidden" },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 5,
  },
  tagText: { color: colors.primary, fontSize: 10.5, fontWeight: "800" },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19,
  },
  rowPrice: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  bookPill: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 4,
  },
  bookPillText: { color: colors.ink, fontWeight: "800", fontSize: 12.5 },
});
