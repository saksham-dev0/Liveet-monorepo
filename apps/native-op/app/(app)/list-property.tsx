import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useConvex } from "convex/react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import {
  card,
  cardShadow,
  colors,
  errorText,
  input,
  label,
  radii,
  sectionHeader,
  chip,
  chipActive,
  chipRow,
  chipText,
  chipTextActive,
  footerRow,
  primaryButton,
  primaryButtonDisabled,
  primaryButtonText,
  secondaryButton,
  secondaryButtonText,
} from "../../constants/theme";

type EditorData = {
  onboardingProfile?: {
    fullName?: string;
    brandName?: string;
    totalUnits?: number;
    totalProperties?: number;
    preferredLanguage?: string;
    operatingCityIds?: string[];
    status?: string;
  } | null;
  businessProfile?: {
    isRegistered?: boolean;
    businessType?: string;
    registeredName?: string;
    registeredAddress?: string;
    registrationDocType?: string;
    registrationNumber?: string;
  } | null;
  account?: {
    accountType?: string;
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    address?: string;
    upiId?: string;
    isSkipped?: boolean;
  } | null;

  property?: {
    _id: string;
    name?: string;
    totalUnits?: number;
    vacantUnits?: number;
    pincode?: string;
    city?: string;
    state?: string;
    line1?: string;
    description?: string;
    amenities?: string[];
    utilities?: string[];
  } | null;
  hasCompletedOnboarding?: boolean;
  listingGallery?: Array<{
    _id: string;
    fileId: string;
    description?: string;
    sortOrder: number;
    url: string | null;
  }>;
  tenantDetails?: {
    canStayMale?: boolean;
    canStayFemale?: boolean;
    canStayOthers?: boolean;
    bestForStudent?: boolean;
    bestForWorkingProfessional?: boolean;
  } | null;
  agreement?: {
    securityDepositDuration?: string;
    agreementDuration?: string;
    lockInPeriod?: string;
    noticePeriod?: string;
  } | null;
  rent?: {
    monthlyRentalCycle?: string;
    gracePeriodDays?: number;
    hasLateFee?: boolean;
    lateFeeAmount?: number;
  } | null;
  extraCharges?: {
    isChargingExtra?: boolean;
    type?: string;
    amount?: number;
    repetition?: string;
    gracePeriodDays?: number;
  } | null;

  // Room configuration is already part of the onboarding flow.
  roomOptions?: Array<{
    _id: string;
    category: string;
    numberOfRooms?: number;
    typeName?: string;
    rentAmount?: number;
    attachedWashroom?: boolean;
    attachedBalcony?: boolean;
    airConditioner?: boolean;
    geyser?: boolean;
    customFeatures?: string[];
  }>;
  floors?: Array<{
    _id: string;
    floorNumber: number;
    label?: string;
  }>;
  rooms?: Array<{
    _id: string;
    floorId: string;
    roomOptionId?: string;
    roomNumber: string;
    displayName?: string;
    category?: string;
  }>;

  coverImageUrl?: string | null;
  galleryImageUrls?: (string | null)[];
};

function formatMaybe(value: unknown, fallback: string = "—") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const str = String(value).trim();
  return str ? str : fallback;
}

function asNumberOrUndefined(inputValue: string): number | undefined {
  const v = inputValue.trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

type AccordionKey =
  | "personal"
  | "business"
  | "account"
  | "basics"
  | "listingImages"
  | "tenant"
  | "agreement"
  | "rent"
  | "charges"
  | "utilitiesAmenities"
  | "rooms";

const UTILITY_PRESETS = [
  "Wi‑Fi",
  "Power backup",
  "Water supply",
  "CCTV",
  "Security",
  "Elevator",
  "Housekeeping",
  "Laundry",
] as const;

const AMENITY_PRESETS = [
  "Parking",
  "Gym",
  "Swimming pool",
  "Garden",
  "AC",
  "Kitchen",
  "Pet friendly",
  "Laundry room",
  "Power backup",
] as const;

const MAX_LISTING_IMAGES = 10;

function AccordionSection({
  title,
  summary,
  expanded,
  onToggle,
  children,
  isLast,
  incomplete,
}: {
  title: string;
  summary?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isLast?: boolean;
  /** When true, shows an “Incomplete” pill on the header (listing checklist). */
  incomplete?: boolean;
}) {
  return (
    <View
      style={[
        styles.accSection,
        isLast ? styles.accSectionLast : styles.accSectionBorder,
      ]}
    >
      <TouchableOpacity
        style={styles.accHeader}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.accHeaderText}>
          <View style={styles.accTitleRow}>
            <Text style={styles.accTitle}>{title}</Text>
            {incomplete ? (
              <View style={styles.incompleteBadge}>
                <Text style={styles.incompleteBadgeText}>Incomplete</Text>
              </View>
            ) : null}
          </View>
          {summary && !expanded ? (
            <Text style={styles.accSummary} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.muted}
        />
      </TouchableOpacity>
      {expanded ? <View style={styles.accBody}>{children}</View> : null}
    </View>
  );
}

export default function ListPropertyScreen() {
  const router = useRouter();
  const convex = useConvex();

  const [editor, setEditor] = useState<EditorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Edit toggles
  const [editBasics, setEditBasics] = useState(false);
  const [editTenant, setEditTenant] = useState(false);
  const [editAgreement, setEditAgreement] = useState(false);
  const [editRent, setEditRent] = useState(false);
  const [editCharges, setEditCharges] = useState(false);

  const propertyId = editor?.property?._id ?? null;

  const [basicsName, setBasicsName] = useState("");
  const [basicsTotalUnits, setBasicsTotalUnits] = useState("");
  const [basicsVacantUnits, setBasicsVacantUnits] = useState("");
  const [basicsPincode, setBasicsPincode] = useState("");
  const [basicsCity, setBasicsCity] = useState("");
  const [basicsState, setBasicsState] = useState("");
  const [basicsLine1, setBasicsLine1] = useState("");
  const [basicsDescription, setBasicsDescription] = useState("");

  const [canStayMale, setCanStayMale] = useState(false);
  const [canStayFemale, setCanStayFemale] = useState(false);
  const [canStayOthers, setCanStayOthers] = useState(false);
  const [bestForStudent, setBestForStudent] = useState(false);
  const [bestWorkingProfessional, setBestWorkingProfessional] = useState(false);

  const [securityDepositDuration, setSecurityDepositDuration] = useState("");
  const [agreementDuration, setAgreementDuration] = useState("");
  const [lockInPeriod, setLockInPeriod] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");

  const [monthlyRentalCycle, setMonthlyRentalCycle] = useState("");
  const [gracePeriodDays, setGracePeriodDays] = useState("");
  const [hasLateFee, setHasLateFee] = useState<boolean | null>(null);
  const [lateFeeAmount, setLateFeeAmount] = useState("");

  const [isChargingExtra, setIsChargingExtra] = useState<boolean | null>(null);
  const [extraType, setExtraType] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [extraRepetition, setExtraRepetition] = useState("");
  const [extraGracePeriodDays, setExtraGracePeriodDays] = useState("");

  const [utilitiesTags, setUtilitiesTags] = useState<string[]>([]);
  const [amenitiesTags, setAmenitiesTags] = useState<string[]>([]);
  const [utilitiesSaving, setUtilitiesSaving] = useState(false);
  const [listingUploading, setListingUploading] = useState(false);
  const [customUtility, setCustomUtility] = useState("");
  const [customAmenity, setCustomAmenity] = useState("");
  const [captionById, setCaptionById] = useState<Record<string, string>>({});

  const [openSections, setOpenSections] = useState<Set<AccordionKey>>(
    () => new Set(),
  );

  const toggleSection = useCallback((key: AccordionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const fetchEditor = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await (convex as any).query(
        "onboarding:getPropertyListingEditorData",
        {},
      );
      setEditor(data ?? null);
    } catch (err: any) {
      setFetchError(err?.message ?? "Failed to load property listing.");
      setEditor(null);
    } finally {
      setLoading(false);
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      fetchEditor();
    }, [fetchEditor]),
  );

  useEffect(() => {
    if (!editBasics) return;
    const p = editor?.property;
    if (!p) return;
    setBasicsName(p.name ?? "");
    setBasicsTotalUnits(p.totalUnits != null ? String(p.totalUnits) : "");
    setBasicsVacantUnits(p.vacantUnits != null ? String(p.vacantUnits) : "");
    setBasicsPincode(p.pincode ?? "");
    setBasicsCity(p.city ?? "");
    setBasicsState(p.state ?? "");
    setBasicsLine1(p.line1 ?? "");
    setBasicsDescription(p.description ?? "");
  }, [editBasics, editor]);

  useEffect(() => {
    if (!editTenant) return;
    const t = editor?.tenantDetails;
    setCanStayMale(!!t?.canStayMale);
    setCanStayFemale(!!t?.canStayFemale);
    setCanStayOthers(!!t?.canStayOthers);
    setBestForStudent(!!t?.bestForStudent);
    setBestWorkingProfessional(!!t?.bestForWorkingProfessional);
  }, [editTenant, editor]);

  useEffect(() => {
    if (!editAgreement) return;
    const a = editor?.agreement;
    setSecurityDepositDuration(a?.securityDepositDuration ?? "");
    setAgreementDuration(a?.agreementDuration ?? "");
    setLockInPeriod(a?.lockInPeriod ?? "");
    setNoticePeriod(a?.noticePeriod ?? "");
  }, [editAgreement, editor]);

  useEffect(() => {
    if (!editRent) return;
    const r = editor?.rent;
    setMonthlyRentalCycle(r?.monthlyRentalCycle ?? "");
    setGracePeriodDays(r?.gracePeriodDays != null ? String(r.gracePeriodDays) : "");
    setHasLateFee(r?.hasLateFee === undefined ? null : !!r?.hasLateFee);
    setLateFeeAmount(r?.lateFeeAmount != null ? String(r.lateFeeAmount) : "");
  }, [editRent, editor]);

  useEffect(() => {
    if (!editCharges) return;
    const c = editor?.extraCharges;
    setIsChargingExtra(c?.isChargingExtra === undefined ? null : !!c?.isChargingExtra);
    setExtraType(c?.type ?? "");
    setExtraAmount(c?.amount != null ? String(c.amount) : "");
    setExtraRepetition(c?.repetition ?? "");
    setExtraGracePeriodDays(
      c?.gracePeriodDays != null ? String(c.gracePeriodDays) : "",
    );
  }, [editCharges, editor]);

  useEffect(() => {
    if (editBasics) setOpenSections((s) => new Set(s).add("basics"));
  }, [editBasics]);
  useEffect(() => {
    if (editTenant) setOpenSections((s) => new Set(s).add("tenant"));
  }, [editTenant]);
  useEffect(() => {
    if (editAgreement) setOpenSections((s) => new Set(s).add("agreement"));
  }, [editAgreement]);
  useEffect(() => {
    if (editRent) setOpenSections((s) => new Set(s).add("rent"));
  }, [editRent]);
  useEffect(() => {
    if (editCharges) setOpenSections((s) => new Set(s).add("charges"));
  }, [editCharges]);

  useEffect(() => {
    if (!editor?.property) return;
    setUtilitiesTags([...(editor.property.utilities ?? [])]);
    setAmenitiesTags([...(editor.property.amenities ?? [])]);
  }, [
    editor?.property?._id,
    JSON.stringify(editor?.property?.utilities),
    JSON.stringify(editor?.property?.amenities),
  ]);

  useEffect(() => {
    if (!editor?.listingGallery?.length) {
      setCaptionById({});
      return;
    }
    const m: Record<string, string> = {};
    for (const g of editor.listingGallery) {
      m[g._id] = g.description ?? "";
    }
    setCaptionById(m);
  }, [editor?.listingGallery]);

  const isTagSelected = (preset: string, list: string[]) =>
    list.some((x) => x.trim().toLowerCase() === preset.trim().toLowerCase());

  const togglePreset = (
    preset: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const p = preset.trim();
    const lower = p.toLowerCase();
    if (list.some((x) => x.trim().toLowerCase() === lower)) {
      setList(list.filter((x) => x.trim().toLowerCase() !== lower));
    } else {
      setList([...list, p]);
    }
  };

  const addCustomUtility = () => {
    const t = customUtility.trim();
    if (!t) return;
    if (!utilitiesTags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setUtilitiesTags((prev) => [...prev, t]);
    }
    setCustomUtility("");
  };

  const addCustomAmenity = () => {
    const t = customAmenity.trim();
    if (!t) return;
    if (!amenitiesTags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setAmenitiesTags((prev) => [...prev, t]);
    }
    setCustomAmenity("");
  };

  const saveUtilitiesAmenities = async () => {
    if (!editor?.hasCompletedOnboarding) return;
    setUtilitiesSaving(true);
    setSectionError(null);
    try {
      const utilities = utilitiesTags.map((s) => s.trim()).filter(Boolean);
      const amenities = amenitiesTags.map((s) => s.trim()).filter(Boolean);
      await (convex as any).mutation(
        "propertyListing:setListingUtilitiesAndAmenities",
        { utilities, amenities },
      );
      await fetchEditor();
    } catch (err: any) {
      setSectionError(err?.message ?? "Failed to save utilities & amenities.");
    } finally {
      setUtilitiesSaving(false);
    }
  };

  const uploadImageAndAddRow = async (uri: string, mimeType: string) => {
    if (!propertyId) throw new Error("Property not found.");
    const result = await (convex as any).mutation(
      "propertyListing:generateListingGalleryUploadUrl",
      {},
    );
    const uploadUrl: string | undefined = result?.uploadUrl;
    if (!uploadUrl) throw new Error("Could not get upload URL.");
    const fileResponse = await fetch(uri);
    const blob = await fileResponse.blob();
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      body: blob,
      headers: { "Content-Type": mimeType || "image/jpeg" },
    });
    const body = await uploadRes.json();
    const storageId = body?.storageId;
    if (!storageId) throw new Error("Upload failed.");
    await (convex as any).mutation("propertyListing:addListingGalleryItem", {
      propertyId,
      fileId: storageId,
    });
  };

  const pickListingImages = async () => {
    if (!editor?.hasCompletedOnboarding || !propertyId) {
      setSectionError("Complete onboarding and add property basics first.");
      return;
    }
    const current = editor.listingGallery?.length ?? 0;
    const remaining = MAX_LISTING_IMAGES - current;
    if (remaining <= 0) {
      setSectionError(`You can upload at most ${MAX_LISTING_IMAGES} images.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      setSectionError("Photo library permission is required.");
      return;
    }
    setListingUploading(true);
    setSectionError(null);
    try {
      const pickResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: remaining,
      } as Parameters<typeof ImagePicker.launchImageLibraryAsync>[0]);
      if (pickResult.canceled || !pickResult.assets?.length) return;
      const assets = pickResult.assets.slice(0, remaining);
      for (const asset of assets) {
        const uri = asset.uri;
        if (!uri) continue;
        await uploadImageAndAddRow(uri, asset.mimeType ?? "image/jpeg");
      }
      await fetchEditor();
    } catch (err: any) {
      setSectionError(err?.message ?? "Failed to upload images.");
    } finally {
      setListingUploading(false);
    }
  };

  const removeListingImage = async (itemId: string) => {
    setSectionError(null);
    try {
      await (convex as any).mutation("propertyListing:removeListingGalleryItem", {
        itemId,
      });
      await fetchEditor();
    } catch (err: any) {
      setSectionError(err?.message ?? "Failed to remove image.");
    }
  };

  const saveListingImageDescription = async (itemId: string, text: string) => {
    try {
      await (convex as any).mutation(
        "propertyListing:updateListingGalleryItemDescription",
        {
          itemId,
          description: text.trim() || undefined,
        },
      );
      await fetchEditor();
    } catch (err: any) {
      setSectionError(err?.message ?? "Failed to save caption.");
    }
  };

  const saveBasics = async () => {
    if (!basicsName.trim()) {
      setSectionError("Property name is required.");
      return;
    }
    setSectionSaving(true);
    setSectionError(null);
    try {
      await (convex as any).mutation("onboarding:createOrUpdatePropertyBasics", {
        propertyId: editor?.property?._id,
        name: basicsName.trim() || undefined,
        totalUnits: asNumberOrUndefined(basicsTotalUnits),
        vacantUnits: asNumberOrUndefined(basicsVacantUnits),
        pincode: basicsPincode.trim() || undefined,
        city: basicsCity.trim() || undefined,
        state: basicsState.trim() || undefined,
        line1: basicsLine1.trim() || undefined,
        description: basicsDescription.trim() || undefined,
      });
      setEditBasics(false);
      await fetchEditor();
    } catch (err: any) {
      setSectionError(err?.message ?? "Failed to save basic property details.");
    } finally {
      setSectionSaving(false);
    }
  };

  const saveTenant = async () => {
    if (!propertyId) {
      setSectionError("Please complete property basics first.");
      return;
    }
    setSectionSaving(true);
    setSectionError(null);
    try {
      await (convex as any).mutation("onboarding:updateTenantDetails", {
        propertyId,
        canStayMale,
        canStayFemale,
        canStayOthers,
        bestForStudent,
        bestForWorkingProfessional: bestWorkingProfessional,
      });
      setEditTenant(false);
      await fetchEditor();
    } catch (err: any) {
      setSectionError(err?.message ?? "Failed to save tenant details.");
    } finally {
      setSectionSaving(false);
    }
  };

  const saveAgreement = async () => {
    if (!propertyId) {
      setSectionError("Please complete property basics first.");
      return;
    }
    setSectionSaving(true);
    setSectionError(null);
    try {
      await (convex as any).mutation("onboarding:upsertAgreementDetails", {
        propertyId,
        securityDepositDuration: securityDepositDuration.trim() || undefined,
        agreementDuration: agreementDuration.trim() || undefined,
        lockInPeriod: lockInPeriod.trim() || undefined,
        noticePeriod: noticePeriod.trim() || undefined,
      });
      setEditAgreement(false);
      await fetchEditor();
    } catch (err: any) {
      setSectionError(err?.message ?? "Failed to save agreement details.");
    } finally {
      setSectionSaving(false);
    }
  };

  const saveRent = async () => {
    if (!propertyId) {
      setSectionError("Please complete property basics first.");
      return;
    }
    setSectionSaving(true);
    setSectionError(null);
    try {
      await (convex as any).mutation("onboarding:upsertRentDetails", {
        propertyId,
        monthlyRentalCycle: monthlyRentalCycle.trim() || undefined,
        gracePeriodDays: asNumberOrUndefined(gracePeriodDays),
        hasLateFee: hasLateFee === null ? undefined : hasLateFee,
        lateFeeAmount: asNumberOrUndefined(lateFeeAmount),
      });
      setEditRent(false);
      await fetchEditor();
    } catch (err: any) {
      setSectionError(err?.message ?? "Failed to save rent details.");
    } finally {
      setSectionSaving(false);
    }
  };

  const saveCharges = async () => {
    if (!propertyId) {
      setSectionError("Please complete property basics first.");
      return;
    }
    setSectionSaving(true);
    setSectionError(null);
    try {
      await (convex as any).mutation("onboarding:upsertExtraCharges", {
        propertyId,
        isChargingExtra: isChargingExtra === null ? undefined : isChargingExtra,
        type: extraType.trim() || undefined,
        amount: asNumberOrUndefined(extraAmount),
        repetition: extraRepetition.trim() || undefined,
        gracePeriodDays: asNumberOrUndefined(extraGracePeriodDays),
      });
      setEditCharges(false);
      await fetchEditor();
    } catch (err: any) {
      setSectionError(err?.message ?? "Failed to save other charges.");
    } finally {
      setSectionSaving(false);
    }
  };

  const roomDetails = useMemo(() => {
    const floors = editor?.floors ?? [];
    const rooms = editor?.rooms ?? [];
    const options = editor?.roomOptions ?? [];

    const optionById = new Map(options.map((o) => [o._id, o]));

    const floorsWithRooms = floors
      .slice()
      .sort((a, b) => a.floorNumber - b.floorNumber)
      .map((f) => {
        const roomForFloor = rooms
          .filter((r) => r.floorId === f._id)
          .slice()
          .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
        return { ...f, rooms: roomForFloor };
      });

    return { floorsWithRooms, optionById };
  }, [editor]);

  /** At least one listing photo; captions are optional. */
  const isListingImagesIncomplete = useMemo(() => {
    if (!editor?.hasCompletedOnboarding) return false;
    if (!propertyId) return true;
    const items = editor.listingGallery ?? [];
    return items.length === 0;
  }, [editor?.hasCompletedOnboarding, propertyId, editor?.listingGallery]);

  /** Both utilities and amenities need at least one tag. */
  const isUtilitiesAmenitiesIncomplete = useMemo(() => {
    if (!editor?.hasCompletedOnboarding) return false;
    return utilitiesTags.length === 0 || amenitiesTags.length === 0;
  }, [editor?.hasCompletedOnboarding, utilitiesTags, amenitiesTags]);

  const renderViewRow = (k: string, v: unknown) => (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvValue}>{formatMaybe(v)}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeRoot} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (fetchError) {
    return (
      <SafeAreaView style={styles.safeRoot} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <Text style={errorText}>{fetchError}</Text>
          <TouchableOpacity
            style={[secondaryButton, styles.retryBtn]}
            onPress={fetchEditor}
            activeOpacity={0.8}
          >
            <Text style={secondaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!editor) {
    return (
      <SafeAreaView style={styles.safeRoot} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={card}>
            <Text style={styles.emptyTitle}>No property details found</Text>
            <Text style={styles.emptySubtitle}>
              Complete onboarding property steps to start listing your property.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeRoot} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 14 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-forward"
              size={20}
              color={colors.navy}
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Property Listing</Text>
            <Text style={styles.screenSubtitle}>
              Review and update what you entered during onboarding.
            </Text>
          </View>
        </View>

        <View style={styles.accordionShell}>
          {editor.hasCompletedOnboarding ? (
            <AccordionSection
              title="Images & descriptions"
              summary={`${editor.listingGallery?.length ?? 0}/${MAX_LISTING_IMAGES} photos`}
              expanded={openSections.has("listingImages")}
              onToggle={() => toggleSection("listingImages")}
              incomplete={isListingImagesIncomplete}
            >
              {!propertyId ? (
                <Text style={styles.mutedText}>
                  Add property basics first, then upload up to {MAX_LISTING_IMAGES}{" "}
                  images for your listing.
                </Text>
              ) : (
                <>
                  <Text style={styles.listingHint}>
                    Add up to {MAX_LISTING_IMAGES} photos. Captions are optional.
                    Tap “Add photos” to pick one or more images.
                  </Text>
                  <TouchableOpacity
                    style={[
                      secondaryButton,
                      (listingUploading ||
                        (editor.listingGallery?.length ?? 0) >= MAX_LISTING_IMAGES) &&
                        styles.btnDisabled,
                    ]}
                    disabled={
                      listingUploading ||
                      (editor.listingGallery?.length ?? 0) >= MAX_LISTING_IMAGES
                    }
                    onPress={pickListingImages}
                    activeOpacity={0.85}
                  >
                    <Text style={secondaryButtonText}>
                      {listingUploading
                        ? "Uploading..."
                        : (editor.listingGallery?.length ?? 0) >= MAX_LISTING_IMAGES
                          ? "Maximum reached"
                          : "Add photos"}
                    </Text>
                  </TouchableOpacity>

                  {(editor.listingGallery ?? []).map((item) => (
                    <View key={item._id} style={styles.listingImageCard}>
                      {item.url ? (
                        <Image
                          source={{ uri: item.url }}
                          style={styles.listingThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.listingThumbPlaceholder}>
                          <Text style={styles.mutedText}>No preview</Text>
                        </View>
                      )}
                      <Text style={label}>Caption (optional)</Text>
                      <TextInput
                        style={[input, styles.listingCaptionInput]}
                        placeholder="Add a caption (optional)"
                        placeholderTextColor={colors.muted}
                        value={captionById[item._id] ?? ""}
                        onChangeText={(t) =>
                          setCaptionById((s) => ({ ...s, [item._id]: t }))
                        }
                        onBlur={() => {
                          const cur = (captionById[item._id] ?? "").trim();
                          const orig = (item.description ?? "").trim();
                          if (cur !== orig) {
                            void saveListingImageDescription(item._id, cur);
                          }
                        }}
                        multiline
                      />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => void removeListingImage(item._id)}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                        <Text style={styles.removeImageText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </AccordionSection>
          ) : null}

          {editor.hasCompletedOnboarding ? (
            <AccordionSection
              title="Utilities & amenities"
              summary={`${utilitiesTags.length} utilities · ${amenitiesTags.length} amenities`}
              expanded={openSections.has("utilitiesAmenities")}
              onToggle={() => toggleSection("utilitiesAmenities")}
              incomplete={isUtilitiesAmenitiesIncomplete}
            >
              <Text style={sectionHeader}>Utilities</Text>
              <View style={chipRow}>
                {UTILITY_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      chip,
                      isTagSelected(p, utilitiesTags) && chipActive,
                    ]}
                    onPress={() =>
                      togglePreset(p, utilitiesTags, setUtilitiesTags)
                    }
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        chipText,
                        isTagSelected(p, utilitiesTags) && chipTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.customTagRow}>
                <TextInput
                  style={[input, styles.customTagInput]}
                  placeholder="Add custom utility"
                  placeholderTextColor={colors.muted}
                  value={customUtility}
                  onChangeText={setCustomUtility}
                  onSubmitEditing={addCustomUtility}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.addTagBtn}
                  onPress={addCustomUtility}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addTagBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              <Text style={sectionHeader}>Amenities</Text>
              <View style={chipRow}>
                {AMENITY_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      chip,
                      isTagSelected(p, amenitiesTags) && chipActive,
                    ]}
                    onPress={() =>
                      togglePreset(p, amenitiesTags, setAmenitiesTags)
                    }
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        chipText,
                        isTagSelected(p, amenitiesTags) && chipTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.customTagRow}>
                <TextInput
                  style={[input, styles.customTagInput]}
                  placeholder="Add custom amenity"
                  placeholderTextColor={colors.muted}
                  value={customAmenity}
                  onChangeText={setCustomAmenity}
                  onSubmitEditing={addCustomAmenity}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.addTagBtn}
                  onPress={addCustomAmenity}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addTagBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              <View style={footerRow}>
                <TouchableOpacity
                  style={[
                    primaryButton,
                    utilitiesSaving && primaryButtonDisabled,
                  ]}
                  disabled={utilitiesSaving}
                  onPress={() => void saveUtilitiesAmenities()}
                  activeOpacity={0.85}
                >
                  <Text style={primaryButtonText}>
                    {utilitiesSaving ? "Saving..." : "Save utilities & amenities"}
                  </Text>
                </TouchableOpacity>
              </View>
            </AccordionSection>
          ) : null}

          <AccordionSection
            title="Personal info"
            summary={
              editor.onboardingProfile?.fullName ??
              editor.onboardingProfile?.brandName ??
              "Tap to expand"
            }
            expanded={openSections.has("personal")}
            onToggle={() => toggleSection("personal")}
          >
          <Text style={styles.accSectionTitle}>
            {editor.onboardingProfile?.fullName ??
              editor.onboardingProfile?.brandName ??
              "Not set"}
          </Text>

          {renderViewRow("Full name", editor.onboardingProfile?.fullName)}
          {renderViewRow("Brand name", editor.onboardingProfile?.brandName)}
          {renderViewRow("Preferred language", editor.onboardingProfile?.preferredLanguage)}
          {renderViewRow("Total units", editor.onboardingProfile?.totalUnits)}
          {renderViewRow(
            "Total properties",
            editor.onboardingProfile?.totalProperties,
          )}

          <View style={footerRow}>
            <TouchableOpacity
              style={secondaryButton}
              activeOpacity={0.8}
              onPress={() => router.push("/(onboarding)/personal-details")}
            >
              <Text style={secondaryButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          </AccordionSection>

          <AccordionSection
            title="Business info"
            summary={
              editor.businessProfile?.registeredName ??
              editor.businessProfile?.businessType ??
              "Not set"
            }
            expanded={openSections.has("business")}
            onToggle={() => toggleSection("business")}
          >
          <Text style={styles.accSectionTitle}>
            {editor.businessProfile?.registeredName ??
              editor.businessProfile?.businessType ??
              "Not set"}
          </Text>

          {renderViewRow(
            "Registered",
            editor.businessProfile?.isRegistered,
          )}
          {renderViewRow(
            "Business type",
            editor.businessProfile?.businessType,
          )}
          {renderViewRow(
            "Registered name",
            editor.businessProfile?.registeredName,
          )}
          {renderViewRow(
            "Registered address",
            editor.businessProfile?.registeredAddress,
          )}
          {renderViewRow(
            "Registration doc type",
            editor.businessProfile?.registrationDocType,
          )}
          {renderViewRow(
            "Registration number",
            editor.businessProfile?.registrationNumber,
          )}

          <View style={footerRow}>
            <TouchableOpacity
              style={secondaryButton}
              activeOpacity={0.8}
              onPress={() => router.push("/(onboarding)/business-details")}
            >
              <Text style={secondaryButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          </AccordionSection>

          <AccordionSection
            title="Payment / account"
            summary={editor.account?.accountType ?? "Not set"}
            expanded={openSections.has("account")}
            onToggle={() => toggleSection("account")}
          >
          <Text style={styles.accSectionTitle}>
            {editor.account?.accountType ?? "Not set"}
          </Text>

          {renderViewRow(
            "Account holder",
            editor.account?.accountHolderName,
          )}
          {renderViewRow(
            "Account number",
            editor.account?.accountNumber,
          )}
          {renderViewRow("IFSC code", editor.account?.ifscCode)}
          {renderViewRow("Address", editor.account?.address)}
          {renderViewRow("UPI ID", editor.account?.upiId)}
          {renderViewRow("Skipped", editor.account?.isSkipped)}

          <View style={footerRow}>
            <TouchableOpacity
              style={secondaryButton}
              activeOpacity={0.8}
              onPress={() => router.push("/(onboarding)/account")}
            >
              <Text style={secondaryButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          </AccordionSection>

          <AccordionSection
            title="Basic details"
            summary={editor.property?.name ?? "Not set"}
            expanded={openSections.has("basics")}
            onToggle={() => toggleSection("basics")}
          >
          <Text style={styles.accSectionTitle}>
            {editor.property?.name ? editor.property.name : "Not set"}
          </Text>

          {!editBasics ? (
            <>
              {renderViewRow("Total units", editor.property?.totalUnits)}
              {renderViewRow("Vacant units", editor.property?.vacantUnits)}
              {renderViewRow("Address", editor.property?.line1)}
              {renderViewRow("City", editor.property?.city)}
              {renderViewRow("State", editor.property?.state)}
              {renderViewRow("Pincode", editor.property?.pincode)}
              {renderViewRow("Description", editor.property?.description)}

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditBasics(true);
                  }}
                >
                  <Text style={secondaryButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {sectionError ? <Text style={errorText}>{sectionError}</Text> : null}

              <Text style={label}>Property name</Text>
              <TextInput style={input} value={basicsName} onChangeText={setBasicsName} />

              <Text style={label}>Total units</Text>
              <TextInput
                style={input}
                value={basicsTotalUnits}
                onChangeText={setBasicsTotalUnits}
                keyboardType="number-pad"
              />

              <Text style={label}>Vacant units</Text>
              <TextInput
                style={input}
                value={basicsVacantUnits}
                onChangeText={setBasicsVacantUnits}
                keyboardType="number-pad"
              />

              <Text style={sectionHeader}>Address</Text>
              <Text style={label}>House/Flat/Block no.</Text>
              <TextInput
                style={input}
                value={basicsLine1}
                onChangeText={setBasicsLine1}
              />

              <Text style={label}>Pincode</Text>
              <TextInput
                style={input}
                value={basicsPincode}
                onChangeText={setBasicsPincode}
                keyboardType="number-pad"
              />

              <Text style={label}>City</Text>
              <TextInput style={input} value={basicsCity} onChangeText={setBasicsCity} />

              <Text style={label}>State</Text>
              <TextInput style={input} value={basicsState} onChangeText={setBasicsState} />

              <Text style={label}>Description for tenants</Text>
              <TextInput
                style={[input, styles.multilineInput]}
                value={basicsDescription}
                onChangeText={setBasicsDescription}
                multiline
                textAlignVertical="top"
              />

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditBasics(false);
                  }}
                >
                  <Text style={secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[primaryButton, sectionSaving && primaryButtonDisabled]}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={saveBasics}
                >
                  <Text style={primaryButtonText}>
                    {sectionSaving ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          </AccordionSection>

          <AccordionSection
            title="Tenant preferences"
            summary="Who can stay & best suited for"
            expanded={openSections.has("tenant")}
            onToggle={() => toggleSection("tenant")}
          >

          {!editTenant ? (
            <>
              {renderViewRow("Can stay - Male", editor.tenantDetails?.canStayMale)}
              {renderViewRow("Can stay - Female", editor.tenantDetails?.canStayFemale)}
              {renderViewRow("Can stay - Others", editor.tenantDetails?.canStayOthers)}
              {renderViewRow(
                "Best for - Student",
                editor.tenantDetails?.bestForStudent,
              )}
              {renderViewRow(
                "Best for - Working professional",
                editor.tenantDetails?.bestForWorkingProfessional,
              )}

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditTenant(true);
                  }}
                >
                  <Text style={secondaryButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {sectionError ? <Text style={errorText}>{sectionError}</Text> : null}

              <Text style={sectionHeader}>Who can stay</Text>
              <View style={chipRow}>
                <TouchableOpacity
                  style={[chip, canStayMale && chipActive]}
                  onPress={() => setCanStayMale((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[chipText, canStayMale && chipTextActive]}>Male</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[chip, canStayFemale && chipActive]}
                  onPress={() => setCanStayFemale((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[chipText, canStayFemale && chipTextActive]}>
                    Female
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[chip, canStayOthers && chipActive]}
                  onPress={() => setCanStayOthers((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[chipText, canStayOthers && chipTextActive]}>
                    Others
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={sectionHeader}>Best suited for</Text>
              <View style={chipRow}>
                <TouchableOpacity
                  style={[chip, bestForStudent && chipActive]}
                  onPress={() => setBestForStudent((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[chipText, bestForStudent && chipTextActive]}>
                    Student
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[chip, bestWorkingProfessional && chipActive]}
                  onPress={() => setBestWorkingProfessional((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[chipText, bestWorkingProfessional && chipTextActive]}>
                    Working professional
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditTenant(false);
                  }}
                >
                  <Text style={secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[primaryButton, sectionSaving && primaryButtonDisabled]}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={saveTenant}
                >
                  <Text style={primaryButtonText}>
                    {sectionSaving ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          </AccordionSection>

          <AccordionSection
            title="Agreement"
            summary={
              editor.agreement?.agreementDuration ??
              editor.agreement?.securityDepositDuration ??
              "Tap to expand"
            }
            expanded={openSections.has("agreement")}
            onToggle={() => toggleSection("agreement")}
          >

          {!editAgreement ? (
            <>
              {renderViewRow("Security deposit duration", editor.agreement?.securityDepositDuration)}
              {renderViewRow("Agreement duration", editor.agreement?.agreementDuration)}
              {renderViewRow("Lock-in period", editor.agreement?.lockInPeriod)}
              {renderViewRow("Notice period", editor.agreement?.noticePeriod)}

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditAgreement(true);
                  }}
                >
                  <Text style={secondaryButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {sectionError ? <Text style={errorText}>{sectionError}</Text> : null}

              <Text style={label}>Security deposit duration</Text>
              <TextInput
                style={input}
                value={securityDepositDuration}
                onChangeText={setSecurityDepositDuration}
              />
              <Text style={label}>Agreement duration</Text>
              <TextInput
                style={input}
                value={agreementDuration}
                onChangeText={setAgreementDuration}
              />
              <Text style={label}>Lock-in period</Text>
              <TextInput
                style={input}
                value={lockInPeriod}
                onChangeText={setLockInPeriod}
              />
              <Text style={label}>Notice period</Text>
              <TextInput
                style={input}
                value={noticePeriod}
                onChangeText={setNoticePeriod}
              />

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditAgreement(false);
                  }}
                >
                  <Text style={secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[primaryButton, sectionSaving && primaryButtonDisabled]}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={saveAgreement}
                >
                  <Text style={primaryButtonText}>
                    {sectionSaving ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          </AccordionSection>

          <AccordionSection
            title="Rent"
            summary={
              editor.rent?.monthlyRentalCycle
                ? `Cycle: ${editor.rent.monthlyRentalCycle}`
                : "Monthly cycle & late fee"
            }
            expanded={openSections.has("rent")}
            onToggle={() => toggleSection("rent")}
          >

          {!editRent ? (
            <>
              {renderViewRow("Monthly rental cycle", editor.rent?.monthlyRentalCycle)}
              {renderViewRow("Grace period (days)", editor.rent?.gracePeriodDays)}
              {renderViewRow("Has late fee", editor.rent?.hasLateFee)}
              {renderViewRow("Late fee amount", editor.rent?.lateFeeAmount)}

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditRent(true);
                  }}
                >
                  <Text style={secondaryButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {sectionError ? <Text style={errorText}>{sectionError}</Text> : null}

              <Text style={label}>Monthly rental cycle</Text>
              <TextInput
                style={input}
                value={monthlyRentalCycle}
                onChangeText={setMonthlyRentalCycle}
              />

              <Text style={label}>Grace period (days)</Text>
              <TextInput
                style={input}
                value={gracePeriodDays}
                onChangeText={setGracePeriodDays}
                keyboardType="number-pad"
              />

              <Text style={sectionHeader}>Late fee</Text>
              <View style={chipRow}>
                <TouchableOpacity
                  style={[chip, hasLateFee === true && chipActive]}
                  onPress={() => setHasLateFee(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[chipText, hasLateFee === true && chipTextActive]}>
                    Yes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[chip, hasLateFee === false && chipActive]}
                  onPress={() => setHasLateFee(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[chipText, hasLateFee === false && chipTextActive]}>
                    No
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={label}>Late fee amount</Text>
              <TextInput
                style={input}
                value={lateFeeAmount}
                onChangeText={setLateFeeAmount}
                keyboardType="number-pad"
              />

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditRent(false);
                  }}
                >
                  <Text style={secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[primaryButton, sectionSaving && primaryButtonDisabled]}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={saveRent}
                >
                  <Text style={primaryButtonText}>
                    {sectionSaving ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          </AccordionSection>

          <AccordionSection
            title="Other charges"
            summary={
              editor.extraCharges?.type
                ? `${editor.extraCharges.type}${editor.extraCharges.amount != null ? ` · ${editor.extraCharges.amount}` : ""}`
                : "Extra fees"
            }
            expanded={openSections.has("charges")}
            onToggle={() => toggleSection("charges")}
          >

          {!editCharges ? (
            <>
              {renderViewRow("Charging extra?", editor.extraCharges?.isChargingExtra)}
              {renderViewRow("Charge type", editor.extraCharges?.type)}
              {renderViewRow("Amount", editor.extraCharges?.amount)}
              {renderViewRow("Repetition", editor.extraCharges?.repetition)}
              {renderViewRow("Grace period (days)", editor.extraCharges?.gracePeriodDays)}

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditCharges(true);
                  }}
                >
                  <Text style={secondaryButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {sectionError ? <Text style={errorText}>{sectionError}</Text> : null}

              <Text style={sectionHeader}>Do you charge extra?</Text>
              <View style={chipRow}>
                <TouchableOpacity
                  style={[chip, isChargingExtra === true && chipActive]}
                  onPress={() => setIsChargingExtra(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[chipText, isChargingExtra === true && chipTextActive]}>
                    Yes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[chip, isChargingExtra === false && chipActive]}
                  onPress={() => setIsChargingExtra(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[chipText, isChargingExtra === false && chipTextActive]}>
                    No
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={label}>Charge type</Text>
              <TextInput style={input} value={extraType} onChangeText={setExtraType} />

              <Text style={label}>Amount</Text>
              <TextInput
                style={input}
                value={extraAmount}
                onChangeText={setExtraAmount}
                keyboardType="number-pad"
              />

              <Text style={label}>Repetition</Text>
              <TextInput
                style={input}
                value={extraRepetition}
                onChangeText={setExtraRepetition}
              />

              <Text style={label}>Grace period (days)</Text>
              <TextInput
                style={input}
                value={extraGracePeriodDays}
                onChangeText={setExtraGracePeriodDays}
                keyboardType="number-pad"
              />

              <View style={footerRow}>
                <TouchableOpacity
                  style={secondaryButton}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSectionError(null);
                    setEditCharges(false);
                  }}
                >
                  <Text style={secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[primaryButton, sectionSaving && primaryButtonDisabled]}
                  disabled={sectionSaving}
                  activeOpacity={0.8}
                  onPress={saveCharges}
                >
                  <Text style={primaryButtonText}>
                    {sectionSaving ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          </AccordionSection>

          <AccordionSection
            title="Rooms & options"
            summary={
              propertyId
                ? `${editor.roomOptions?.length ?? 0} option(s) · ${editor.rooms?.length ?? 0} room(s)`
                : "Complete property basics first"
            }
            expanded={openSections.has("rooms")}
            onToggle={() => toggleSection("rooms")}
            isLast
          >

          <Text style={styles.roomsSummaryText}>
            {propertyId ? "Room configuration you entered" : "Complete property basics first"}
          </Text>

          {editor.roomOptions?.length ? (
            <>
              <Text style={sectionHeader}>Options</Text>
              {(editor.roomOptions ?? []).map((opt) => (
                <View key={opt._id} style={styles.optionRow}>
                  <Text style={styles.optionTitle}>
                    {opt.category} {opt.numberOfRooms != null ? `(${opt.numberOfRooms} room(s))` : ""}
                  </Text>
                  {opt.typeName ? <Text style={styles.optionSub}>Type: {opt.typeName}</Text> : null}
                  {opt.rentAmount != null ? <Text style={styles.optionSub}>Rent: {opt.rentAmount}</Text> : null}
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.mutedText}>No room options added yet.</Text>
          )}

          {roomDetails.floorsWithRooms?.length ? (
            <>
              <Text style={sectionHeader}>Floors</Text>
              {roomDetails.floorsWithRooms.map((f) => (
                <View key={f._id} style={styles.floorBlock}>
                  <Text style={styles.floorTitle}>
                    {f.label ?? `Floor ${f.floorNumber}`}
                  </Text>
                  {f.rooms?.length ? (
                    <Text style={styles.floorRoomsText}>
                      {f.rooms.map((r) => r.displayName ?? r.roomNumber).join(", ")}
                    </Text>
                  ) : (
                    <Text style={styles.mutedText}>No rooms on this floor.</Text>
                  )}
                </View>
              ))}
            </>
          ) : null}

          <View style={footerRow}>
            <TouchableOpacity
              style={secondaryButton}
              activeOpacity={0.8}
              disabled={!propertyId}
              onPress={() => {
                if (!propertyId) return;
                router.push({
                  pathname: "/(onboarding)/property/room-config",
                  params: { propertyId },
                } as any);
              }}
            >
              <Text style={secondaryButtonText}>Edit rooms</Text>
            </TouchableOpacity>
          </View>
          </AccordionSection>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  accordionShell: {
    borderRadius: radii.card,
    backgroundColor: colors.cardBg,
    overflow: "hidden",
    ...cardShadow,
  },
  accSection: {
    backgroundColor: colors.cardBg,
  },
  accSectionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accSectionLast: {
    borderBottomWidth: 0,
  },
  accHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  accHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  accTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  accTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    flexShrink: 1,
  },
  incompleteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  incompleteBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.error,
    letterSpacing: 0.2,
  },
  accSummary: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  accBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  accSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.pageBg,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  retryBtn: {
    maxWidth: 160,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  headerRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 2,
  },
  screenSubtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  kvRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    alignItems: "flex-start",
  },
  kvKey: {
    width: 160,
    color: colors.muted,
    fontWeight: "600",
    fontSize: 13,
  },
  kvValue: {
    flex: 1,
    color: colors.navy,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
  },
  multilineInput: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  roomsSummaryText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 10,
  },
  optionRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  optionTitle: {
    color: colors.navy,
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 4,
  },
  optionSub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  floorBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  floorTitle: {
    color: colors.navy,
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 6,
  },
  floorRoomsText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  mutedText: {
    color: colors.muted,
    fontSize: 13,
  },
  listingHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  listingImageCard: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  listingThumb: {
    width: "100%",
    height: 180,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceGray,
  },
  listingThumbPlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  listingCaptionInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  removeImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  removeImageText: {
    color: colors.error,
    fontWeight: "600",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  customTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  customTagInput: {
    flex: 1,
    marginTop: 0,
  },
  addTagBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  addTagBtnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
});

