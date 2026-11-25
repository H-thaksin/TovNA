import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { imageUrl } from "../lib/api";
import { colors } from "../lib/theme";
import {
  STATUS_TONE,
  TYPE_EMOJI,
  titleCase,
  transportEmoji,
} from "../lib/bookings";
import { SafeImage } from "./cards";

export function StatusPill({ status }) {
  const key = String(status || "pending").toLowerCase();
  const tone = STATUS_TONE[key] ?? STATUS_TONE.pending;
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>
        {titleCase(status)}
      </Text>
    </View>
  );
}

export function CopyButton({ text, light }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable: nothing to do */
    }
  };

  return (
    <TouchableOpacity
      onPress={copy}
      style={[styles.copy, light && styles.copyLight]}
      hitSlop={8}
    >
      <Text style={[styles.copyText, light && { color: colors.white }]}>
        {copied ? "Copied ✓" : "Copy"}
      </Text>
    </TouchableOpacity>
  );
}

// Photo for hotels / tours / activities, an icon tile for transport
export function TypeTile({ booking, size = 64 }) {
  const box = {
    width: size,
    height: size,
    borderRadius: size * 0.28,
    overflow: "hidden",
  };

  if (booking.isTransportation) {
    return (
      <LinearGradient
        colors={["#0f766e", "#134e4a"]}
        style={[box, styles.tile]}
      >
        <Text style={{ fontSize: size * 0.48 }}>
          {transportEmoji(booking.transportKind)}
        </Text>
      </LinearGradient>
    );
  }
  return (
    <SafeImage
      uri={imageUrl({ image_url: booking.image })}
      style={box}
      emoji={TYPE_EMOJI[booking.bookingType]}
    />
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  pillText: { fontSize: 11.5, fontWeight: "800" },
  copy: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  copyLight: { borderColor: "rgba(255,255,255,0.5)" },
  copyText: { color: colors.primary, fontSize: 11.5, fontWeight: "800" },
  tile: { alignItems: "center", justifyContent: "center" },
});
