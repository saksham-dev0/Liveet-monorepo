import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../constants/theme";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={s.container}
      activeOpacity={1}
      onPress={() => router.push("/(onboarding)/your-name" as any)}
    >
      <View style={s.center}>
        <Text style={s.emoji}>👋</Text>
        <Text style={s.heading}>Hey</Text>
      </View>

      <Text style={s.tap}>Tap to continue →</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emoji: {
    fontSize: 72,
  },
  heading: {
    fontSize: 64,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -1,
  },
  tap: {
    alignSelf: "flex-end",
    fontSize: 16,
    fontWeight: "500",
    color: colors.navy,
  },
});
