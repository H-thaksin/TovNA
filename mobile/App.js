import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./lib/auth";
import RootNavigator from "./navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
