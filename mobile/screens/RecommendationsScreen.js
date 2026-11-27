import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { imageUrl, postJson } from "../lib/api";
import { useApiList } from "../lib/hooks";
import { SafeImage } from "../components/cards";
import OptionSheet from "../components/OptionSheet";
import { colors, softShadow } from "../lib/theme";

const INTEREST_OPTIONS = ["Beach", "Nature", "Food & Culture", "Sightseeing"];
const STYLE_OPTIONS = ["Relaxing", "Adventure", "Cultural", "City exploration"];

// What the API says about the return journey (estimated_cost.return_basis)
const RETURN_LABELS = {
  return_route: "Round trip available",
  assumed_same_as_outbound: "Return fare estimated",
  return_unavailable: "No return transport",
  one_way_only: "One way only",
  not_needed: "No travel needed",
  unavailable: "No transport route yet",
};

/* ---------------------------- helpers (same as the website) ---------------------------- */

const formatUSD = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return "N/A";
  return `US$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDuration = (minutes) => {
  if (minutes == null || !Number.isFinite(Number(minutes))) return "N/A";
  const total = Math.round(Number(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

function getRouteLine(route) {
  const legs = route?.legs;
  if (!legs?.length) return null;
  return [legs[0].from_name, ...legs.map((leg) => leg.to_name)]
    .filter(Boolean)
    .join(" → ");
}

function getOutboundNote(cost) {
  if (cost.transportation_status === "not_needed")
    return "You are already here, so no travel is needed.";
  if (cost.transportation_status === "unavailable")
    return "No transport route from your starting location has been added yet.";
  return "Route details are not available.";
}

function getReturnNote(cost) {
  switch (cost.return_basis) {
    case "assumed_same_as_outbound":
      return "No return route is saved yet, so the return fare is estimated to match the outbound fare.";
    case "return_unavailable":
      return "No return route was found, so the round-trip cost is incomplete.";
    case "one_way_only":
      return "This estimate covers one way only.";
    case "not_needed":
      return "You are already here, so no travel is needed.";
    case "unavailable":
      return "No transport route has been added yet.";
    default:
      return "Return details are not available.";
  }
}

function getRoundTripSummary(cost) {
  if (cost.transportation_status === "not_needed") {
    return {
      cost: "No travel needed",
      costNote: null,
      time: "No travel needed",
      timeNote: null,
    };
  }

  const outbound = cost.outbound_cost;
  const outboundTime = cost.outbound_estimated_duration_minutes;
  const returnTime = cost.return_estimated_duration_minutes;

  let costText = "Not available";
  let costNote = null;
  if (cost.transportation != null) {
    costText = formatUSD(cost.transportation);
    if (cost.return_basis === "assumed_same_as_outbound")
      costNote = "The return fare is estimated to match the outbound fare.";
    else if (cost.return_basis === "one_way_only") costNote = "One way only.";
  } else if (outbound != null) {
    costText = `From ${formatUSD(outbound)}`;
    costNote = "Outbound only. No return fare is available yet.";
  }

  let timeText = "Not available";
  let timeNote = null;
  if (outboundTime != null && returnTime != null) {
    timeText = formatDuration(Number(outboundTime) + Number(returnTime));
  } else if (outboundTime != null) {
    timeText = `About ${formatDuration(outboundTime)} each way`;
    timeNote =
      cost.return_basis === "one_way_only"
        ? "One way only."
        : "The return journey time is not known yet.";
  }

  return { cost: costText, costNote, time: timeText, timeNote };
}

function budgetInfo(item) {
  if (item.within_budget === true)
    return ["Within budget", "#e8f7ee", "#146c43"];
  if (item.within_budget === false)
    return ["Over budget", "#fff0f0", colors.danger];
  return ["Budget unknown", "#fff3d6", "#92580a"];
}

/* ---------------------------- small UI pieces ---------------------------- */

function Section({ number, title, note, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionNum}>
          <Text style={styles.sectionNumText}>{number}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {!!note && <Text style={styles.muted}>{note}</Text>}
      {children}
    </View>
  );
}

function Chip({ label, active, onPress, icon }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipOn]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {active && (
        <Ionicons name={icon || "checkmark"} size={15} color={colors.white} />
      )}
      <Text style={[styles.chipText, active && { color: colors.white }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Stepper({ value, min, max, onChange, suffix }) {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepBtn}
        disabled={atMin}
        onPress={() => onChange(value - 1)}
      >
        <Ionicons
          name="remove"
          size={20}
          color={atMin ? "#c3c9cf" : colors.primary}
        />
      </TouchableOpacity>
      <Text style={styles.stepValue}>
        {value} {suffix(value)}
      </Text>
      <TouchableOpacity
        style={styles.stepBtn}
        disabled={atMax}
        onPress={() => onChange(value + 1)}
      >
        <Ionicons
          name="add"
          size={20}
          color={atMax ? "#c3c9cf" : colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

function SelectField({ label, value, placeholder, onPress, disabled }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.select, disabled && { opacity: 0.55 }]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text
          style={[styles.selectText, !value && { color: "#94a3a0" }]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </TouchableOpacity>
    </View>
  );
}

function RouteDetails({ title, route, emptyText }) {
  if (!route?.legs?.length) {
    return (
      <View style={styles.route}>
        <Text style={styles.routeTitle}>{title}</Text>
        <Text style={styles.muted}>{emptyText}</Text>
      </View>
    );
  }

  const minutes =
    route.total_estimated_duration_minutes ?? route.total_duration_minutes;
  const transfers = route.transfers ?? route.legs.length - 1;

  return (
    <View style={styles.route}>
      <Text style={styles.routeTitle}>{title}</Text>

      <View style={styles.pills}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            {transfers === 0
              ? "Direct"
              : `${transfers} ${transfers === 1 ? "transfer" : "transfers"}`}
          </Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            {minutes == null
              ? "Time not available"
              : `About ${formatDuration(minutes)}`}
          </Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{formatUSD(route.total_price)}</Text>
        </View>
      </View>

      {route.legs.map((leg, index) => (
        <View key={leg.id ?? index} style={styles.leg}>
          <View style={styles.legHead}>
            <Text style={styles.legName}>
              {leg.from_name} → {leg.to_name}
            </Text>
            <Text style={styles.legPrice}>{formatUSD(leg.price)}</Text>
          </View>
          <Text style={styles.muted}>
            {[
              leg.type || "Other",
              leg.provider || "Provider not listed",
              formatDuration(leg.duration_minutes),
            ].join(" · ")}
          </Text>
          {leg.estimated_wait_after_minutes > 0 && (
            <Text style={styles.wait}>
              Then about {formatDuration(leg.estimated_wait_after_minutes)} of
              waiting
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function RecommendationCard({ item, index, onOpen }) {
  const [showAllReasons, setShowAllReasons] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);

  const destination = item.destination || {};
  const cost = item.estimated_cost || {};
  const services = item.services || {};
  const [budgetLabel, budgetBg, budgetFg] = budgetInfo(item);

  const score = Math.max(0, Math.min(100, Number(item.score || 0)));
  const reasons = item.reasons || [];
  const visibleReasons = showAllReasons ? reasons : reasons.slice(0, 3);
  const routeLine = getRouteLine(cost.outbound_route);
  const trip = getRoundTripSummary(cost);

  const displayedCost =
    cost.base_total != null
      ? formatUSD(cost.base_total)
      : cost.known_cost != null
        ? `${formatUSD(cost.known_cost)}+`
        : "N/A";

  return (
    <View style={styles.card}>
      <View>
        <SafeImage uri={imageUrl(destination)} style={styles.cardImage} />
        <View style={styles.rank}>
          <Text style={styles.rankText}>
            {index === 0 ? "Best match" : `#${index + 1}`}
          </Text>
        </View>
        {item.is_preferred && (
          <View style={styles.preferred}>
            <Ionicons name="heart" size={12} color={colors.ink} />
            <Text style={styles.preferredText}>Your preferred destination</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.province}>
              {destination.province || "Cambodia"}
            </Text>
            <Text style={styles.cardTitle}>
              {destination.name || "Unknown destination"}
            </Text>
            {!!routeLine && <Text style={styles.routeLine}>{routeLine}</Text>}
          </View>
          <View style={styles.score}>
            <Text style={styles.scoreNum}>{score.toFixed(0)}%</Text>
            <Text style={styles.scoreLabel}>match</Text>
          </View>
        </View>

        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${score}%` }]} />
        </View>

        {!!destination.description && (
          <Text style={styles.desc} numberOfLines={3}>
            {destination.description}
          </Text>
        )}

        <View style={styles.costBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.muted}>Estimated trip cost</Text>
            <Text style={styles.costValue}>{displayedCost}</Text>
          </View>
          <View style={[styles.budgetPill, { backgroundColor: budgetBg }]}>
            <Text style={[styles.budgetText, { color: budgetFg }]}>
              {budgetLabel}
            </Text>
          </View>
        </View>

        <View style={styles.breakdown}>
          {[
            ["Hotel", formatUSD(cost.hotel)],
            ["Transport", formatUSD(cost.transportation)],
            ["Food", formatUSD(cost.food)],
            ["Travel time", formatDuration(item.travel?.total_minutes)],
          ].map(([label, value]) => (
            <View key={label} style={styles.breakTile}>
              <Text style={styles.breakLabel}>{label}</Text>
              <Text style={styles.breakValue}>{value}</Text>
            </View>
          ))}
        </View>

        {reasons.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.h4}>Why we recommend this place</Text>
            {visibleReasons.map((reason, i) => (
              <View key={`${i}-${reason}`} style={styles.reason}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.primary}
                  style={{ marginTop: 2 }}
                />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
            {reasons.length > 3 && (
              <TouchableOpacity
                onPress={() => setShowAllReasons((open) => !open)}
              >
                <Text style={styles.link}>
                  {showAllReasons
                    ? "Show fewer"
                    : `Show ${reasons.length - 3} more`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Outbound and return journeys */}
        <TouchableOpacity
          style={styles.journeyHead}
          onPress={() => setJourneyOpen((open) => !open)}
        >
          <Text style={styles.journeyTitle}>
            Journey details: outbound and return
          </Text>
          <Ionicons
            name={journeyOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.muted}
          />
        </TouchableOpacity>

        {journeyOpen && (
          <View style={{ gap: 12, marginTop: 4 }}>
            <RouteDetails
              title="Outbound journey"
              route={cost.outbound_route}
              emptyText={getOutboundNote(cost)}
            />
            <RouteDetails
              title="Return journey"
              route={cost.return_route}
              emptyText={getReturnNote(cost)}
            />
            <Text style={styles.muted}>
              Journey times include estimated waiting between connections. These
              are estimates, not timetables.
            </Text>

            <View style={styles.trip}>
              <Text style={styles.h4}>Round-trip summary</Text>
              <View style={styles.tripRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.muted}>Total transportation cost</Text>
                  <Text style={styles.tripValue}>{trip.cost}</Text>
                  {!!trip.costNote && (
                    <Text style={styles.small}>{trip.costNote}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.muted}>Total estimated journey time</Text>
                  <Text style={styles.tripValue}>{trip.time}</Text>
                  {!!trip.timeNote && (
                    <Text style={styles.small}>{trip.timeNote}</Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.services}>
          {[
            `${services.hotels ?? 0} hotels`,
            `${services.tours ?? 0} tours`,
            `${services.activities ?? 0} activities`,
            RETURN_LABELS[cost.return_basis] ?? "Transport unknown",
          ].map((label) => (
            <View key={label} style={styles.serviceChip}>
              <Text style={styles.serviceText}>{label}</Text>
            </View>
          ))}
        </View>

        {!!destination.id && (
          <TouchableOpacity
            style={styles.explore}
            onPress={() => onOpen(destination)}
          >
            <Text style={styles.exploreText}>Explore destination</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ---------------------------- screen ---------------------------- */

export default function RecommendationsScreen({ navigation }) {
  const destinations = useApiList("/destinations/");
  const active = useMemo(
    () => destinations.data.filter((d) => d.is_active !== false),
    [destinations.data],
  );

  const [form, setForm] = useState({
    startId: "",
    budget: "100",
    days: 3,
    interests: ["Beach"],
    style: "Relaxing",
    preferredId: "",
    roomSharing: 1,
    overBudget: false,
  });
  const [picker, setPicker] = useState(null); // "start" | "preferred"
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const scrollRef = useRef(null);
  const resultsY = useRef(0);

  const set = (patch) => setForm((previous) => ({ ...previous, ...patch }));
  const nameOf = (id) => active.find((d) => String(d.id) === String(id))?.name;

  const toggleInterest = (interest) =>
    set({
      interests: form.interests.includes(interest)
        ? form.interests.filter((item) => item !== interest)
        : [...form.interests, interest],
    });

  // Bring the results into view once they arrive
  useEffect(() => {
    if (!results) return;
    const timer = setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          y: Math.max(0, resultsY.current - 8),
          animated: true,
        }),
      150,
    );
    return () => clearTimeout(timer);
  }, [results]);

  const submit = async () => {
    setError("");
    const budget = Number(form.budget);

    if (!form.startId) return setError("Please choose your starting location.");
    if (!Number.isFinite(budget) || budget <= 0)
      return setError("Please enter a budget greater than 0.");
    if (form.interests.length === 0)
      return setError("Please select at least one travel interest.");

    setLoading(true);
    setResults(null);

    try {
      const data = await postJson("/recommendations/?limit=10", {
        starting_location_id: Number(form.startId),
        budget_per_person: budget,
        travel_days: form.days,
        interests: form.interests,
        travel_style: form.style,
        preferred_destination_id: form.preferredId
          ? Number(form.preferredId)
          : null,
        room_sharing: form.roomSharing,
        include_starting_location: false,
        include_over_budget: form.overBudget,
      });
      setResults(data);
    } catch (err) {
      setError(err.message || "Unable to get recommendations.");
    } finally {
      setLoading(false);
    }
  };

  const openDestination = (destination) =>
    navigation.navigate("Article", {
      type: "destinations",
      id: destination.id,
      item: destination,
    });

  const formDisabled = destinations.status !== "ready" || active.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Hero */}
        <LinearGradient colors={["#0b2321", "#0f766e"]} style={styles.hero}>
          <TouchableOpacity
            style={styles.back}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.eyebrow}>SMART TRAVEL PLANNER</Text>
          <Text style={styles.heroTitle}>Find your perfect destination</Text>
          <Text style={styles.heroText}>
            Tell us about your trip and TovNa will recommend places in Cambodia
            that fit your interests and budget.
          </Text>
          <TouchableOpacity
            style={styles.chatPill}
            onPress={() => navigation.navigate("AIAssistant")}
          >
            <Ionicons name="sparkles" size={15} color="#fcd34d" />
            <Text style={styles.chatPillText}>
              Prefer to chat? Ask TovNa AI
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.formWrap}>
          {destinations.status === "loading" && (
            <Text style={styles.muted}>Loading destinations…</Text>
          )}
          {destinations.status === "error" && (
            <View style={styles.alert}>
              <Text style={styles.alertText}>Unable to load destinations.</Text>
              <TouchableOpacity onPress={destinations.retry}>
                <Text style={styles.link}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}
          {destinations.status === "ready" && active.length === 0 && (
            <View style={styles.alert}>
              <Text style={styles.alertText}>
                No active destinations are available yet.
              </Text>
            </View>
          )}

          <Section number={1} title="Your trip">
            <SelectField
              label="Starting location"
              value={nameOf(form.startId)}
              placeholder="Choose your starting location"
              onPress={() => setPicker("start")}
              disabled={formDisabled}
            />

            <Text style={[styles.label, { marginTop: 14 }]}>
              Budget per person
            </Text>
            <View style={styles.money}>
              <Text style={styles.moneySign}>$</Text>
              <TextInput
                style={styles.moneyInput}
                value={form.budget}
                onChangeText={(text) =>
                  set({ budget: text.replace(/[^0-9.]/g, "") })
                }
                keyboardType="decimal-pad"
                placeholder="100"
                placeholderTextColor="#94a3a0"
              />
              <Text style={styles.muted}>USD</Text>
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>
              Travel duration
            </Text>
            <Stepper
              value={form.days}
              min={1}
              max={30}
              onChange={(days) => set({ days })}
              suffix={(n) => (n === 1 ? "day" : "days")}
            />

            <Text style={[styles.label, { marginTop: 14 }]}>Room sharing</Text>
            <Stepper
              value={form.roomSharing}
              min={1}
              max={4}
              onChange={(roomSharing) => set({ roomSharing })}
              suffix={(n) => (n === 1 ? "person per room" : "people per room")}
            />
          </Section>

          <Section number={2} title="Your travel style">
            <View style={styles.chips}>
              {STYLE_OPTIONS.map((style) => (
                <Chip
                  key={style}
                  label={style}
                  active={form.style === style}
                  onPress={() => set({ style })}
                />
              ))}
            </View>
          </Section>

          <Section
            number={3}
            title="What are you interested in?"
            note="Select one or more interests."
          >
            <View style={styles.chips}>
              {INTEREST_OPTIONS.map((interest) => (
                <Chip
                  key={interest}
                  label={interest}
                  active={form.interests.includes(interest)}
                  onPress={() => toggleInterest(interest)}
                />
              ))}
            </View>
          </Section>

          <Section number={4} title="Anything else? (optional)">
            <SelectField
              label="Preferred destination"
              value={nameOf(form.preferredId)}
              placeholder="No preference"
              onPress={() => setPicker("preferred")}
              disabled={formDisabled}
            />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                Include destinations that may exceed my budget
              </Text>
              <Switch
                value={form.overBudget}
                onValueChange={(overBudget) => set({ overBudget })}
                trackColor={{ true: colors.primary, false: "#d8dfdc" }}
              />
            </View>
          </Section>

          {!!error && (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submit,
              (loading || formDisabled) && { opacity: 0.6 },
            ]}
            onPress={submit}
            disabled={loading || formDisabled}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitText}>Find my recommendations</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {loading && (
          <View style={styles.resultsWrap}>
            {[0, 1].map((key) => (
              <View key={key} style={styles.skeleton} />
            ))}
          </View>
        )}

        {results && (
          <View
            style={styles.resultsWrap}
            onLayout={(event) =>
              (resultsY.current = event.nativeEvent.layout.y)
            }
          >
            <Text style={styles.resultsTitle}>Recommended destinations</Text>
            <View style={styles.chips}>
              {[
                `From ${results.starting_location?.name || "your location"}`,
                `${results.travel_days} days`,
                `${formatUSD(results.budget_per_person)} per person`,
                `${results.total_candidates ?? 0} matches`,
              ].map((label) => (
                <View key={label} style={styles.summaryChip}>
                  <Text style={styles.summaryText}>{label}</Text>
                </View>
              ))}
            </View>

            {results.recommendations?.length > 0 ? (
              <View style={{ gap: 16, marginTop: 16 }}>
                {results.recommendations.map((item, index) => (
                  <RecommendationCard
                    key={item.destination?.id ?? index}
                    item={item}
                    index={index}
                    onOpen={openDestination}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons
                  name="search-outline"
                  size={36}
                  color={colors.muted}
                />
                <Text style={styles.emptyTitle}>No destinations matched</Text>
                <Text style={styles.emptyText}>
                  Try raising your budget, changing your travel style, or
                  choosing more interests.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {picker === "start" && (
        <OptionSheet
          title="Starting location"
          options={active.map((d) => ({
            id: d.id,
            name: d.name,
            subtitle: d.province,
          }))}
          value={form.startId}
          onSelect={(startId) => set({ startId })}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === "preferred" && (
        <OptionSheet
          title="Preferred destination"
          options={[
            { id: "", name: "No preference" },
            ...active.map((d) => ({
              id: d.id,
              name: d.name,
              subtitle: d.province,
            })),
          ]}
          value={form.preferredId}
          onSelect={(preferredId) => set({ preferredId })}
          onClose={() => setPicker(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  muted: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  small: { color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  link: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 13.5,
    marginTop: 6,
  },
  h4: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 8 },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  eyebrow: {
    color: "#fcd34d",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginTop: 8,
  },
  heroText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  chatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  chatPillText: { color: colors.white, fontWeight: "700", fontSize: 13 },

  formWrap: { padding: 20, marginTop: -20, gap: 16 },
  section: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 18,
    ...softShadow,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sectionNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionNumText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.bg,
  },
  selectText: {
    flex: 1,
    color: colors.text,
    fontSize: 15.5,
    fontWeight: "600",
  },
  money: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.bg,
  },
  moneySign: { color: colors.muted, fontSize: 18, fontWeight: "700" },
  moneyInput: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    height: "100%",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.bg,
  },
  stepBtn: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { color: colors.text, fontSize: 15.5, fontWeight: "800" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13.5, fontWeight: "700" },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  toggleText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },

  alert: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff7e0",
    borderWidth: 1,
    borderColor: "#f5d58a",
  },
  alertText: { color: "#7a5200", fontSize: 13.5 },
  error: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff0f0",
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13.5, lineHeight: 19 },
  submit: {
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: colors.white, fontSize: 16, fontWeight: "800" },

  resultsWrap: { paddingHorizontal: 20, paddingTop: 8 },
  resultsTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  summaryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  summaryText: { color: colors.primaryDark, fontSize: 12.5, fontWeight: "700" },
  skeleton: {
    height: 260,
    borderRadius: 24,
    backgroundColor: "#e3ebe8",
    marginBottom: 16,
  },
  empty: { alignItems: "center", gap: 8, padding: 30 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  emptyText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 26,
    overflow: "hidden",
    ...softShadow,
  },
  cardImage: { width: "100%", height: 170 },
  rank: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  rankText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  preferred: {
    position: "absolute",
    bottom: 12,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  preferredText: { color: colors.ink, fontSize: 11.5, fontWeight: "700" },
  cardBody: { padding: 16 },
  cardHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  province: {
    color: colors.primary,
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  routeLine: { color: colors.muted, fontSize: 12.5, marginTop: 4 },
  score: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
  },
  scoreNum: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  scoreLabel: { color: colors.primaryDark, fontSize: 10.5, fontWeight: "700" },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#eef2f1",
    marginTop: 12,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  desc: { color: colors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 12 },

  costBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.bg,
  },
  costValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  budgetPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  budgetText: { fontSize: 12, fontWeight: "800" },
  breakdown: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  breakTile: {
    width: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  breakLabel: { color: colors.muted, fontSize: 11.5 },
  breakValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },

  reason: { flexDirection: "row", gap: 8, marginBottom: 6 },
  reasonText: { flex: 1, color: colors.muted, fontSize: 13.5, lineHeight: 20 },

  journeyHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f4",
  },
  journeyTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "800",
    flex: 1,
  },
  route: { padding: 14, borderRadius: 18, backgroundColor: colors.bg },
  routeTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "800",
    marginBottom: 8,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  pill: {
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  leg: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#e8eeec" },
  legHead: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  legName: { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: "700" },
  legPrice: { color: colors.primary, fontSize: 13.5, fontWeight: "800" },
  wait: { color: "#92580a", fontSize: 12, marginTop: 3 },
  trip: { padding: 14, borderRadius: 18, backgroundColor: colors.primarySoft },
  tripRow: { flexDirection: "row", gap: 12 },
  tripValue: {
    color: colors.primaryDark,
    fontSize: 15.5,
    fontWeight: "800",
    marginTop: 2,
  },

  services: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  serviceChip: {
    borderRadius: 999,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  serviceText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  explore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  exploreText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});
