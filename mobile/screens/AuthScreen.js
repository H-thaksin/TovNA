import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { PrimaryButton } from "../components/ui";
import { colors } from "../lib/theme";

function Field({ label, icon, secure, ...props }) {
  const [hidden, setHidden] = useState(!!secure);
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Ionicons
          name={icon}
          size={20}
          color={focused ? colors.primary : colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholderTextColor="#94a3a0"
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {secure && (
          <TouchableOpacity onPress={() => setHidden((v) => !v)} hitSlop={10}>
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={colors.muted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// One screen for both Login and Signup (the route name decides)
export default function AuthScreen({ route, navigation }) {
  const isSignup = route.name === "Signup";
  const { login, register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Tabs");

  const submit = async () => {
    setError("");

    // Same rules as the backend
    if (isSignup && !name.trim())
      return setError("Please enter your full name.");
    if (!email.includes("@"))
      return setError("Please provide a valid email address.");
    if (!password) return setError("Please enter your password.");
    if (isSignup && password.length < 8)
      return setError("Password must contain at least 8 characters.");

    setSubmitting(true);
    try {
      if (isSignup) await register({ name, email, password });
      else await login(email, password);
      close();
    } catch (err) {
      console.warn("Auth error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.close} onPress={close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>

          <LinearGradient colors={["#0f766e", "#0b2321"]} style={styles.mark}>
            <Text style={styles.markText}>T</Text>
          </LinearGradient>

          <Text style={styles.title}>
            {isSignup ? "Create your account" : "Welcome back"}
          </Text>
          <Text style={styles.subtitle}>
            {isSignup
              ? "Start planning your Cambodia trip."
              : "Log in to continue planning."}
          </Text>

          {!!error && (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isSignup && (
            <Field
              label="Full name"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              placeholder="Sok Dara"
            />
          )}
          <Field
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            icon="lock-closed-outline"
            secure
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            onSubmitEditing={submit}
          />

          <PrimaryButton
            label={isSignup ? "Create account" : "Log in"}
            onPress={submit}
            loading={submitting}
            style={{ marginTop: 6 }}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isSignup ? "Already have an account?" : "New to TovNa?"}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.replace(isSignup ? "Login" : "Signup")}
            >
              <Text style={styles.switchLink}>
                {isSignup ? "Log in" : "Create account"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: 24, paddingTop: 12, paddingBottom: 40 },
  close: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  markText: { color: "#fcd34d", fontSize: 30, fontWeight: "800" },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
    marginTop: 22,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 6,
    marginBottom: 26,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.white },
  input: { flex: 1, fontSize: 15.5, color: colors.text, height: "100%" },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff0f0",
    marginBottom: 18,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13.5, lineHeight: 19 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
  },
  switchText: { color: colors.muted, fontSize: 14 },
  switchLink: { color: colors.primary, fontWeight: "800", fontSize: 14 },
});
