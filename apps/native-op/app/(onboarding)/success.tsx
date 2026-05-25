import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, radii } from "../../constants/theme";

const TODOS = [
  {
    emoji: "🏠",
    title: "Complete property details",
    desc: "Add photos, amenities, and full address info",
  },
  {
    emoji: "🛏️",
    title: "Configure room setup",
    desc: "Set room types, capacities, and pricing",
  },
  {
    emoji: "👤",
    title: "Add your tenants",
    desc: "Invite existing tenants to get started",
  },
];

export default function SuccessScreen() {
  const router = useRouter();

  return (
    <View style={s.container}>
      <View style={s.content}>
        <Text style={s.emoji}>🎉</Text>
        <Text style={s.heading}>{"You're all set!"}</Text>
        <Text style={s.sub}>
          {"Your property is live on Liveet. Complete these steps to get the most out of it."}
        </Text>

        <View style={s.highlights}>
          {[
            { emoji: "🏠", text: "Property created" },
            { emoji: "📋", text: "Agreement configured" },
            { emoji: "💸", text: "Rent tracking ready" },
          ].map((item) => (
            <View key={item.text} style={s.highlightRow}>
              <View style={s.highlightDot} />
              <Text style={s.highlightEmoji}>{item.emoji}</Text>
              <Text style={s.highlightText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <Text style={s.todoHeading}>Next steps</Text>
        <View style={s.todoList}>
          {TODOS.map((item) => (
            <View key={item.title} style={s.todoCard}>
              <Text style={s.todoEmoji}>{item.emoji}</Text>
              <View style={s.todoTextWrap}>
                <Text style={s.todoTitle}>{item.title}</Text>
                <Text style={s.todoDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={s.btn}
        onPress={() => router.replace("/(app)/(tabs)" as any)}
        activeOpacity={0.8}
      >
        <Text style={s.btnText}>Go to dashboard →</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  emoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  heading: {
    fontSize: 42,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  sub: {
    fontSize: 16,
    color: colors.muted,
    lineHeight: 24,
    marginBottom: 36,
  },
  highlights: {
    gap: 14,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.navy,
  },
  highlightEmoji: {
    fontSize: 20,
  },
  highlightText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  todoHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 36,
    marginBottom: 14,
  },
  todoList: {
    gap: 12,
  },
  todoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.offWhite ?? "#F7F8FA",
    borderRadius: radii.md ?? 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  todoEmoji: {
    fontSize: 24,
  },
  todoTextWrap: {
    flex: 1,
    gap: 2,
  },
  todoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
  },
  todoDesc: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  btn: {
    borderRadius: radii.pill,
    paddingVertical: 17,
    alignItems: "center",
    backgroundColor: colors.navy,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
});
