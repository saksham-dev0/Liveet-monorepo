import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function Screen() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#1E293B" />
      </Pressable>
      <Text style={styles.title}>Agreement</Text>
      <View style={styles.empty}>
        <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyText}>Coming soon.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", paddingTop: 60, paddingHorizontal: 20 },
  back: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#1E293B", marginBottom: 24 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, color: "#9CA3AF" },
});
