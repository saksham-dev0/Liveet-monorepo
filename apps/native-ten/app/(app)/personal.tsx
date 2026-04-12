import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { colors, radii, cardShadow, input as inputStyle } from "../../constants/theme";

export default function PersonalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const convex = useConvex();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [profileImageStorageId, setProfileImageStorageId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchedAvatarUrl, setFetchedAvatarUrl] = useState<string | null>(null);

  // Load current user data
  useEffect(() => {
    (convex as any).query("users:getCurrentUser", {}).then((user: any) => {
      if (!user) return;
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setDateOfBirth(user.dateOfBirth ?? "");
      if (user.profileImageStorageId) {
        setProfileImageStorageId(user.profileImageStorageId);
        (convex as any)
          .query("users:getProfileImageUrl", { storageId: user.profileImageStorageId })
          .then((url: string | null) => setFetchedAvatarUrl(url))
          .catch(() => {});
      }
    }).catch(() => {});
  }, [convex]);

  const displayAvatar =
    avatarUri ??
    fetchedAvatarUrl ??
    clerkUser?.imageUrl ??
    null;

  async function handlePickAvatar() {
    Alert.alert("Change Photo", "Choose a source", [
      {
        text: "Camera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission needed", "Camera access is required.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!result.canceled) await uploadImage(result.assets[0]);
        },
      },
      {
        text: "Photo Library",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission needed", "Photo library access is required.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!result.canceled) await uploadImage(result.assets[0]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function uploadImage(asset: ImagePicker.ImagePickerAsset) {
    setAvatarUri(asset.uri);
    setUploadingAvatar(true);
    try {
      const uploadUrl = await (convex as any).mutation("users:generateProfileImageUploadUrl", {});
      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        body: blob,
        headers: { "Content-Type": asset.mimeType ?? "image/jpeg" },
      });
      const { storageId } = await uploadRes.json();
      if (!storageId) throw new Error("Upload failed");
      setProfileImageStorageId(storageId);
    } catch {
      Alert.alert("Upload failed", "Could not upload the photo. Please try again.");
      setAvatarUri(null);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      if (name.trim()) patch.name = name.trim();
      if (phone.trim()) patch.phone = phone.trim();
      if (dateOfBirth.trim()) patch.dateOfBirth = dateOfBirth.trim();
      if (profileImageStorageId) patch.profileImageStorageId = profileImageStorageId;

      await (convex as any).mutation("users:updateUserProfile", patch);
      router.back();
    } catch {
      Alert.alert("Save failed", "Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[s.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.navy} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Personal</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile hero */}
          <View style={s.heroRow}>
            <View>
              <Text style={s.heroTitle}>My profile</Text>
              <Text style={s.heroSub}>Personal details</Text>
            </View>
            <TouchableOpacity style={s.avatarWrap} onPress={handlePickAvatar} activeOpacity={0.8}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarPlaceholder]}>
                  <Ionicons name="person" size={32} color={colors.white} />
                </View>
              )}
              {uploadingAvatar ? (
                <View style={s.avatarOverlay}>
                  <ActivityIndicator color={colors.white} size="small" />
                </View>
              ) : (
                <View style={s.cameraBadge}>
                  <Ionicons name="camera" size={13} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Fields */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>Full name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />

            <Text style={s.label}>Date of birth</Text>
            <TextInput
              style={s.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />

            <Text style={s.label}>Phone number</Text>
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 00000 00000"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
            />

            <Text style={s.label}>Email address</Text>
            <View style={[s.input, s.inputReadOnly]}>
              <Text style={s.readOnlyText}>
                {clerkUser?.primaryEmailAddress?.emailAddress ?? ""}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Save button */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity
            style={[s.saveBtn, (saving || uploadingAvatar) && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || uploadingAvatar}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.pageBg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 14,
    color: colors.muted,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.pageBg,
  },
  fieldGroup: {
    gap: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    ...inputStyle,
    fontSize: 15,
    color: colors.navy,
  },
  inputReadOnly: {
    backgroundColor: colors.surfaceGray,
    justifyContent: "center",
  },
  readOnlyText: {
    fontSize: 15,
    color: colors.muted,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.pageBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
});
