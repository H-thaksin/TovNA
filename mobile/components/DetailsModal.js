import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { imageUrl } from "../lib/api";
import { money } from "../lib/hooks";
import { colors } from "../lib/theme";
import { SafeImage } from "./cards";

function Chip({ icon, text }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

// Quick view sheet: photo on top, info card, sticky action bar
export default function DetailsModal({ selected, onClose, onNavigate }) {
  if (!selected) return null;

  const { kind, data } = selected;
  const isDestination = kind === "destination";
  const isTour = kind === "tour";
  const isActivity = kind === "activity";

  const tours = data.tours || [];
  const hasCoordinates = data.latitude != null && data.longitude != null;

  const go = (route, params) => {
    onClose();
    onNavigate(route, params);
  };

  const openMap = () =>
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`,
    );

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Photo + close button */}
          <View>
            <SafeImage uri={imageUrl(data)} style={styles.image} />
            <TouchableOpacity style={styles.close} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Info card overlapping the photo */}
          <View style={styles.sheet}>
            <Text style={styles.title}>{data.name || data.title}</Text>

            <View style={styles.chips}>
              {isDestination && !!data.province && (
                <Chip icon="location" text={data.province} />
              )}
              {isDestination && !!data.best_time && (
                <Chip icon="sunny-outline" text={`Best: ${data.best_time}`} />
              )}
              {isTour && data.duration_days != null && (
                <Chip icon="time-outline" text={`${data.duration_days} days`} />
              )}
              {isTour && data.max_people != null && (
                <Chip icon="people-outline" text={`Up to ${data.max_people}`} />
              )}
              {isActivity && !!data.category && (
                <Chip icon="pricetag-outline" text={data.category} />
              )}
              {isActivity && data.duration_hours != null && (
                <Chip
                  icon="time-outline"
                  text={`${data.duration_hours} hours`}
                />
              )}
            </View>

            <Text style={styles.h}>About</Text>
            <Text style={styles.text}>
              {data.description || "More details are coming soon."}
            </Text>

            {isDestination && tours.length > 0 && (
              <>
                <Text style={styles.h}>Tours here ({tours.length})</Text>
                {tours.slice(0, 3).map((tour) => (
                  <TouchableOpacity
                    key={tour.id}
                    style={styles.tourRow}
                    onPress={() => go("tour", { item: tour })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tourName} numberOfLines={1}>
                        {tour.name}
                      </Text>
                      {tour.duration_days != null && (
                        <Text style={styles.small}>
                          {tour.duration_days} days
                        </Text>
                      )}
                    </View>
                    <Text style={styles.price}>{money(tour.price)}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </ScrollView>

        {/* Sticky action bar (the only place with the main buttons) */}
        <View style={styles.bar}>
          {isDestination ? (
            <>
              {hasCoordinates && (
                <TouchableOpacity style={styles.iconBtn} onPress={openMap}>
                  <Ionicons
                    name="map-outline"
                    size={22}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => go("hotels", { destination: data.id })}
              >
                <Ionicons name="bed-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mainBtn}
                onPress={() => go("destination", { item: data })}
              >
                <Text style={styles.mainBtnText}>Explore this destination</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View>
                <Text style={styles.small}>From</Text>
                <Text style={styles.bigPrice}>
                  {money(data.price)}
                  <Text style={styles.small}> /person</Text>
                </Text>
              </View>
              <TouchableOpacity
                style={styles.mainBtn}
                onPress={() =>
                  go(isActivity ? "activity" : "tour", {
                    item: data,
                    book: true,
                  })
                }
              >
                <Text style={styles.mainBtnText}>
                  {isActivity ? "Book this activity" : "Book this tour"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", height: 300 },
  close: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    marginTop: -28,
    padding: 22,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: colors.primaryDark, fontSize: 12.5, fontWeight: "700" },
  h: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 22,
    marginBottom: 8,
  },
  text: { color: colors.muted, fontSize: 14.5, lineHeight: 23 },
  tourRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: colors.bg,
  },
  tourName: { color: colors.text, fontWeight: "700", fontSize: 14.5 },
  price: { color: colors.primary, fontWeight: "800" },
  small: { color: colors.muted, fontSize: 12.5, fontWeight: "500" },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bigPrice: { color: colors.primary, fontSize: 24, fontWeight: "800" },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  mainBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 240,
    marginLeft: "auto",
  },
  mainBtnText: { color: colors.white, fontWeight: "800", fontSize: 15 },
});
