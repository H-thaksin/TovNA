import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";

const TABS = {
  Home: { label: "Home", icon: "home" },
  Explore: { label: "Explore", icon: "compass" },
  Bookings: { label: "Bookings", icon: "calendar" },
  Profile: { label: "Profile", icon: "person" },
};

// Custom tab bar for React Navigation
export default function BottomTabs({ state, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { label, icon } = TABS[route.name];

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented)
            navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={onPress}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapOn]}>
              <Ionicons
                name={focused ? icon : `${icon}-outline`}
                size={22}
                color={focused ? colors.white : colors.muted}
              />
            </View>
            <Text style={[styles.label, focused && styles.labelOn]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    paddingTop: 8,
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: "#0e1b1a",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  iconWrap: {
    width: 46,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapOn: { backgroundColor: colors.primary },
  label: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  labelOn: { color: colors.primary, fontWeight: "800" },
});
