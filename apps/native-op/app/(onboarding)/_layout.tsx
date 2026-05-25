import { Slot } from "expo-router";
import { KeyboardAvoidingView, Platform, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/theme";
import { OnboardingProvider } from "../../context/OnboardingContext";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
        >
          <Slot />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </OnboardingProvider>
  );
}
