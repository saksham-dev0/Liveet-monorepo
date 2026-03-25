import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../../constants/theme";

export default function TasksScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Tasks</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.body}>
          This screen is under construction and will be available soon.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
});
