import { Stack } from "expo-router";
import { colors } from "../../constants/theme";

/** Keep tab shell as default when opening /(app). */
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function AppStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.pageBg },
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="list-property"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="tenant/[applicationId]"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="tasks/assign-room/[applicationId]"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
    </Stack>
  );
}
