import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";

// Bottom sheet for choosing ONE option.  options: [{ id, name, subtitle? }]
export default function OptionSheet({
  title,
  options,
  value,
  onSelect,
  onClose,
}) {
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.wrap}>
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={options}
          keyExtractor={(option) => String(option.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const selected = String(item.id) === String(value);
            return (
              <TouchableOpacity
                style={[styles.row, selected && styles.rowOn]}
                onPress={() => {
                  onSelect(String(item.id));
                  onClose();
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.name,
                      selected && { color: colors.primaryDark },
                    ]}
                  >
                    {item.name}
                  </Text>
                  {!!item.subtitle && (
                    <Text style={styles.sub}>{item.subtitle}</Text>
                  )}
                </View>
                {selected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.white },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 10,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f4",
  },
  rowOn: { backgroundColor: colors.primarySoft },
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
});
