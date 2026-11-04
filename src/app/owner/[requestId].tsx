import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfferField } from '@/components/dallni/offer-field';
import { OrderProgress } from '@/components/dallni/order-progress';
import { SampleRequestImage } from '@/components/dallni/sample-request-image';
import {
  ConfirmationPanel,
  DALLNI_COLORS,
  FlowHeader,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import {
  ORDER_STAGES,
  useDemoSession,
  type DemoOffer,
} from '@/context/demo-session';
import { mockShopRequests } from '@/data/shop-requests';
import { normalizeInternationalWhatsAppNumber } from '@/utils/whatsapp';

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

function normalizePrice(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[٫،,]/g, '.')
    .replace(/[$\s]/g, '');
}

export default function ShopRequestDetailScreen() {
  const {
    approvedRequests,
    confirmOffer,
    shopProfile,
    updateOrderStage,
  } = useDemoSession();
  const { requestId } = useLocalSearchParams<{ requestId: string | string[] }>();
  const id = Array.isArray(requestId) ? requestId[0] : requestId;
  const customerRequest = approvedRequests.find((item) => item.id === id);
  const sampleRequest = mockShopRequests.find((item) => item.id === id);
  const request = customerRequest ?? sampleRequest;
  const selectedOffer = customerRequest?.offers.find(
    (offer) => offer.id === customerRequest.selectedOfferId,
  );
  const currentOrderStage = customerRequest?.orderStage ?? null;
  const currentStageIndex = currentOrderStage
    ? ORDER_STAGES.findIndex((stage) => stage.id === currentOrderStage)
    : -1;
  const nextOrderStage = ORDER_STAGES[currentStageIndex + 1];
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [sampleOffers, setSampleOffers] = useState<DemoOffer[]>([]);
  const [draftOpen, setDraftOpen] = useState(
    !customerRequest || customerRequest.offers.length === 0,
  );
  const [latestOfferId, setLatestOfferId] = useState<string | null>(null);
  const requestOffers = customerRequest?.offers ?? sampleOffers;

  const normalizedWhatsAppNumber = normalizeInternationalWhatsAppNumber(
    shopProfile.whatsappNumber,
  );
  const normalizedPrice = normalizePrice(price);
  const numericPrice = Number(normalizedPrice);
  const canConfirm =
    shopProfile.shopName.trim().length > 0 &&
    normalizedWhatsAppNumber !== null &&
    itemName.trim().length > 0 &&
    deliveryNote.trim().length > 0 &&
    Number.isFinite(numericPrice) &&
    numericPrice > 0;

  function saveDraftOffer() {
    if (!canConfirm || !normalizedWhatsAppNumber) return;
    const offerDraft = {
      shopName: shopProfile.shopName.trim(),
      whatsappNumber: normalizedWhatsAppNumber,
      shopLocation: shopProfile.location.trim(),
      itemName: itemName.trim(),
      price: normalizedPrice,
      deliveryNote: deliveryNote.trim(),
    };

    if (customerRequest) {
      setLatestOfferId(confirmOffer(customerRequest.id, offerDraft));
    } else {
      const localOffer = {
        ...offerDraft,
        id: `sample-offer-${Date.now()}-${sampleOffers.length}`,
      };
      setSampleOffers((current) => [...current, localOffer]);
      setLatestOfferId(localOffer.id);
    }

    setItemName('');
    setPrice('');
    setDeliveryNote('');
    setDraftOpen(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="تفاصيل الطلب"
        subtitle="راجع الطلب والصورة قبل ما تحضّر عرضك."
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {!request ? (
            <SurfaceCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>ما لقينا هالطلب التجريبي.</Text>
              <Text style={styles.emptyText}>ارجع لصندوق الطلبات واختار طلب تاني.</Text>
              <PrimaryButton label="رجوع للطلبات" onPress={() => router.back()} />
            </SurfaceCard>
          ) : (
            <>
              {customerRequest?.imageUri ? (
                <Image
                  accessibilityLabel="الصورة التي أرفقها صاحب الطلب"
                  source={{ uri: customerRequest.imageUri }}
                  style={styles.requestImage}
                  resizeMode="contain"
                />
              ) : sampleRequest ? (
                <SampleRequestImage
                  emoji={sampleRequest.imageEmoji}
                  backgroundColor={sampleRequest.imageBackground}
                  variant="large"
                />
              ) : (
                <View style={styles.noImage}>
                  <Text style={styles.noImageText}>ما في صورة مرفقة لهالطلب</Text>
                </View>
              )}

              <SurfaceCard style={styles.requestCard}>
                <View style={styles.requestMetaTop}>
                  <Text style={styles.category}>
                    {customerRequest ? 'طلب جديد من زبون' : sampleRequest?.category}
                  </Text>
                  <Text style={styles.received}>
                    {customerRequest ? 'موافَق عليه بهالجلسة' : sampleRequest?.received}
                  </Text>
                </View>
                <Text style={styles.requestTitle}>{request.title}</Text>
                <Text style={styles.description}>
                  {customerRequest?.details ||
                    sampleRequest?.description ||
                    'طلب مع صورة مرفقة، بلا تفاصيل مكتوبة.'}
                </Text>

                {customerRequest && (
                  <View style={styles.customerRequestFacts}>
                    <SummaryLine label="فئة الطلب" value={customerRequest.category} />
                    <SummaryLine label="منطقة الطلب" value={customerRequest.area} />
                  </View>
                )}

                {sampleRequest && (
                  <View style={styles.requestFacts}>
                    <View style={styles.fact}>
                      <Text style={styles.factLabel}>المنطقة</Text>
                      <Text style={styles.factValue}>{sampleRequest.location}</Text>
                    </View>
                    <View style={styles.factDivider} />
                    <View style={styles.fact}>
                      <Text style={styles.factLabel}>الميزانية المتوقعة</Text>
                      <Text style={styles.factValue}>{sampleRequest.budgetLabel}</Text>
                    </View>
                  </View>
                )}
              </SurfaceCard>

              <SurfaceCard style={styles.offerCard}>
                <Text style={styles.offerTitle}>عروض المحلات</Text>
                <Text style={styles.offerSubtitle}>
                  كل تأكيد بيضيف عرض تجريبي جديد لهالطلب.
                </Text>

                <View style={styles.profileSummary}>
                  <Text style={styles.profileSummaryTitle}>
                    بيانات العرض من ملف المحل
                  </Text>
                  <Text style={styles.profileSummaryText}>
                    {shopProfile.shopName || 'اسم المحل غير محدد'}
                  </Text>
                  <Text style={styles.profileSummaryText}>
                    {shopProfile.location || 'الموقع غير محدد'}
                  </Text>
                  {shopProfile.productCategories.length > 0 && (
                    <Text style={styles.profileSummaryText}>
                      {shopProfile.productCategories.join('، ')}
                    </Text>
                  )}
                  <Text style={styles.profileSummaryText}>
                    {shopProfile.whatsappNumber || 'رقم واتساب غير محدد'}
                  </Text>
                  {(!shopProfile.shopName.trim() || !normalizedWhatsAppNumber) && (
                    <Text style={styles.profileSummaryWarning}>
                      احفظ اسم المحل ورقم واتساب دولي صالح بملف المحل قبل إضافة عرض.
                    </Text>
                  )}
                  <PrimaryButton
                    label="تعديل ملف المحل"
                    onPress={() => router.push('/owner/profile')}
                  />
                </View>

                {latestOfferId && (
                  <ConfirmationPanel>
                    <Text style={styles.confirmationTitle}>تمّت إضافة العرض</Text>
                    <Text style={styles.confirmationText}>
                      {customerRequest
                        ? 'صار ظاهر بقائمة عروض الزبون بهالجلسة. ما انبعت لزبون حقيقي وبيختفي لما تسكّر التطبيق.'
                        : 'هيدا عرض تجريبي، وما انبعت لأي زبون حقيقي.'}
                    </Text>
                  </ConfirmationPanel>
                )}

                {requestOffers.length > 0 && (
                  <View style={styles.savedOffers}>
                    <Text style={styles.savedOffersTitle}>العروض المضافة</Text>
                    {requestOffers.map((offer) => {
                      const isSelected = customerRequest?.selectedOfferId === offer.id;

                      return (
                      <View
                        key={offer.id}
                        style={[styles.offerSummary, isSelected && styles.selectedOfferSummary]}>
                        {isSelected && (
                          <Text style={styles.selectedOfferTag}>اختاره الزبون</Text>
                        )}
                        <SummaryLine label="المحل" value={offer.shopName} />
                        <SummaryLine label="الموقع" value={offer.shopLocation || 'غير محدد'} />
                        <SummaryLine label="المنتج" value={offer.itemName} />
                        <SummaryLine label="السعر" value={offer.price + ' $'} />
                        <SummaryLine label="التوصيل" value={offer.deliveryNote} />
                        <SummaryLine label="واتساب" value={offer.whatsappNumber} />
                      </View>
                      );
                    })}
                  </View>
                )}

                {selectedOffer && currentOrderStage && customerRequest && (
                  <View style={styles.orderProgressSection}>
                    <Text style={styles.orderProgressTitle}>العرض اللي اختاره الزبون</Text>
                    <View style={[styles.offerSummary, styles.selectedOfferSummary]}>
                      <SummaryLine label="المحل" value={selectedOffer.shopName} />
                      <SummaryLine
                        label="الموقع"
                        value={selectedOffer.shopLocation || 'غير محدد'}
                      />
                      <SummaryLine label="المنتج" value={selectedOffer.itemName} />
                      <SummaryLine label="السعر" value={selectedOffer.price + ' $'} />
                      <SummaryLine label="التوصيل" value={selectedOffer.deliveryNote} />
                    </View>
                    <OrderProgress stage={currentOrderStage} />
                    {nextOrderStage ? (
                      <PrimaryButton
                        label={'تحديث الحالة إلى: ' + nextOrderStage.label}
                        onPress={() =>
                          updateOrderStage(customerRequest.id, nextOrderStage.id)
                        }
                      />
                    ) : (
                      <Text style={styles.completedNote}>
                        اكتمل الطلب التجريبي بهالجلسة.
                      </Text>
                    )}
                  </View>
                )}

                {draftOpen ? (
                  <View style={styles.form}>
                    <Text style={styles.formHeading}>حضّر عرض جديد</Text>
                    <OfferField
                      label="اسم المنتج"
                      placeholder="مثلاً: Samsung Galaxy A54"
                      value={itemName}
                      onChangeText={setItemName}
                      maxLength={80}
                    />
                    <OfferField
                      label="السعر بالدولار"
                      placeholder="مثلاً: ٢٣٠"
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="decimal-pad"
                      maxLength={10}
                    />
                    <OfferField
                      label="ملاحظة التوصيل"
                      placeholder="مثلاً: توصيل لجونية خلال يومين"
                      value={deliveryNote}
                      onChangeText={setDeliveryNote}
                      multiline
                      maxLength={140}
                    />

                    <View style={styles.demoNote}>
                      <Text style={styles.demoNoteIcon}>ⓘ</Text>
                      <Text style={styles.demoNoteText}>
                        العرض بيظهر للزبون بهالجلسة التجريبية بس، وبينمسح لما تسكّر التطبيق.
                      </Text>
                    </View>
                    <PrimaryButton
                      disabled={!canConfirm}
                      label="إضافة العرض التجريبي"
                      onPress={saveDraftOffer}
                    />
                  </View>
                ) : (
                  <PrimaryButton
                    label="إضافة عرض تجريبي تاني"
                    onPress={() => {
                      setLatestOfferId(null);
                      setDraftOpen(true);
                    }}
                  />
                )}
              </SurfaceCard>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: DALLNI_COLORS.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  requestCard: {
    gap: 8,
    padding: 16,
  },
  requestImage: {
    alignSelf: 'stretch',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 18,
    height: 205,
    width: '100%',
  },
  noImage: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 18,
    height: 120,
    justifyContent: 'center',
  },
  noImageText: {
    color: DALLNI_COLORS.muted,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  requestMetaTop: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  category: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 10,
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    writingDirection: 'rtl',
  },
  received: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    writingDirection: 'rtl',
  },
  requestTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  description: {
    color: '#566C62',
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  customerRequestFacts: {
    backgroundColor: '#F7F9F8',
    borderRadius: 13,
    gap: 8,
    marginTop: 5,
    padding: 12,
  },
  requestFacts: {
    alignItems: 'center',
    backgroundColor: '#F7F9F8',
    borderRadius: 13,
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  fact: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 4,
  },
  factDivider: {
    backgroundColor: DALLNI_COLORS.border,
    height: 30,
    marginHorizontal: 8,
    width: 1,
  },
  factLabel: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    writingDirection: 'rtl',
  },
  factValue: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  offerCard: {
    gap: 7,
    padding: 16,
  },
  offerTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  offerSubtitle: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileSummary: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: '#D5EAE0',
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  profileSummaryTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileSummaryText: {
    color: DALLNI_COLORS.ink,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  profileSummaryWarning: {
    color: '#A3493C',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  savedOffers: {
    gap: 9,
  },
  savedOffersTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  form: {
    gap: 13,
    paddingTop: 5,
  },
  formHeading: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  demoNote: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 7,
    paddingHorizontal: 3,
  },
  demoNoteIcon: {
    color: DALLNI_COLORS.green,
    fontSize: 16,
    lineHeight: 19,
  },
  demoNoteText: {
    color: DALLNI_COLORS.muted,
    flex: 1,
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  confirmationTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  confirmationText: {
    color: DALLNI_COLORS.ink,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  offerSummary: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 12,
    gap: 8,
    marginTop: 5,
    padding: 11,
  },
  selectedOfferSummary: {
    borderColor: DALLNI_COLORS.green,
    borderWidth: 1,
  },
  selectedOfferTag: {
    color: DALLNI_COLORS.green,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  orderProgressSection: {
    gap: 10,
  },
  orderProgressTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  completedNote: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  summaryLine: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryLabel: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  summaryValue: {
    color: DALLNI_COLORS.ink,
    flex: 1,
    fontSize: 11,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  emptyCard: {
    alignItems: 'flex-end',
    gap: 10,
  },
  emptyTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emptyText: {
    color: DALLNI_COLORS.muted,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
