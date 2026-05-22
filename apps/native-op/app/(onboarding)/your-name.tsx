import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, radii } from "../../constants/theme";

export default function YourNameScreen() {
  const router = useRouter();
  const [name, setName] = useState("");

  const handleContinue = () => {
    if (!name.trim()) return;
    router.push({
      pathname: "/(onboarding)/intro" as any,
      params: { name: name.trim() },
    });
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.content}>
        <Text style={s.eyebrow}>first things first</Text>
        <Text style={s.heading}>What should we{"\n"}call you?</Text>

        <TextInput
          style={s.input}
          placeholder="Your name"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleContinue}
        />

        <TouchableOpacity
          style={[s.btn, !name.trim() && s.btnDisabled]}
          onPress={handleContinue}
          disabled={!name.trim()}
          activeOpacity={0.8}
        >
          <Text style={s.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
  },
  eyebrow: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  heading: {
    fontSize: 38,
    fontWeight: "800",
    color: colors.navy,
    lineHeight: 46,
    letterSpacing: -0.5,
    marginBottom: 32,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 17,
    backgroundColor: colors.inputBg,
    color: colors.navy,
    marginBottom: 16,
  },
  btn: {
    borderRadius: radii.pill,
    paddingVertical: 17,
    alignItems: "center",
    backgroundColor: colors.navy,
  },
  btnDisabled: {
    backgroundColor: colors.primaryLight,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
});
