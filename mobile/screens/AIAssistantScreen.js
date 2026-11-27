import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { getToken, imageUrl, postJsonAuth } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApiList } from "../lib/hooks";
import { SafeImage } from "../components/cards";
import { PrimaryButton } from "../components/ui";
import { colors, softShadow } from "../lib/theme";

const INITIAL_MESSAGE = {
  role: "assistant",
  content:
    "Hello! I'm TovNa's AI Travel Assistant. I can help you discover destinations in Cambodia and plan a trip that matches your budget and interests. Where would you like to start?",
};

const SUGGESTIONS = [
  "Plan a 3-day beach trip from Phnom Penh",
  "Cheap nature getaways near Phnom Penh",
  "When is the best time to visit Koh Rong?",
  "What should I pack for the islands?",
];

// The backend accepts at most 20 history items of 2000 characters each,
// and only reads the last 10, so we never send more than that.
const MAX_HISTORY = 10;
const MAX_CONTENT = 2000;
const PREFERENCE_KEYS = [
  "starting_location_id",
  "budget_per_person",
  "travel_days",
  "interests",
  "travel_style",
];

/* ---------------------------- text rendering ---------------------------- */

function renderInline(text, color) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={index} style={{ fontWeight: "800", color }}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    ),
  );
}

// Turns plain assistant text into paragraphs and bullet lists.
// Also splits inline " - Name: ..." runs into separate bullets.
function RichText({ text, color }) {
  const normalized = String(text || "").replace(
    /\s+-\s+(?=[A-Z][^:\n]{1,40}:)/g,
    "\n- ",
  );

  const blocks = [];
  let list = [];
  const flush = () => {
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  };

  normalized.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) flush();
    else if (/^[-*•]\s+/.test(trimmed))
      list.push(trimmed.replace(/^[-*•]\s+/, ""));
    else {
      flush();
      blocks.push({ type: "text", value: trimmed });
    }
  });
  flush();

  return (
    <View style={{ gap: 8 }}>
      {blocks.map((block, index) =>
        block.type === "list" ? (
          <View key={index} style={{ gap: 4 }}>
            {block.items.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bullet, { color }]}>•</Text>
                <Text style={[styles.msgText, { color, flex: 1 }]}>
                  {renderInline(item, color)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text key={index} style={[styles.msgText, { color }]}>
            {renderInline(block.value, color)}
          </Text>
        ),
      )}
    </View>
  );
}

/* ---------------------------- small pieces ---------------------------- */

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 320,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.typing}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}

function Avatar({ small }) {
  const size = small ? 30 : 44;
  return (
    <LinearGradient
      colors={["#0f766e", "#0b2321"]}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.4,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="sparkles" size={small ? 15 : 22} color="#fcd34d" />
    </LinearGradient>
  );
}

function RecommendationCard({ destination, rank, budget, onOpen }) {
  const score = Number(destination.score);
  const hasScore = Number.isFinite(score);
  const cost = Number(destination.estimated_total);
  const hasCost = destination.estimated_total != null && Number.isFinite(cost);
  const known = Number(destination.known_cost);
  const hasKnown =
    !hasCost && destination.known_cost != null && Number.isFinite(known);
  const currency = destination.currency || "USD";
  const reasons = destination.reasons || [];

  const overBy = hasCost && budget && cost > budget ? cost - budget : null;
  const flaggedOver =
    overBy != null ||
    destination.within_budget === false ||
    reasons.some((r) => /above your budget/i.test(r));

  return (
    <TouchableOpacity
      style={styles.rec}
      activeOpacity={0.9}
      onPress={() => onOpen(destination)}
    >
      <View>
        <SafeImage uri={imageUrl(destination)} style={styles.recImage} />
        <View style={styles.recRank}>
          <Text style={styles.recRankText}>#{rank}</Text>
        </View>
      </View>

      <View style={styles.recBody}>
        <View style={styles.recTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recName} numberOfLines={1}>
              {destination.name}
            </Text>
            {!!destination.province && (
              <Text style={styles.recProvince}>{destination.province}</Text>
            )}
          </View>
          {hasScore && (
            <View style={styles.recScore}>
              <Text style={styles.recScoreText}>{score.toFixed(0)}</Text>
            </View>
          )}
        </View>

        {hasCost && (
          <View
            style={[
              styles.recCost,
              { backgroundColor: flaggedOver ? "#fff0f0" : "#e8f7ee" },
            ]}
          >
            <Text
              style={[
                styles.recCostValue,
                { color: flaggedOver ? colors.danger : "#146c43" },
              ]}
            >
              {currency} {cost.toLocaleString()}
            </Text>
            <Text
              style={[
                styles.recCostNote,
                { color: flaggedOver ? colors.danger : "#146c43" },
              ]}
            >
              {overBy != null
                ? `${currency} ${overBy.toLocaleString()} over budget`
                : flaggedOver
                  ? "Over budget"
                  : "per person"}
            </Text>
          </View>
        )}
        {hasKnown && (
          <View style={[styles.recCost, { backgroundColor: "#fff3d6" }]}>
            <Text style={[styles.recCostValue, { color: "#92580a" }]}>
              {currency} {known.toLocaleString()}+
            </Text>
            <Text style={[styles.recCostNote, { color: "#92580a" }]}>
              estimate incomplete
            </Text>
          </View>
        )}

        {reasons.slice(0, 3).map((reason, i) => (
          <View key={i} style={styles.recReason}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={colors.primary}
              style={{ marginTop: 2 }}
            />
            <Text style={styles.recReasonText}>{reason}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

/* ---------------------------- screen ---------------------------- */

export default function AIAssistantScreen({ navigation }) {
  const { user, authReady, logout } = useAuth();
  const destinations = useApiList("/destinations/");

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef(null);
  const abortRef = useRef(null);

  // Cancel any request in flight when leaving the screen
  useEffect(() => () => abortRef.current?.abort(), []);

  const names = useMemo(
    () => Object.fromEntries(destinations.data.map((d) => [d.id, d.name])),
    [destinations.data],
  );

  const budget =
    Number(prefs.budget_per_person) > 0
      ? Number(prefs.budget_per_person)
      : null;

  // "Your trip so far" chips (the website shows "Starting location id: 5"; here it is the name)
  const summary = useMemo(() => {
    const items = [];
    if (prefs.starting_location_id)
      items.push([
        "location-outline",
        `From ${names[prefs.starting_location_id] || "your location"}`,
      ]);
    if (prefs.budget_per_person)
      items.push(["cash-outline", `USD ${prefs.budget_per_person} / person`]);
    if (prefs.travel_days)
      items.push([
        "calendar-outline",
        `${prefs.travel_days} ${Number(prefs.travel_days) === 1 ? "day" : "days"}`,
      ]);
    if (prefs.interests?.length)
      items.push(["heart-outline", prefs.interests.join(", ")]);
    if (prefs.travel_style)
      items.push(["sparkles-outline", prefs.travel_style]);
    return items;
  }, [prefs, names]);

  const send = useCallback(
    async (raw) => {
      const text = raw.trim();
      if (!text || loading) return;

      if (!user) {
        navigation.navigate("Login");
        return;
      }

      const token = await getToken();
      if (!token) {
        setError("Your session has expired. Please log in again.");
        await logout();
        navigation.navigate("Login");
        return;
      }

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-MAX_HISTORY)
        .map(({ role, content }) => ({
          role,
          content: String(content).slice(0, MAX_CONTENT),
        }));

      const tripPreferences = Object.fromEntries(
        PREFERENCE_KEYS.filter((key) => prefs[key] != null).map((key) => [
          key,
          prefs[key],
        ]),
      );

      setMessages((previous) => [...previous, { role: "user", content: text }]);
      setInput("");
      setError("");
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await postJsonAuth(
          "/ai-assistant/chat",
          { message: text, history, trip_preferences: tripPreferences },
          token,
          controller.signal,
        );

        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content: data.reply || "I'm sorry, I couldn't generate a response.",
            recommendations: data.recommendations || [],
            generalTips: data.general_tips || [],
            destinations: data.destinations || [],
            truncated: !!data.truncated,
          },
        ]);

        if (data.trip_preferences) setPrefs(data.trip_preferences);
      } catch (err) {
        if (err.name === "AbortError") return;

        // Take the unsent message back so it can be edited and sent again
        setMessages((previous) => previous.slice(0, -1));
        setInput(text);

        if (err.status === 401) {
          await logout();
          setError("Your session has expired. Please log in again.");
          navigation.navigate("Login");
        } else {
          setError(
            err.message ||
              "Unable to contact the AI Assistant. Please try again.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, navigation, logout, prefs, user],
  );

  const reset = () => {
    abortRef.current?.abort();
    setMessages([INITIAL_MESSAGE]);
    setPrefs({});
    setInput("");
    setError("");
    setLoading(false);
  };

  const openDestination = (destination) =>
    navigation.navigate("Article", {
      type: "destinations",
      id: destination.id,
      item: destination,
    });

  const isFresh = messages.length === 1;
  const hasConversation = messages.length > 1 || summary.length > 0;

  /* ---------- header ---------- */
  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.round}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Avatar />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>TovNa AI Assistant</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.sub}>Online · Cambodia travel planner</Text>
        </View>
      </View>
      {user && hasConversation && (
        <TouchableOpacity style={styles.round} onPress={reset}>
          <Ionicons name="refresh-outline" size={21} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (!authReady) {
    return (
      <SafeAreaView style={styles.safe}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  /* ---------- login gate ---------- */
  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        {header}
        <ScrollView contentContainerStyle={styles.gate}>
          <Avatar />
          <Text style={styles.gateTitle}>
            Plan your Cambodia trip in a chat
          </Text>
          <Text style={styles.gateText}>
            Log in to get destination matches based on your budget, trip length
            and interests.
          </Text>
          {[
            "Compare destinations by cost and match score",
            "Get tips for transport, timing and packing",
            "Refine your plan as your preferences change",
          ].map((line) => (
            <View key={line} style={styles.gateRow}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.gateLine}>{line}</Text>
            </View>
          ))}
          <PrimaryButton
            label="Log in to continue"
            onPress={() => navigation.navigate("Login")}
            style={{ alignSelf: "stretch", marginTop: 18 }}
          />
          <PrimaryButton
            label="Or use the trip planner"
            outline
            onPress={() => navigation.navigate("Recommendations")}
            style={{ alignSelf: "stretch", marginTop: 10 }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ---------- chat ---------- */
  return (
    <SafeAreaView style={styles.safe}>
      {header}

      {summary.length > 0 && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.summary}
          >
            {summary.map(([icon, label]) => (
              <View key={label} style={styles.summaryChip}>
                <Ionicons name={icon} size={14} color={colors.primary} />
                <Text style={styles.summaryText}>{label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={listRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((item, index) => {
            const mine = item.role === "user";
            return (
              <View
                key={`${item.role}-${index}`}
                style={[styles.msgRow, mine && { justifyContent: "flex-end" }]}
              >
                {!mine && <Avatar small />}
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleBot,
                  ]}
                >
                  <RichText
                    text={item.content}
                    color={mine ? colors.white : colors.text}
                  />

                  {item.truncated && (
                    <Text style={styles.truncated}>
                      This reply was cut short. Ask me to continue if you need
                      more.
                    </Text>
                  )}

                  {item.recommendations?.length > 0 && (
                    <View style={{ marginTop: 12, gap: 10 }}>
                      <Text style={styles.blockTitle}>
                        Recommended destinations
                      </Text>
                      {item.recommendations.map((destination, i) => (
                        <RecommendationCard
                          key={destination.id ?? `${destination.name}-${i}`}
                          destination={destination}
                          rank={i + 1}
                          budget={budget}
                          onOpen={openDestination}
                        />
                      ))}
                    </View>
                  )}

                  {item.destinations?.length > 0 &&
                    !item.recommendations?.length && (
                      <View style={styles.mentioned}>
                        {item.destinations.map((d) => (
                          <TouchableOpacity
                            key={d.id}
                            style={styles.mentionChip}
                            onPress={() => openDestination(d)}
                          >
                            <Ionicons
                              name="location"
                              size={13}
                              color={colors.primary}
                            />
                            <Text style={styles.mentionText}>{d.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                  {item.generalTips?.length > 0 && (
                    <View style={styles.tips}>
                      <Text style={styles.blockTitle}>Travel tips</Text>
                      {item.generalTips.map((tip, i) => (
                        <View key={i} style={styles.bulletRow}>
                          <Text style={[styles.bullet, { color: "#92580a" }]}>
                            •
                          </Text>
                          <Text
                            style={[
                              styles.msgText,
                              { color: "#7a5200", flex: 1 },
                            ]}
                          >
                            {tip}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {isFresh && !loading && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestTitle}>Try asking</Text>
              {SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggest}
                  onPress={() => send(suggestion)}
                >
                  <Text style={styles.suggestText}>{suggestion}</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.plannerLink}
                onPress={() => navigation.navigate("Recommendations")}
              >
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.plannerText}>
                  Prefer a form? Open the trip planner
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {loading && (
            <View style={styles.msgRow}>
              <Avatar small />
              <View style={[styles.bubble, styles.bubbleBot]}>
                <TypingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {!!error && (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={17} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about destinations, budget or trip length…"
            placeholderTextColor="#94a3a0"
            multiline
            maxLength={2000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[
              styles.send,
              (!input.trim() || loading) && { opacity: 0.45 },
            ]}
            disabled={!input.trim() || loading}
            onPress={() => send(input)}
          >
            <Ionicons name="arrow-up" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.disclaimer}>
          TovNa AI can make mistakes. Check prices and travel details before you
          book.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 16.5, fontWeight: "800" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  sub: { color: colors.muted, fontSize: 11.5 },

  summary: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  summaryText: { color: colors.primaryDark, fontSize: 12.5, fontWeight: "700" },

  messages: { padding: 16, gap: 14, paddingBottom: 8 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubble: { maxWidth: "86%", borderRadius: 20, padding: 14 },
  bubbleBot: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 6,
    ...softShadow,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  msgText: { fontSize: 14.5, lineHeight: 22 },
  bulletRow: { flexDirection: "row", gap: 8 },
  bullet: { fontSize: 14.5, lineHeight: 22, fontWeight: "800" },
  truncated: { color: "#92580a", fontSize: 12, marginTop: 8 },
  blockTitle: { color: colors.text, fontSize: 13.5, fontWeight: "800" },

  typing: {
    flexDirection: "row",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  rec: {
    flexDirection: "row",
    gap: 10,
    padding: 8,
    borderRadius: 18,
    backgroundColor: colors.bg,
  },
  recImage: { width: 84, height: 100, borderRadius: 13, overflow: "hidden" },
  recRank: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recRankText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  recBody: { flex: 1, gap: 6 },
  recTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  recName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  recProvince: { color: colors.muted, fontSize: 12 },
  recScore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  recScoreText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  recCost: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  recCostValue: { fontSize: 13.5, fontWeight: "800" },
  recCostNote: { fontSize: 11 },
  recReason: { flexDirection: "row", gap: 5 },
  recReasonText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },

  mentioned: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  mentionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mentionText: { color: colors.primaryDark, fontSize: 12.5, fontWeight: "700" },
  tips: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff7e0",
    gap: 6,
  },

  suggestions: { marginTop: 4, gap: 8 },
  suggestTitle: {
    color: colors.muted,
    fontSize: 12.5,
    fontWeight: "700",
    marginLeft: 4,
  },
  suggest: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  plannerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 6,
  },
  plannerText: { color: colors.primary, fontWeight: "800", fontSize: 13.5 },

  error: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fff0f0",
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18 },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  gate: { alignItems: "center", padding: 28, gap: 12 },
  gateTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    marginTop: 8,
  },
  gateText: {
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: "center",
  },
  gateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
  },
  gateLine: { flex: 1, color: colors.text, fontSize: 14 },
});
