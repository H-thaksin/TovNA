import { TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, PrimaryButton } from "../components/ui";
import { colors } from "../lib/theme";

const TITLES = {
  articles: "Explore",
  destinations: "Destinations",
  destination: "Destination",
  tours: "Tours",
  tour: "Tour",
  activities: "Activities",
  activity: "Activity",
  hotels: "Hotels",
  transportation: "Transportation",
  payments: "My payments",
  notifications: "Notifications",
  explore: "Explore",
  Explore: "Explore",
};

// Placeholder for screens we build in the next steps
export default function ComingSoonScreen({ route, navigation }) {
  const key = route.params?.route ?? route.name;
  const title = TITLES[key] ?? key;
  const canGoBack = route.name === "ComingSoon" && navigation.canGoBack();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      {canGoBack && (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            margin: 16,
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
      )}
      <EmptyState
        icon="construct-outline"
        title={`${title} is coming soon`}
        text="We are building this screen in an upcoming step."
      >
        {canGoBack && (
          <PrimaryButton label="Go back" onPress={() => navigation.goBack()} />
        )}
      </EmptyState>
    </SafeAreaView>
  );
}
