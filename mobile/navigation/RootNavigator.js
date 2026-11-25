import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../lib/auth";
import { colors } from "../lib/theme";
import BottomTabs from "../components/BottomTabs";
import HomeScreen from "../screens/HomeScreen";
import AuthScreen from "../screens/AuthScreen";
import BookingsScreen from "../screens/BookingsScreen";
import BookingFormScreen from "../screens/BookingFormScreen";
import BookingDetailsScreen from "../screens/BookingDetailsScreen";
import HotelsScreen from "../screens/HotelsScreen";
import HotelDetailsScreen from "../screens/HotelDetailsScreen";
import HotelBookingFormScreen from "../screens/HotelBookingFormScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ExploreScreen from "../screens/ExploreScreen";
import ComingSoonScreen from "../screens/ComingSoonScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TABS = {
  home: "Home",
  explore: "Explore",
  bookings: "Bookings",
  profile: "Profile",
};
const AUTH = { login: "Login", signup: "Signup" };
// A single item -> detail page (the real page comes in a later step)
const DETAIL = {
  destination: "destinations",
  tour: "tours",
  activity: "activities",
};

// Maps the route names used by the screens to real screens.
// Screens we haven't built yet open the "coming soon" page.
export function appNavigate(navigation, route, params = {}) {
  const exploreCategories = ["destinations", "tours", "activities"];

  // "See all" buttons and category icons -> Explore tab with that category
  if (exploreCategories.includes(route)) {
    return navigation.navigate("Tabs", {
      screen: "Explore",
      params: { category: route, q: "", stamp: Date.now() },
    });
  }

  // Home search -> Explore with the typed text
  if (route === "articles") {
    return navigation.navigate("Tabs", {
      screen: "Explore",
      params: {
        category: "destinations",
        q: params.q ?? "",
        stamp: Date.now(),
      },
    });
  }
  if (route === "hotels") {
    return navigation.navigate("Hotels", {
      destination: params.destination,
    });
  }

  if (TABS[route]) return navigation.navigate("Tabs", { screen: TABS[route] });
  if (AUTH[route]) return navigation.navigate(AUTH[route]);

  if (DETAIL[route] && params.item) {
    // Open the booking form when the user presses Book.
    if (params.book && (route === "tour" || route === "activity")) {
      return navigation.navigate("BookingForm", {
        kind: route,
        item: params.item,
      });
    }

    // Keep the existing detail-page behavior for now.
    return navigation.navigate("Article", {
      type: DETAIL[route],
      id: params.item.id,
      item: params.item,
      book: !!params.book,
    });
  }

  navigation.navigate("ComingSoon", { route, params });
}

function HomeTab({ navigation }) {
  const { user } = useAuth();
  return (
    <HomeScreen
      user={user}
      onNavigate={(route, params) => appNavigate(navigation, route, params)}
    />
  );
}

function ExploreTab({ navigation, route }) {
  return (
    <ExploreScreen
      initialCategory={route.params?.category}
      initialQuery={route.params?.q}
      syncKey={route.params?.stamp}
      onNavigate={(next, params) => appNavigate(navigation, next, params)}
    />
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabs {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="Explore" component={ExploreTab} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    primary: colors.primary,
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
        <Stack.Screen name="BookingForm" component={BookingFormScreen} />
        <Stack.Screen name="Hotels" component={HotelsScreen} />
        <Stack.Screen name="HotelDetails" component={HotelDetailsScreen} />

        <Stack.Screen
          name="HotelBookingForm"
          component={HotelBookingFormScreen}
        />

        {/* Placeholder until the real destination / tour / activity page is built */}
        <Stack.Screen name="Article" component={ComingSoonScreen} />
        <Stack.Screen
          name="Login"
          component={AuthScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="Signup"
          component={AuthScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
