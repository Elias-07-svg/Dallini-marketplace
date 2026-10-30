import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import { CustomerRating } from '@/components/dallni/customer-rating';
import { OrderProgress } from '@/components/dallni/order-progress';
import {
  ConfirmationPanel,
  DALLNI_COLORS,
  FlowHeader,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import {
  customerMarketplaceErrorCode,
  loadCustomerMarketplace,
  removeCustomerWhatsAppNumber,
  saveCustomerWhatsAppNumber,
  selectCustomerOffer,
  submitCustomerRating,
  type CustomerMarketplaceEntry,
} from '@/lib/customer-marketplace-supabase';
import {
  createWhatsAppClickToChatUrl,
  normalizeInternationalWhatsAppNumber,
} from '@/utils/whatsapp';

type ConnectedCustomerRequestsProps = { customerId: string };

export function ConnectedCustomerRequests({ customerId }: ConnectedCustomerRequestsProps) {
  const [entries, setEntries] = useState<CustomerMarketplaceEntry[]>([]);
  const [pendingOfferIds, setPendingOfferIds] = useState<Record<string, string>>({});
  const [confirmedOfferIds, setConfirmedOfferIds] = useState<Record<string, string>>({});
  const [selectionErrorCodes, setSelectionErrorCodes] = useState<Record<string, string>>({});
  const [selectionRefreshErrorCodes, setSelectionRefreshErrorCodes] = useState<Record<string, string>>({});
  const [ratingErrorCodes, setRatingErrorCodes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectingOfferId, setSelectingOfferId] = useState<string | null>(null);
  const [savingRatingOrderId, setSavingRatingOrderId] = useState<string | null>(null);
  const [savingCustomerContactOrderId, setSavingCustomerContactOrderId] = useState<string | null>(null);
  const [customerContactErrorCodes, setCustomerContactErrorCodes] = useState<Record<string, string>>({});
  const [customerContactDrafts, setCustomerContactDrafts] = useState<Record<string, string>>({});
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      return { entries: await loadCustomerMarketplace(customerId), errorCode: null };
    } catch (error) {
      return { entries: [], errorCode: customerMarketplaceErrorCode(error) };
    }
  }, [customerId]);

  useFocusEffect(useCallback(() => {
    let isCurrent = true;
    void loadData().then((result) => {
      if (!isCurrent) return;
      setEntries(result.entries);
      setErrorCode(result.errorCode);
      if (!result.errorCode) setSelectionRefreshErrorCodes({});
      setIsLoading(false);
      setIsRefreshing(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [loadData]));

  async function refresh() {
    setErrorCode(null);
    setIsLoading(false);
    setIsRefreshing(true);
    const result = await loadData();
    setEntries(result.entries);
    setErrorCode(result.errorCode);
    if (!result.errorCode) setSelectionRefreshErrorCodes({});
    setIsRefreshing(false);
  }

  async function confirmOffer(requestId: string, offerId: string) {
    setSelectingOfferId(offerId);
    setSelectionErrorCodes((current) => {
      const next = { ...current };
      delete next[requestId];
      return next;
    });

    try {
      await selectCustomerOffer(requestId, offerId);
    } catch (error) {
      const code = customerMarketplaceErrorCode(error);
      setSelectionErrorCodes((current) => ({ ...current, [requestId]: code }));
      setSelectingOfferId(null);
      return;
    }

    setConfirmedOfferIds((current) => ({ ...current, [requestId]: offerId }));
    setPendingOfferIds((current) => ({ ...current, [requestId]: offerId }));
    try {
      const refreshedEntries = await loadCustomerMarketplace(customerId);
      if (refreshedEntries.some((entry) => entry.request.id === requestId)) {
        setEntries(refreshedEntries);
        setErrorCode(null);
        setSelectionRefreshErrorCodes((current) => {
          const next = { ...current };
          delete next[requestId];
          return next;
        });
      } else {
        setSelectionRefreshErrorCodes((current) => ({
          ...current,
          [requestId]: 'REFRESH_AFTER_SELECTION',
        }));
      }
    } catch (error) {
      setSelectionRefreshErrorCodes((current) => ({
        ...current,
        [requestId]: customerMarketplaceErrorCode(error),
      }));
    }
    setSelectingOfferId(null);
  }

  async function saveRating(entry: CustomerMarketplaceEntry, stars: number, comment: string) {
    const order = entry.order;
    if (!order || order.stage !== 'completed' || entry.rating || savingRatingOrderId) return;

    setSavingRatingOrderId(order.id);
    setRatingErrorCodes((current) => {
      const next = { ...current };
      delete next[entry.request.id];
      return next;
    });

    try {
      const rating = await submitCustomerRating({
        orderId: order.id,
        shopId: order.shop_id,
        stars,
        comment,
      });
      setEntries((current) => current.map((currentEntry) => (
        currentEntry.request.id === entry.request.id
          ? { ...currentEntry, rating }
          : currentEntry
      )));
    } catch (error) {
      const code = customerMarketplaceErrorCode(error);
      setRatingErrorCodes((current) => ({ ...current, [entry.request.id]: code }));
      if (code === '23505') {
        const refreshedEntries = await loadCustomerMarketplace(customerId).catch(() => null);
        if (refreshedEntries) setEntries(refreshedEntries);
      }
    } finally {
      setSavingRatingOrderId(null);
    }
  }

  async function saveCustomerContact(entry: CustomerMarketplaceEntry, whatsappNumber: string) {
    if (!entry.order || savingCustomerContactOrderId) return;
    setSavingCustomerContactOrderId(entry.order.id);
    setCustomerContactErrorCodes((current) => {
      const next = { ...current };
      delete next[entry.request.id];
      return next;
    });

    try {
      const contact = await saveCustomerWhatsAppNumber({
        orderId: entry.order.id,
        customerId,
        whatsappNumber,
      });
      setEntries((current) => current.map((currentEntry) => (
        currentEntry.order?.id === entry.order?.id
          ? { ...currentEntry, customerWhatsAppNumber: contact.whatsapp_number }
          : currentEntry
      )));
      setCustomerContactDrafts((current) => ({
        ...current,
        [entry.request.id]: contact.whatsapp_number,
      }));
    } catch (error) {
      setCustomerContactErrorCodes((current) => ({
        ...current,
        [entry.request.id]: customerMarketplaceErrorCode(error),
      }));
    } finally {
      setSavingCustomerContactOrderId(null);
    }
  }

  async function removeCustomerContact(entry: CustomerMarketplaceEntry) {
    if (!entry.order || savingCustomerContactOrderId) return;
    setSavingCustomerContactOrderId(entry.order.id);
    setCustomerContactErrorCodes((current) => {
      const next = { ...current };
      delete next[entry.request.id];
      return next;
    });

    try {
      await removeCustomerWhatsAppNumber(entry.order.id, customerId);
      setEntries((current) => current.map((currentEntry) => (
        currentEntry.order?.id === entry.order?.id
          ? { ...currentEntry, customerWhatsAppNumber: null }
          : currentEntry
      )));
      setCustomerContactDrafts((current) => ({ ...current, [entry.request.id]: '' }));
    } catch (error) {
      setCustomerContactErrorCodes((current) => ({
        ...current,
        [entry.request.id]: customerMarketplaceErrorCode(error),
      }));
    } finally {
      setSavingCustomerContactOrderId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="طلباتي والعروض"
        subtitle="طلبات حسابك وعروضها المحفوظة بقاعدة بيانات Supabase."
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>صندوق حسابك المتصل</Text>
          <Text style={styles.noticeText}>
            العروض تتحدّث عند الضغط على زر التحديث. رقم واتساب ما بينطلب إلا بعد ما يتسجل اختيارك للعرض.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isRefreshing || selectingOfferId !== null || savingRatingOrderId !== null || savingCustomerContactOrderId !== null}
            onPress={refresh}
            style={({ pressed }) => [
              styles.refreshButton,
              (isRefreshing || selectingOfferId !== null || savingCustomerContactOrderId !== null) && styles.disabledButton,
              pressed && !isRefreshing && styles.pressed,
            ]}>
            <Text style={styles.refreshText}>{isRefreshing ? 'عم نحدّث…' : 'تحديث الطلبات والعروض'}</Text>
          </Pressable>
        </SurfaceCard>

        {isLoading ? (
          <SurfaceCard style={styles.stateCard}>
            <ActivityIndicator color={DALLNI_COLORS.green} />
            <Text style={styles.stateText}>عم نحمّل طلباتك والعروض المسموح لحسابك يشوفها…</Text>
          </SurfaceCard>
        ) : errorCode ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما قدرنا نحمّل طلباتك</Text>
            <Text style={styles.stateText}>رمز الخطأ: {errorCode}. تأكد إن مشروع Supabase متاح وحاول من جديد.</Text>
            <PrimaryButton label="إعادة المحاولة" onPress={refresh} />
          </SurfaceCard>
        ) : entries.length === 0 ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما عندك طلبات محفوظة بهالحساب بعد</Text>
            <Text style={styles.stateText}>قدّم طلباً جديداً ووافق على مشاركته حتى تبدأ العروض بالوصول.</Text>
            <PrimaryButton label="ابدأ طلب جديد" onPress={() => router.push('/request')} />
          </SurfaceCard>
        ) : entries.map((entry) => (
          <CustomerRequestCard
            key={entry.request.id}
            entry={entry}
            pendingOfferId={pendingOfferIds[entry.request.id] ?? null}
            locallyConfirmedOfferId={confirmedOfferIds[entry.request.id] ?? null}
            selectionErrorCode={selectionErrorCodes[entry.request.id] ?? null}
            selectionRefreshErrorCode={selectionRefreshErrorCodes[entry.request.id] ?? null}
            selectingOfferId={selectingOfferId}
            savingRatingOrderId={savingRatingOrderId}
            savingCustomerContactOrderId={savingCustomerContactOrderId}
            ratingErrorCode={ratingErrorCodes[entry.request.id] ?? null}
            customerContactErrorCode={customerContactErrorCodes[entry.request.id] ?? null}
            customerWhatsAppDraft={customerContactDrafts[entry.request.id] ?? entry.customerWhatsAppNumber ?? ''}
            onCustomerWhatsAppChange={(value) => setCustomerContactDrafts((current) => ({
              ...current,
              [entry.request.id]: value,
            }))}
            onChoose={(offerId) => setPendingOfferIds((current) => ({
              ...current,
              [entry.request.id]: offerId,
            }))}
            onConfirm={() => {
              const offerId = pendingOfferIds[entry.request.id];
              if (offerId) void confirmOffer(entry.request.id, offerId);
            }}
            onSubmitRating={(stars, comment) => void saveRating(entry, stars, comment)}
            onSaveCustomerContact={(whatsappNumber) => void saveCustomerContact(entry, whatsappNumber)}
            onRemoveCustomerContact={() => void removeCustomerContact(entry)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function CustomerRequestCard({
  entry,
  pendingOfferId,
  locallyConfirmedOfferId,
  selectionErrorCode,
  selectionRefreshErrorCode,
  selectingOfferId,
  savingRatingOrderId,
  savingCustomerContactOrderId,
  ratingErrorCode,
  customerContactErrorCode,
  customerWhatsAppDraft,
  onChoose,
  onConfirm,
  onSubmitRating,
  onSaveCustomerContact,
  onRemoveCustomerContact,
  onCustomerWhatsAppChange,
}: {
  entry: CustomerMarketplaceEntry;
  pendingOfferId: string | null;
  locallyConfirmedOfferId: string | null;
  selectionErrorCode: string | null;
  selectionRefreshErrorCode: string | null;
  selectingOfferId: string | null;
  savingRatingOrderId: string | null;
  savingCustomerContactOrderId: string | null;
  ratingErrorCode: string | null;
  customerContactErrorCode: string | null;
  customerWhatsAppDraft: string;
  onChoose: (offerId: string) => void;
  onConfirm: () => void;
  onSubmitRating: (stars: number, comment: string) => void;
  onSaveCustomerContact: (whatsappNumber: string) => void;
  onRemoveCustomerContact: () => void;
  onCustomerWhatsAppChange: (value: string) => void;
}) {
  const { request, offers, order } = entry;
  const selectedOfferId = order?.offer_id ?? locallyConfirmedOfferId;
  const selectedOffer = order?.offer_id === entry.selectedOffer?.id
    ? entry.selectedOffer
    : locallyConfirmedOfferId
      ? offers.find((offer) => offer.id === locallyConfirmedOfferId) ?? null
      : entry.selectedOffer;
  const hasSelection = Boolean(order || locallyConfirmedOfferId);
  const whatsappNumber = order
    ? normalizeInternationalWhatsAppNumber(entry.selectedOfferWhatsApp ?? '')
    : null;
  const normalizedCustomerWhatsApp = normalizeInternationalWhatsAppNumber(customerWhatsAppDraft);
  const isSavingCustomerContact = savingCustomerContactOrderId === order?.id;

  function contactShop() {
    if (!selectedOffer || !whatsappNumber) {
      Alert.alert('رقم واتساب غير متاح', 'ما قدرنا نقرأ رقم المحل بعد اختيار العرض. حدّث الصفحة أو جرّب لاحقاً.');
      return;
    }

    const price = formatPrice(selectedOffer.price_amount);
    const currencySuffix = selectedOffer.currency_code === 'USD' ? ' $' : ' LBP';
    const url = createWhatsAppClickToChatUrl(whatsappNumber, {
      requestTitle: request.title,
      requestDetails: request.details,
      shopName: selectedOffer.shop_name_snapshot,
      itemName: selectedOffer.item_name,
      price,
      currencySuffix,
      deliveryNote: selectedOffer.delivery_note,
    });

    if (!url) {
      Alert.alert('رقم واتساب غير متاح', 'رقم المحل غير صالح حالياً.');
      return;
    }

    void Linking.openURL(url).catch(() => {
      Alert.alert('تعذّر فتح واتساب', 'تأكد إن في تطبيق بيفتح روابط واتساب وحاول مرة تانية.');
    });
  }

  return (
    <SurfaceCard style={styles.requestCard}>
      <View style={styles.requestHeading}>
        <Text style={styles.statusTag}>{requestStatusLabel(request.status, order !== null, offers.length)}</Text>
        <Text style={styles.requestTitle}>{request.title}</Text>
      </View>

      {request.details.trim().length > 0 && (
        <Text style={styles.details}>{request.details}</Text>
      )}
      <OfferLine label="الفئة" value={request.category} />
      <OfferLine label="منطقة الطلب" value={request.requested_area} />
      {entry.imageUrl ? (
        <Image
          accessibilityLabel="الصورة المرفقة بطلبك"
          source={{ uri: entry.imageUrl }}
          style={styles.requestImage}
          resizeMode="contain"
        />
      ) : entry.imageUnavailable ? (
        <Text style={styles.imageUnavailable}>تعذّر عرض الصورة الخاصة. حدّث الصفحة للمحاولة من جديد.</Text>
      ) : null}

      {offers.length === 0 ? (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingHeading}>
            {request.status === 'open' ? 'بعده ما وصل ولا عرض' : 'ما في عروض مسجلة لهالطلب'}
          </Text>
          <Text style={styles.waitingText}>
            {request.status === 'open'
              ? 'حدّث الصفحة لاحقاً لتشوف العروض الجديدة.'
              : 'إذا كان الطلب مسودة، وافق على مشاركته أولاً حتى تقدر المحلات تقدّم عروض.'}
          </Text>
        </View>
      ) : (
        <View style={styles.comparisonSection}>
          <Text style={styles.offerHeading}>قارن عروض المحلات</Text>
          {offers.map((offer) => {
            const isPending = pendingOfferId === offer.id;
            const isSelected = selectedOfferId === offer.id;
            const isDisabled = request.status !== 'open' || hasSelection || selectingOfferId !== null;

            return (
              <Pressable
                key={offer.id}
                accessibilityRole="radio"
                accessibilityLabel={`اختيار عرض من ${offer.shop_name_snapshot} بسعر ${formatPrice(offer.price_amount)} ${offer.currency_code}`}
                accessibilityState={{ checked: isPending, disabled: isDisabled }}
                disabled={isDisabled}
                onPress={() => onChoose(offer.id)}
                style={({ pressed }) => [
                  styles.offerChoice,
                  isPending && styles.offerChoiceActive,
                  isSelected && styles.offerChoiceSelected,
                  isDisabled && styles.offerChoiceDisabled,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.offerChoiceHeading}>
                  <Text style={styles.offerChoiceStatus}>
                    {isSelected ? 'مختار' : isPending ? 'للتأكيد' : 'عرض'}
                  </Text>
                  <Text style={styles.shopName}>{offer.shop_name_snapshot}</Text>
                </View>
                <OfferLine label="الموقع" value={offer.shop_location_snapshot || 'الموقع غير محدد'} />
                <OfferLine label="المنتج" value={offer.item_name} />
                <OfferLine label="السعر" value={`${formatPrice(offer.price_amount)} ${offer.currency_code}`} />
                <OfferLine label="التوصيل" value={offer.delivery_note} />
              </Pressable>
            );
          })}

          {request.status === 'open' && !hasSelection && pendingOfferId && (
            <PrimaryButton
              disabled={selectingOfferId !== null}
              label={selectingOfferId ? 'عم نأكد الاختيار…' : 'تأكيد اختيار العرض'}
              onPress={onConfirm}
            />
          )}

          {selectionErrorCode && (
            <Text style={styles.errorText}>
              {selectionErrorCode === '42501'
                ? 'الطلب لم يعد مفتوحاً أو العرض غير متاح. حدّث الصفحة لتشوف الحالة الجديدة.'
                : `ما قدرنا نأكد الاختيار. رمز الخطأ: ${selectionErrorCode}`}
            </Text>
          )}

          {hasSelection && selectedOffer && (
            <ConfirmationPanel>
              <Text style={styles.confirmationTitle}>تم اختيار العرض</Text>
              <Text style={styles.confirmationText}>
                صار طلبك مغلقاً أمام عروض جديدة، وتم إنشاء الطلب عند المحل.
              </Text>
              <OfferLine label="المحل" value={selectedOffer.shop_name_snapshot} />
              <OfferLine label="الموقع" value={selectedOffer.shop_location_snapshot || 'الموقع غير محدد'} />
              <OfferLine label="المنتج" value={selectedOffer.item_name} />
              <OfferLine label="السعر" value={`${formatPrice(selectedOffer.price_amount)} ${selectedOffer.currency_code}`} />
              <OfferLine label="التوصيل" value={selectedOffer.delivery_note} />
            </ConfirmationPanel>
          )}

          {hasSelection && selectionRefreshErrorCode && (
            <Text style={styles.errorText}>
              تم حفظ اختيارك، لكن ما قدرنا نحدّث التفاصيل أو رقم التواصل. اضغط «تحديث الطلبات والعروض» للمحاولة من جديد.
            </Text>
          )}

          {order && (
            <OrderProgress stage={order.stage} />
          )}

          {order?.stage === 'completed' && selectedOffer && (
            <CustomerRating
              rating={entry.rating}
              shopName={selectedOffer.shop_name_snapshot}
              isSaving={savingRatingOrderId === order.id}
              errorMessage={ratingErrorCode
                ? `ما قدرنا نحفظ التقييم. رمز الخطأ: ${ratingErrorCode}`
                : null}
              persistenceNote="تقييمك محفوظ مع الطلب في قاعدة البيانات، وبتقدر ترجع تشوفه هون."
              submitLabel="حفظ التقييم"
              onSubmit={onSubmitRating}
            />
          )}

          {hasSelection && selectedOffer && (
            <View style={styles.whatsappSection}>
              <PrimaryButton
                disabled={!whatsappNumber}
                label="تواصل عبر واتساب"
                onPress={contactShop}
              />
              <Text style={styles.whatsappNote}>
                {whatsappNumber
                  ? 'رح يفتح واتساب برسالة جاهزة. ما بتنرسل إلا لما تضغط إرسال.'
                  : entry.contactReadErrorCode
                    ? 'تعذّر قراءة رقم التواصل. تحقّق إن الاختيار محفوظ ثم حدّث الصفحة.'
                    : 'رقم واتساب للمحل غير متوفر أو غير صالح بعد الاختيار.'}
              </Text>
            </View>
          )}

          {order && (
            <View style={styles.customerContactSection}>
              <Text style={styles.offerHeading}>شارك رقمك مع المحل عبر واتساب (اختياري)</Text>
              <Text style={styles.whatsappNote}>
                إذا حفظت الرقم، بيشوفه المحل المختار لهالطلب فقط. فيك تعدّله أو تلغي مشاركته بأي وقت.
              </Text>
              <TextInput
                accessibilityLabel="رقم واتساب الذي ستشاركه مع المحل"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSavingCustomerContact}
                keyboardType="phone-pad"
                maxLength={20}
                onChangeText={onCustomerWhatsAppChange}
                placeholder="مثلاً: +961 3 123 456"
                placeholderTextColor="#9AA8A0"
                style={styles.customerContactInput}
                textAlign="right"
                value={customerWhatsAppDraft}
              />
              <PrimaryButton
                disabled={!normalizedCustomerWhatsApp || isSavingCustomerContact}
                label={isSavingCustomerContact
                  ? 'عم نحفظ الرقم…'
                  : entry.customerWhatsAppNumber
                    ? 'تحديث الرقم المشترك'
                    : 'مشاركة الرقم مع المحل'}
                onPress={() => onSaveCustomerContact(customerWhatsAppDraft)}
              />
              {entry.customerWhatsAppNumber ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSavingCustomerContact}
                  onPress={onRemoveCustomerContact}
                  style={({ pressed }) => [styles.removeContactButton, pressed && styles.pressed]}>
                  <Text style={styles.removeContactText}>إلغاء مشاركة الرقم</Text>
                </Pressable>
              ) : null}
              {customerContactErrorCode ? (
                <Text style={styles.errorText}>
                  {customerContactErrorCode === 'INVALID_WHATSAPP_NUMBER'
                    ? 'اكتب رقم واتساب بصيغة دولية، مثل +961 3 123 456.'
                    : `ما قدرنا نحفظ رقم واتساب. رمز الخطأ: ${customerContactErrorCode}`}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      )}
    </SurfaceCard>
  );
}

function OfferLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.offerLine}>
      <Text style={styles.offerValue}>{value}</Text>
      <Text style={styles.offerLabel}>{label}</Text>
    </View>
  );
}

function requestStatusLabel(
  status: CustomerMarketplaceEntry['request']['status'],
  hasOrder: boolean,
  offersCount: number,
) {
  if (hasOrder) return 'تم اختيار عرض';
  if (status === 'open') return offersCount ? `${offersCount} عروض` : 'ناطرين عرض';
  if (status === 'draft') return 'مسودة';
  if (status === 'cancelled') return 'ملغي';
  return 'مغلق';
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  content: { gap: 13, paddingHorizontal: 20, paddingBottom: 30 },
  noticeCard: { backgroundColor: DALLNI_COLORS.greenLight, gap: 8, padding: 14 },
  noticeTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  noticeText: { color: '#526A60', fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  refreshButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7E9E0',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  refreshText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  disabledButton: { opacity: 0.6 },
  stateCard: { alignItems: 'flex-end', gap: 9, padding: 16 },
  stateTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stateText: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  requestCard: { gap: 12, padding: 15 },
  requestHeading: { alignItems: 'flex-end', gap: 7 },
  statusTag: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 10,
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
    writingDirection: 'rtl',
  },
  requestTitle: { color: DALLNI_COLORS.ink, fontSize: 16, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  details: { color: '#566C62', fontSize: 12, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl' },
  requestImage: {
    alignSelf: 'stretch',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 13,
    height: 185,
    width: '100%',
  },
  imageUnavailable: { color: DALLNI_COLORS.muted, fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  comparisonSection: { gap: 10 },
  offerHeading: { color: DALLNI_COLORS.greenDark, fontSize: 13, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  offerChoice: {
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 13,
    borderWidth: 1,
    gap: 9,
    padding: 12,
  },
  offerChoiceActive: { backgroundColor: DALLNI_COLORS.greenLight, borderColor: DALLNI_COLORS.green },
  offerChoiceSelected: { borderColor: DALLNI_COLORS.green, borderWidth: 1.5 },
  offerChoiceDisabled: { opacity: 0.92 },
  offerChoiceHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  shopName: { color: DALLNI_COLORS.ink, fontSize: 13, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  offerChoiceStatus: { color: DALLNI_COLORS.green, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  offerLine: { alignItems: 'flex-start', flexDirection: 'row-reverse', gap: 10, justifyContent: 'space-between' },
  offerLabel: { color: DALLNI_COLORS.muted, fontSize: 11, fontWeight: '700', writingDirection: 'rtl' },
  offerValue: { color: DALLNI_COLORS.ink, flex: 1, fontSize: 12, textAlign: 'left', writingDirection: 'rtl' },
  waitingCard: { backgroundColor: '#F7F9F8', borderRadius: 13, padding: 12 },
  waitingText: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  waitingHeading: { color: DALLNI_COLORS.ink, fontSize: 12, fontWeight: '800', marginBottom: 4, textAlign: 'right', writingDirection: 'rtl' },
  errorText: { color: '#A3493C', fontSize: 11, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  confirmationTitle: { color: DALLNI_COLORS.greenDark, fontSize: 13, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  confirmationText: { color: DALLNI_COLORS.ink, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  whatsappSection: { gap: 6 },
  whatsappNote: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  customerContactSection: { backgroundColor: '#F7F9F8', borderRadius: 12, gap: 8, padding: 12 },
  customerContactInput: {
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    minHeight: 45,
    paddingHorizontal: 12,
    writingDirection: 'ltr',
  },
  removeContactButton: { alignSelf: 'flex-end', paddingHorizontal: 6, paddingVertical: 5 },
  removeContactText: { color: '#A3493C', fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  pressed: { opacity: 0.82 },
});
