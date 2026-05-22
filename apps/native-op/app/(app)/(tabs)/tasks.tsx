import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function TasksScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Tasks</Text>
      <View style={styles.empty}>
        <Ionicons name="checkmark-circle-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyText}>No tasks yet.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: "800", color: "#1E293B", marginBottom: 24 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, color: "#9CA3AF" },
});
