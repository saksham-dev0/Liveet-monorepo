import React, { useCallback, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  DimensionValue,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "./themed-text";
import { useThemeColor } from "../hooks/use-theme";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Easing,
} from "react-native-reanimated";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DISMISS_THRESHOLD = 150;
const VELOCITY_THRESHOLD = 500;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.5,
};

const TIMING_IN = {
  duration: 300,
  easing: Easing.out(Easing.cubic),
};

const TIMING_OUT = {
  duration: 250,
  easing: Easing.in(Easing.cubic),
};

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  showCloseButton?: boolean;
  maxHeight?: DimensionValue;
  dismissOnBackdrop?: boolean;
  dismissible?: boolean;
  keyboardAvoiding?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  showCloseButton,
  maxHeight = "80%",
  dismissOnBackdrop = true,
  dismissible = true,
  keyboardAvoiding = false,
  children,
  footer,
}: BottomSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const cardBg = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const mutedColor = useThemeColor({}, "icon");
  const borderColor = useThemeColor({}, "border");

  const showHeader = !!title || showCloseButton;
  const resolvedShowClose = showCloseButton ?? !!title;

  const [modalVisible, setModalVisible] = React.useState(false);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropProgress = useSharedValue(0);

  const handleDismiss = useCallback(() => {
    translateY.value = withTiming(SCREEN_HEIGHT, TIMING_OUT, (finished) => {
      if (finished) {
        runOnJS(setModalVisible)(false);
        runOnJS(onClose)();
      }
    });
    backdropProgress.value = withTiming(0, TIMING_OUT);
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      translateY.value = SCREEN_HEIGHT;
      backdropProgress.value = 0;
      setModalVisible(true);
    } else if (modalVisible) {
      translateY.value = SCREEN_HEIGHT;
      backdropProgress.value = 0;
      setModalVisible(false);
    }
  }, [visible]);

  const onModalShow = useCallback(() => {
    translateY.value = withTiming(0, TIMING_IN);
    backdropProgress.value = withTiming(1, TIMING_IN);
  }, []);

  const panGesture = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
      backdropProgress.value = interpolate(
        translateY.value,
        [0, SCREEN_HEIGHT],
        [1, 0]
      );
    })
    .onEnd((event) => {
      if (
        event.translationY > DISMISS_THRESHOLD ||
        event.velocityY > VELOCITY_THRESHOLD
      ) {
        translateY.value = withTiming(SCREEN_HEIGHT, TIMING_OUT, (finished) => {
          if (finished) {
            runOnJS(setModalVisible)(false);
            runOnJS(onClose)();
          }
        });
        backdropProgress.value = withTiming(0, TIMING_OUT);
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
        backdropProgress.value = withSpring(1, SPRING_CONFIG);
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0,0,0,${backdropProgress.value * 0.5})`,
  }));

  const handleBackdropPress = useCallback(() => {
    if (dismissible && dismissOnBackdrop) {
      handleDismiss();
    }
  }, [dismissible, dismissOnBackdrop, handleDismiss]);

  const sheetContent = (
    <GestureHandlerRootView style={styles.flex}>
      <Pressable style={styles.flex} onPress={handleBackdropPress}>
        <Animated.View
          style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}
        />
      </Pressable>

      <Animated.View
        style={[
          styles.container,
          { backgroundColor: cardBg, maxHeight, paddingBottom: Math.max(bottom, 24) },
          sheetAnimatedStyle,
        ]}
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View>
            <View
              style={[styles.handle, { backgroundColor: borderColor }]}
            />

            {showHeader && (
              <View style={styles.header}>
                <ThemedText
                  style={[styles.title, { color: textColor }]}
                  numberOfLines={1}
                >
                  {title}
                </ThemedText>
                {resolvedShowClose && (
                  <Pressable onPress={handleDismiss} hitSlop={8}>
                    <ThemedText style={[styles.closeButton, { color: mutedColor }]}>
                      ✕
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}
          </Animated.View>
        </GestureDetector>

        {children}

        {footer && <View style={styles.footer}>{footer}</View>}
      </Animated.View>
    </GestureHandlerRootView>
  );

  return (
    <Modal
      visible={modalVisible}
      animationType="none"
      transparent
      onRequestClose={dismissible ? handleDismiss : undefined}
      onShow={onModalShow}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          {sheetContent}
        </KeyboardAvoidingView>
      ) : (
        sheetContent
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
  },
  closeButton: {
    fontSize: 18,
    fontWeight: "500",
  },
  footer: {
    marginTop: 12,
  },
});
