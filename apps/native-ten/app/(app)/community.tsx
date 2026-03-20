import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Text style={s.title}>Community</Text>

      <View style={s.center}>
        <View style={s.emptyCircle}>
          <Ionicons name="people-outline" size={48} color={colors.muted} />
        </View>
        <Text style={s.emptyTitle}>Coming soon</Text>
        <Text style={s.emptySub}>
          We'll design the community tab later.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.navy },
  emptySub: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
});

