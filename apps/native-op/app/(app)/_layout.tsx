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
      <Stack.Screen
        name="tasks/[applicationId]"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="tasks/onboard/[applicationId]"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="chats/[conversationId]"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="add-property/index"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="add-property/tenant"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="add-property/rooms"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="add-property/room-category"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="add-property/room-config"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="add-property/agreement"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="add-property/rent"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="add-property/charges"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="payment/[paymentId]"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="notifications"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="all-rent-dues"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="all-transactions"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{ gestureEnabled: true, fullScreenGestureEnabled: true }}
      />
    </Stack>
  );
}
