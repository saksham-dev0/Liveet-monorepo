import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, cardShadow } from "../../../constants/theme";
import LiveetTenantHero from "../../../assets/images/Liveet-tenant.png";

const { width: SW } = Dimensions.get("window");
const HERO_H = SW * 0.75;
const ACCENT = "#D4F542";
const ACCENT_TEXT = "#1A1A1A";
const NAVY = colors.navy;
const MUTED = colors.muted;
const BORDER = colors.border;
const SURFACE = colors.surfaceGray;
const PAGE_BG = colors.pageBg;
const WHITE = colors.white;

const CATEGORY_LABELS: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  "3plus": "3+ Bed",
};

type RoomOption = {
  _id: string;
  category: string;
  typeName?: string;
  rentAmount?: number;
  attachedWashroom?: boolean;
  attachedBalcony?: boolean;
  airConditioner?: boolean;
  geyser?: boolean;
  customFeatures?: string[];
};

type PaymentDetails = {
  accountName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  upiId: string | null;
  qrImageUrl: string | null;
};

type BookingForm = {
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  course: string;
  yearOfStudy: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  moveInDate: string;
  foodPreference: string;
};

type PropertyDetail = {
  _id: string;
  name?: string;
  coverImageUrl?: string | null;
  imageUrls?: string[];
  pincode?: string;
  city?: string;
  state?: string;
  line1?: string;
  description?: string;
  propertyType?: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  roomOptions: RoomOption[];
  tenantDetails: {
    canStayMale?: boolean;
    canStayFemale?: boolean;
    canStayOthers?: boolean;
    bestForStudent?: boolean;
    bestForWorkingProfessional?: boolean;
  } | null;
  agreement: {
    agreementDuration?: string | null;
    noticePeriod?: string | null;
    securityDepositDuration?: string | null;
    lockInPeriod?: string | null;
  } | null;
};

function formatAmount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const r = Math.round(k * 10) / 10;
    return `${r.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString("en-IN");
}

function getRentRange(opts: RoomOption[]) {
  const amounts = opts.map((r) => r.rentAmount).filter((a): a is number => a != null && a > 0);
  if (!amounts.length) return null;
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

function getAmenities(opts: RoomOption[]) {
  const list: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [];
  const seen = new Set<string>();
  const add = (label: string, icon: keyof typeof Ionicons.glyphMap) => {
    if (!seen.has(label)) { seen.add(label); list.push({ label, icon }); }
  };
  for (const r of opts) {
    if (r.airConditioner) add("Air Conditioning", "snow-outline");
    if (r.geyser) add("Geyser", "water-outline");
    if (r.attachedWashroom) add("Attached Washroom", "man-outline");
    if (r.attachedBalcony) add("Balcony", "sunny-outline");
    r.customFeatures?.forEach((f) => add(f, "checkmark-circle-outline"));
  }
  return list;
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon} size={17} color={NAVY} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function AgreementRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[s.agRow, !last && s.agRowBorder]}>
      <View style={s.agIconWrap}>
        <Ionicons name={icon} size={16} color={NAVY} />
      </View>
      <Text style={s.agLabel}>{label}</Text>
      <Text style={s.agValue}>{value}</Text>
    </View>
  );
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const convex = useConvex();
  const insets = useSafeAreaInsets();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  const [bookingStep, setBookingStep] = useState<0 | 1 | 2>(0); // 0=closed, 1=bank details, 2=form
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentProofId, setPaymentProofId] = useState<string | null>(null);
  const [paymentProofUri, setPaymentProofUri] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [form, setForm] = useState<BookingForm>({
    studentName: "",
    studentPhone: "",
    studentEmail: "",
    course: "",
    yearOfStudy: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    moveInDate: "",
    foodPreference: "",
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await (convex as any).query("properties:getById", { propertyId: id });
        if (!cancelled) setProperty(result ?? null);
      } catch (err) {
        console.warn("Failed to fetch property:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, convex]);

  const handleBookNow = useCallback(async () => {
    if (!id) return;
    setPaymentLoading(true);
    setBookingStep(1);
    try {
      const result = await (convex as any).query("properties:getPaymentDetails", { propertyId: id });
      setPaymentDetails(result ?? null);
    } catch (err) {
      console.warn("Failed to fetch payment details:", err);
    } finally {
      setPaymentLoading(false);
    }
  }, [id, convex]);

  const pickPaymentProof = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;

    setUploadingProof(true);
    try {
      const uploadUrl = await (convex as any).mutation("properties:generateUploadUrl", {});
      const asset = res.assets[0];
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);
      const { storageId } = await uploadRes.json();
      if (!storageId) throw new Error("Missing storageId");
      setPaymentProofId(storageId);
      setPaymentProofUri(asset.uri);
    } catch {
      Alert.alert("Upload failed", "Could not upload payment proof. Try again.");
    } finally {
      setUploadingProof(false);
    }
  }, [convex]);

  const handleSubmitBooking = useCallback(async () => {
    if (!id) return;
    if (!form.studentName.trim()) {
      Alert.alert("Required", "Please enter student name.");
      return;
    }
    if (!form.studentPhone.trim()) {
      Alert.alert("Required", "Please enter student phone number.");
      return;
    }
    if (!form.moveInDate.trim()) {
      Alert.alert("Required", "Please enter move-in date.");
      return;
    }
    if (!paymentProofId) {
      Alert.alert("Required", "Please upload payment proof (screenshot or receipt).");
      return;
    }
    setSubmitting(true);
    try {
      await (convex as any).mutation("properties:submitBookingRequest", {
        propertyId: id,
        studentName: form.studentName.trim(),
        studentPhone: form.studentPhone.trim(),
        studentEmail: form.studentEmail.trim() || undefined,
        course: form.course.trim() || undefined,
        yearOfStudy: form.yearOfStudy.trim() || undefined,
        parentName: form.parentName.trim() || undefined,
        parentPhone: form.parentPhone.trim() || undefined,
        parentEmail: form.parentEmail.trim() || undefined,
        moveInDate: form.moveInDate.trim(),
        foodPreference: form.foodPreference.trim() || undefined,
        paymentProofId: paymentProofId ?? undefined,
      });
      setBookingStep(0);
      setForm({
        studentName: "", studentPhone: "", studentEmail: "",
        course: "", yearOfStudy: "", parentName: "", parentPhone: "",
        parentEmail: "", moveInDate: "", foodPreference: "",
      });
      setPaymentProofId(null);
      setPaymentProofUri(null);
      Alert.alert("Booking Submitted!", "Your booking request has been sent to the operator. They will reach out to you shortly.", [{ text: "OK" }]);
    } catch (err) {
      Alert.alert("Error", "Failed to submit booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [id, convex, form, paymentProofId]);

  const handleVisit = useCallback(() => {
    if (property?.contactPhone) {
      Linking.openURL(`tel:${property.contactPhone}`);
    } else if (property?.contactEmail) {
      Linking.openURL(`mailto:${property.contactEmail}`);
    } else {
      Alert.alert("Schedule Visit", "Contact info not available yet.", [{ text: "OK" }]);
    }
  }, [property]);

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.center}><ActivityIndicator size="large" color={NAVY} /></View>
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <TouchableOpacity style={[s.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </TouchableOpacity>
        <View style={s.center}><Text style={s.errorText}>Property not found</Text></View>
      </View>
    );
  }

  const rentRange = getRentRange(property.roomOptions);
  const amenities = getAmenities(property.roomOptions);
  const images = property.imageUrls?.length
    ? property.imageUrls
    : property.coverImageUrl
    ? [property.coverImageUrl]
    : [];
  const locationLine = [property.line1, property.city, property.state, property.pincode]
    .filter(Boolean).join(", ");

  const tenantTags: string[] = [];
  if (property.tenantDetails?.canStayMale) tenantTags.push("Males");
  if (property.tenantDetails?.canStayFemale) tenantTags.push("Females");
  if (property.tenantDetails?.canStayOthers) tenantTags.push("Others");

  const suitedFor: string[] = [];
  if (property.tenantDetails?.bestForStudent) suitedFor.push("Students");
  if (property.tenantDetails?.bestForWorkingProfessional) suitedFor.push("Professionals");

  const agRows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [];
  if (property.agreement?.securityDepositDuration)
    agRows.push({ icon: "cash-outline", label: "Security deposit", value: property.agreement.securityDepositDuration });
  if (property.agreement?.lockInPeriod)
    agRows.push({ icon: "lock-closed-outline", label: "Lock-in period", value: property.agreement.lockInPeriod });
  if (property.agreement?.noticePeriod)
    agRows.push({ icon: "time-outline", label: "Notice period", value: property.agreement.noticePeriod });
  if (property.agreement?.agreementDuration)
    agRows.push({ icon: "calendar-outline", label: "Agreement", value: property.agreement.agreementDuration });

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setActiveImage(Math.round(e.nativeEvent.contentOffset.x / SW));
            }}
          >
            {images.length > 0 ? (
              images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={s.heroImage} contentFit="cover" transition={200} />
              ))
            ) : (
              <Image source={LiveetTenantHero} style={s.heroImage} contentFit="cover" />
            )}
          </ScrollView>
          {/* Simulated bottom gradient via stacked layers */}
          <View style={s.heroScrim0} pointerEvents="none" />
          <View style={s.heroScrim1} pointerEvents="none" />
          <View style={s.heroScrim2} pointerEvents="none" />
          <View style={s.heroScrim3} pointerEvents="none" />

          {/* Top controls */}
          <View style={[s.heroControls, { top: insets.top + 10 }]}>
            <TouchableOpacity style={s.heroBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={22} color={NAVY} />
            </TouchableOpacity>
            <TouchableOpacity style={s.heroBtn} onPress={handleVisit} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={18} color={NAVY} />
            </TouchableOpacity>
          </View>

          {/* Hero bottom text */}
          <View style={s.heroBottom}>
            <Text style={s.heroName} numberOfLines={2}>{property.name || "Unnamed Property"}</Text>
            {locationLine ? (
              <View style={s.heroLoc}>
                <Ionicons name="location-sharp" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={s.heroLocText}>{locationLine}</Text>
              </View>
            ) : null}
          </View>

          {images.length > 1 && (
            <View style={s.dots}>
              {images.map((_, i) => (
                <View key={i} style={[s.dot, i === activeImage && s.dotActive]} />
              ))}
            </View>
          )}
        </View>

        {/* Price + type bar */}
        <View style={s.priceBar}>
          <View>
            {rentRange ? (
              <View style={s.priceRow}>
                <Text style={s.priceText}>
                  ₹{formatAmount(rentRange.min)}
                  {rentRange.max !== rentRange.min ? `–₹${formatAmount(rentRange.max)}` : ""}
                </Text>
                <Text style={s.priceUnit}>/month</Text>
              </View>
            ) : (
              <Text style={s.priceNA}>Price on request</Text>
            )}
            {locationLine ? <Text style={s.priceSubText} numberOfLines={1}>{locationLine}</Text> : null}
          </View>
          {property.propertyType ? (
            <View style={s.typeChip}>
              <Ionicons name="bed-outline" size={16} color={NAVY} />
              <Text style={s.typeChipText}>{property.propertyType}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.sections}>
          {/* About */}
          {property.description ? (
            <View style={s.section}>
              <SectionHeader icon="information-circle-outline" title="About" />
              <Text style={s.description}>{property.description}</Text>
            </View>
          ) : null}

          {/* Room Types */}
          {property.roomOptions.length > 0 && (
            <View style={s.section}>
              <SectionHeader icon="grid-outline" title="Room Types" />
              <View style={s.chipWrap}>
                {property.roomOptions.map((r) => (
                  <View key={r._id} style={s.roomChip}>
                    <Text style={s.roomChipCat}>
                      {r.typeName?.trim() || CATEGORY_LABELS[r.category] || r.category}
                    </Text>
                    {r.rentAmount != null && r.rentAmount > 0 ? (
                      <Text style={s.roomChipRent}>₹{formatAmount(r.rentAmount)}/mo</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <View style={s.section}>
              <SectionHeader icon="options-outline" title="Amenities" />
              <View style={s.amenGrid}>
                {amenities.map((a) => (
                  <View key={a.label} style={s.amenItem}>
                    <View style={s.amenIconWrap}>
                      <Ionicons name={a.icon} size={16} color={NAVY} />
                    </View>
                    <Text style={s.amenLabel}>{a.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Who can stay */}
          {tenantTags.length > 0 && (
            <View style={s.section}>
              <SectionHeader icon="people-outline" title="Who Can Stay" />
              <View style={s.whoCard}>
                <View style={s.chipWrap}>
                  {tenantTags.map((t) => (
                    <View key={t} style={s.whoChip}>
                      <Ionicons name="checkmark" size={13} color={NAVY} />
                      <Text style={s.whoChipText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Best suited for */}
          {suitedFor.length > 0 && (
            <View style={s.section}>
              <SectionHeader icon="star-outline" title="Best Suited For" />
              <View style={s.suitedCard}>
                <View style={s.suitedOrb} />
                <View style={s.chipWrap}>
                  {suitedFor.map((t) => (
                    <View key={t} style={s.suitedChip}>
                      <Text style={s.suitedChipText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Agreement */}
          {agRows.length > 0 && (
            <View style={s.section}>
              <SectionHeader icon="document-text-outline" title="Agreement Details" />
              <View style={s.agCard}>
                {agRows.map((row, i) => (
                  <AgreementRow
                    key={row.label}
                    icon={row.icon}
                    label={row.label}
                    value={row.value}
                    last={i === agRows.length - 1}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Contact */}
          {(property.contactPhone || property.contactEmail) && (
            <View style={s.section}>
              <SectionHeader icon="call-outline" title="Contact" />
              <View style={s.agCard}>
                {property.contactPhone && (
                  <AgreementRow icon="call-outline" label="Phone" value={property.contactPhone} />
                )}
                {property.contactEmail && (
                  <AgreementRow icon="mail-outline" label="Email" value={property.contactEmail} last />
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <Modal
        visible={bookingStep > 0}
        animationType="slide"
        transparent
        onRequestClose={() => setBookingStep(0)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={s.modalSheet}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {bookingStep === 1 ? "Payment Details" : "Booking Request"}
              </Text>
              <TouchableOpacity onPress={() => setBookingStep(0)} style={s.modalClose}>
                <Ionicons name="close" size={22} color={NAVY} />
              </TouchableOpacity>
            </View>

            {bookingStep === 1 ? (
              /* Step 1: Bank Details */
              <ScrollView contentContainerStyle={s.modalContent} showsVerticalScrollIndicator={false}>
                <Text style={s.modalSubtitle}>
                  Transfer the booking amount to the operator's account below, then proceed to fill your details.
                </Text>

                {paymentLoading ? (
                  <ActivityIndicator size="large" color={NAVY} style={{ marginVertical: 32 }} />
                ) : paymentDetails ? (
                  <View style={s.bankCard}>
                    {paymentDetails.accountName && (
                      <View style={s.bankRow}>
                        <View style={s.bankIconWrap}>
                          <Ionicons name="person-outline" size={16} color={NAVY} />
                        </View>
                        <View style={s.bankInfo}>
                          <Text style={s.bankLabel}>Account Name</Text>
                          <Text style={s.bankValue}>{paymentDetails.accountName}</Text>
                        </View>
                      </View>
                    )}
                    {paymentDetails.accountNumber && (
                      <View style={[s.bankRow, s.bankRowBorder]}>
                        <View style={s.bankIconWrap}>
                          <Ionicons name="card-outline" size={16} color={NAVY} />
                        </View>
                        <View style={s.bankInfo}>
                          <Text style={s.bankLabel}>Account Number</Text>
                          <Text style={s.bankValue}>{paymentDetails.accountNumber}</Text>
                        </View>
                      </View>
                    )}
                    {paymentDetails.ifscCode && (
                      <View style={[s.bankRow, s.bankRowBorder]}>
                        <View style={s.bankIconWrap}>
                          <Ionicons name="business-outline" size={16} color={NAVY} />
                        </View>
                        <View style={s.bankInfo}>
                          <Text style={s.bankLabel}>IFSC Code</Text>
                          <Text style={s.bankValue}>{paymentDetails.ifscCode}</Text>
                        </View>
                      </View>
                    )}
                    {paymentDetails.upiId && (
                      <View style={[s.bankRow, s.bankRowBorder]}>
                        <View style={s.bankIconWrap}>
                          <Ionicons name="qr-code-outline" size={16} color={NAVY} />
                        </View>
                        <View style={s.bankInfo}>
                          <Text style={s.bankLabel}>UPI ID</Text>
                          <Text style={s.bankValue}>{paymentDetails.upiId}</Text>
                        </View>
                      </View>
                    )}
                    {paymentDetails.qrImageUrl && (
                      <View style={[s.bankRow, s.bankRowBorder, { flexDirection: "column", alignItems: "center", paddingVertical: 16 }]}>
                        <Text style={[s.bankLabel, { marginBottom: 10 }]}>Scan QR to Pay</Text>
                        <Image
                          source={{ uri: paymentDetails.qrImageUrl }}
                          style={{ width: 180, height: 180, borderRadius: 12 }}
                          contentFit="contain"
                        />
                      </View>
                    )}
                    {!paymentDetails.accountName && !paymentDetails.accountNumber && !paymentDetails.upiId && !paymentDetails.qrImageUrl && (
                      <Text style={s.noPaymentText}>No payment details added by the operator yet. Proceed to submit your request.</Text>
                    )}
                  </View>
                ) : (
                  <Text style={s.noPaymentText}>No payment details available for this property.</Text>
                )}

                <TouchableOpacity
                  style={s.proceedBtn}
                  onPress={() => setBookingStep(2)}
                  activeOpacity={0.85}
                >
                  <Text style={s.proceedBtnText}>Proceed to Fill Details</Text>
                  <Ionicons name="arrow-forward" size={18} color={ACCENT_TEXT} />
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* Step 2: Student Form */
              <ScrollView contentContainerStyle={s.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={s.formSection}>Student Details</Text>
                <TextInput
                  style={s.input}
                  placeholder="Student Name *"
                  placeholderTextColor={MUTED}
                  value={form.studentName}
                  onChangeText={(v) => setForm((f) => ({ ...f, studentName: v }))}
                />
                <TextInput
                  style={s.input}
                  placeholder="Student Phone Number *"
                  placeholderTextColor={MUTED}
                  keyboardType="phone-pad"
                  value={form.studentPhone}
                  onChangeText={(v) => setForm((f) => ({ ...f, studentPhone: v }))}
                />
                <TextInput
                  style={s.input}
                  placeholder="Student Email"
                  placeholderTextColor={MUTED}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={form.studentEmail}
                  onChangeText={(v) => setForm((f) => ({ ...f, studentEmail: v }))}
                />
                <TextInput
                  style={s.input}
                  placeholder="Course"
                  placeholderTextColor={MUTED}
                  value={form.course}
                  onChangeText={(v) => setForm((f) => ({ ...f, course: v }))}
                />
                <TextInput
                  style={s.input}
                  placeholder="Year of Study (e.g. 1st, 2nd)"
                  placeholderTextColor={MUTED}
                  value={form.yearOfStudy}
                  onChangeText={(v) => setForm((f) => ({ ...f, yearOfStudy: v }))}
                />

                <Text style={[s.formSection, { marginTop: 8 }]}>Parent Details</Text>
                <TextInput
                  style={s.input}
                  placeholder="Parent Name"
                  placeholderTextColor={MUTED}
                  value={form.parentName}
                  onChangeText={(v) => setForm((f) => ({ ...f, parentName: v }))}
                />
                <TextInput
                  style={s.input}
                  placeholder="Parent Phone Number"
                  placeholderTextColor={MUTED}
                  keyboardType="phone-pad"
                  value={form.parentPhone}
                  onChangeText={(v) => setForm((f) => ({ ...f, parentPhone: v }))}
                />
                <TextInput
                  style={s.input}
                  placeholder="Parent Email"
                  placeholderTextColor={MUTED}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={form.parentEmail}
                  onChangeText={(v) => setForm((f) => ({ ...f, parentEmail: v }))}
                />

                <Text style={[s.formSection, { marginTop: 8 }]}>Move-in Preferences</Text>
                <TextInput
                  style={s.input}
                  placeholder="Move-in Date * (e.g. 15 July 2025)"
                  placeholderTextColor={MUTED}
                  value={form.moveInDate}
                  onChangeText={(v) => setForm((f) => ({ ...f, moveInDate: v }))}
                />

                <Text style={s.prefLabel}>Food Preference</Text>
                <View style={s.prefRow}>
                  {["Veg", "Non-Veg"].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[s.prefChip, form.foodPreference === opt && s.prefChipActive]}
                      onPress={() => setForm((f) => ({ ...f, foodPreference: f.foodPreference === opt ? "" : opt }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.prefChipText, form.foodPreference === opt && s.prefChipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.formSection, { marginTop: 8 }]}>Payment Proof *</Text>
                <Text style={[s.bankLabel, { marginBottom: 10 }]}>
                  Upload a screenshot or photo of your payment receipt.
                </Text>
                <TouchableOpacity
                  style={s.proofUploadBtn}
                  onPress={pickPaymentProof}
                  disabled={uploadingProof}
                  activeOpacity={0.8}
                >
                  {uploadingProof ? (
                    <ActivityIndicator size="small" color={NAVY} />
                  ) : paymentProofUri ? (
                    <Image
                      source={{ uri: paymentProofUri }}
                      style={s.proofPreview}
                      contentFit="cover"
                    />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={24} color={NAVY} />
                      <Text style={s.proofUploadText}>Tap to upload payment proof</Text>
                    </>
                  )}
                </TouchableOpacity>
                {paymentProofUri && (
                  <TouchableOpacity
                    style={s.proofChangeBtn}
                    onPress={pickPaymentProof}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh-outline" size={14} color={MUTED} />
                    <Text style={s.backStepText}>Change image</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[s.proceedBtn, { marginTop: 20 }]}
                  onPress={handleSubmitBooking}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={ACCENT_TEXT} />
                  ) : (
                    <>
                      <Text style={s.proceedBtnText}>Submit Booking Request</Text>
                      <Ionicons name="checkmark-circle-outline" size={18} color={ACCENT_TEXT} />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.backStepBtn}
                  onPress={() => setBookingStep(1)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-back" size={16} color={MUTED} />
                  <Text style={s.backStepText}>Back to Payment Details</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sticky CTA */}
      <View style={[s.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={s.visitBtn} onPress={handleVisit} activeOpacity={0.85}>
          <Ionicons name="calendar-outline" size={18} color={NAVY} />
          <Text style={s.visitBtnText}>Visit Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.bookBtn} onPress={handleBookNow} activeOpacity={0.85}>
          <Ionicons name="home-outline" size={18} color={ACCENT_TEXT} />
          <Text style={s.bookBtnText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 16, color: MUTED },
  scroll: { flex: 1 },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  hero: { height: HERO_H, backgroundColor: SURFACE, position: "relative" },
  heroImage: { width: SW, height: HERO_H },
  heroScrim0: { position: "absolute", bottom: 0, left: 0, right: 0, height: 160, backgroundColor: "rgba(15,23,42,0.05)" },
  heroScrim1: { position: "absolute", bottom: 0, left: 0, right: 0, height: 110, backgroundColor: "rgba(15,23,42,0.12)" },
  heroScrim2: { position: "absolute", bottom: 0, left: 0, right: 0, height: 70,  backgroundColor: "rgba(15,23,42,0.22)" },
  heroScrim3: { position: "absolute", bottom: 0, left: 0, right: 0, height: 40,  backgroundColor: "rgba(15,23,42,0.30)" },
  heroControls: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  heroBottom: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 16,
  },
  heroName: {
    fontSize: 24,
    fontWeight: "800",
    color: WHITE,
    letterSpacing: -0.5,
    lineHeight: 28,
    marginBottom: 6,
  },
  heroLoc: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroLocText: { fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.9)", flex: 1 },
  dots: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  dotActive: { backgroundColor: WHITE, width: 16 },
  priceBar: {
    margin: 16,
    marginBottom: 4,
    padding: 16,
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  priceText: { fontSize: 24, fontWeight: "800", color: NAVY, letterSpacing: -0.6 },
  priceUnit: { fontSize: 13, fontWeight: "600", color: MUTED },
  priceNA: { fontSize: 16, fontWeight: "600", color: MUTED },
  priceSubText: { fontSize: 12, color: MUTED, marginTop: 3, maxWidth: SW * 0.55 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: SURFACE,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 13,
  },
  typeChipText: { fontSize: 13, fontWeight: "700", color: NAVY },
  sections: { paddingHorizontal: 20, paddingTop: 14 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15.5, fontWeight: "700", color: NAVY, letterSpacing: -0.3 },
  description: { fontSize: 14, color: NAVY, lineHeight: 22 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roomChip: {
    backgroundColor: SURFACE,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  roomChipCat: { fontSize: 13, fontWeight: "600", color: NAVY },
  roomChipRent: { fontSize: 12, fontWeight: "500", color: colors.positiveAmount, marginTop: 2 },
  amenGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  amenItem: {
    width: (SW - 40 - 9) / 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  amenIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  amenLabel: { flex: 1, fontSize: 12.5, fontWeight: "600", color: NAVY, lineHeight: 16 },
  whoCard: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 15,
  },
  whoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  whoChipText: { fontSize: 12.5, fontWeight: "700", color: NAVY },
  suitedCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 16,
    overflow: "hidden",
  },
  suitedOrb: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(212,245,66,0.07)",
  },
  suitedChip: {
    backgroundColor: "rgba(212,245,66,0.16)",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  suitedChipText: { fontSize: 11.5, fontWeight: "700", color: ACCENT },
  agCard: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    overflow: "hidden",
  },
  agRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  agRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  agIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  agLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: MUTED },
  agValue: { fontSize: 13.5, fontWeight: "700", color: NAVY, textAlign: "right", maxWidth: SW * 0.4 },
  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "transparent",
    flexDirection: "row",
    gap: 10,
  },
  visitBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  visitBtnText: { fontSize: 15, fontWeight: "700", color: NAVY },
  bookBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  bookBtnText: { fontSize: 15.5, fontWeight: "800", color: ACCENT_TEXT, letterSpacing: 0.1 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: NAVY },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  modalSubtitle: { fontSize: 13.5, color: MUTED, lineHeight: 20, marginBottom: 18 },

  // Bank card
  bankCard: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  bankRowBorder: { borderTopWidth: 1, borderTopColor: BORDER },
  bankIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  bankInfo: { flex: 1 },
  bankLabel: { fontSize: 12, fontWeight: "600", color: MUTED, marginBottom: 2 },
  bankValue: { fontSize: 14.5, fontWeight: "700", color: NAVY },
  noPaymentText: { fontSize: 14, color: MUTED, lineHeight: 20, marginBottom: 20, textAlign: "center" },

  // Proceed button
  proceedBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  proceedBtnText: { fontSize: 15, fontWeight: "800", color: ACCENT_TEXT },

  // Form
  formSection: { fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: 10 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 14,
    color: NAVY,
    backgroundColor: WHITE,
    marginBottom: 10,
  },
  prefLabel: { fontSize: 13, fontWeight: "600", color: MUTED, marginBottom: 8 },
  prefRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  prefChip: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE,
  },
  prefChipActive: { borderColor: NAVY, backgroundColor: NAVY },
  prefChipText: { fontSize: 14, fontWeight: "700", color: MUTED },
  prefChipTextActive: { color: WHITE },

  // Back step
  backStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
  },
  backStepText: { fontSize: 13, fontWeight: "600", color: MUTED },

  // Payment proof upload
  proofUploadBtn: {
    height: 120,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  proofUploadText: { fontSize: 13.5, fontWeight: "600", color: MUTED },
  proofPreview: { width: "100%", height: "100%" },
  proofChangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginBottom: 8,
    paddingVertical: 4,
  },
});
