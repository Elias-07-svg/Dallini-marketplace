import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfferField } from '@/components/dallni/offer-field';
import { OrderProgress } from '@/components/dallni/order-progress';
import { RealtimeAlert } from '@/components/dallni/realtime-alert';
import {
  ConfirmationPanel,
  DALLNI_COLORS,
  FlowHeader,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import { ORDER_STAGES, type OrderStage } from '@/context/demo-session';
import { useSupabaseAuth } from '@/context/supabase-auth';
import { subscribeToShopRequestOrder } from '@/lib/marketplace-realtime';
import {
  advanceOwnerOrderStage,
  createOwnerOffer,
  loadOwnerOrder,
  loadOwnerCustomerWhatsApp,
  loadOwnerOffers,
  loadOwnerRequest,
  loadOwnerShop,
  shopOwnerErrorCode,
  type OwnerShopProfile,
  type ShopInboxRequest,
  type ShopOwnerOrder,
  type ShopOffer,
} from '@/lib/shop-owner-supabase';
import type { MarketplaceRealtimeAlert } from '@/lib/marketplace-realtime';
import {
  createWhatsAppTextUrl,
  normalizeInternationalWhatsAppNumber,
} from '@/utils/whatsapp';

type CurrencyCode = 'USD' | 'LBP';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

function normalizePrice(value: string, currencyCode: CurrencyCode) {
  const normalized = value
    .replace(/[٠-٩]/gu, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[$\s٬]/gu, '');
  if (currencyCode === 'LBP') return normalized.replace(/[.٫،,]/gu, '');

  return normalized
    .replace(/,(?=\d{3}(?:[,\.]|$))/gu, '')
    .replace(/[٫،,]/gu, '.');
}

function shopRequestRealtimeAlertMessage(event: MarketplaceRealtimeAlert) {
  if (event.kind !== 'order-stage-changed') return null;
  const stage = ORDER_STAGES.find((item) => item.id === event.stage)?.label;
  return stage ? `تغيّرت حالة الطلب إلى «${stage}».` : null;
}

export default function ConnectedShopRequestScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string | string[] }>();
  const id = Array.isArray(requestId) ? requestId[0] : requestId;
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const [shop, setShop] = useState<OwnerShopProfile | null>(null);
  const [request, setRequest] = useState<ShopInboxRequest | null>(null);
  const [offers, setOffers] = useState<ShopOffer[]>([]);
  const [order, setOrder] = useState<ShopOwnerOrder | null>(null);
  const [customerWhatsAppNumber, setCustomerWhatsAppNumber] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>('USD');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdvancingOrder, setIsAdvancingOrder] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [orderErrorCode, setOrderErrorCode] = useState<string | null>(null);
  const [offerSaved, setOfferSaved] = useState(false);
  const requestReloadRef = useRef<(() => void) | null>(null);
  const seenRealtimeAlerts = useRef(new Set<string>());
  const [realtimeAlert, setRealtimeAlert] = useState<{ key: string; message: string } | null>(null);

  const loadRequestData = useCallback(async () => {
    if (!user || !id) {
      return {
        shop: null,
        request: null,
        offers: [],
        order: null,
        customerWhatsAppNumber: null,
        errorCode: null,
      };
    }

    try {
      const [ownerShop, visibleRequest] = await Promise.all([
        loadOwnerShop(user.id),
        loadOwnerRequest(id),
      ]);
      const [ownOffers, selectedOrder] = ownerShop?.status === 'active' && visibleRequest
        ? await Promise.all([
            loadOwnerOffers(visibleRequest.id, ownerShop.id),
            loadOwnerOrder(visibleRequest.id, ownerShop.id),
          ])
        : [[], null];
      const selectedCustomerWhatsApp = selectedOrder
        ? await loadOwnerCustomerWhatsApp(selectedOrder.id)
        : null;
      return {
        shop: ownerShop,
        request: visibleRequest,
        offers: ownOffers,
        order: selectedOrder,
        customerWhatsAppNumber: selectedCustomerWhatsApp,
        errorCode: null,
      };
    } catch (error) {
      return {
        shop: null,
        request: null,
        offers: [],
        order: null,
        customerWhatsAppNumber: null,
        errorCode: shopOwnerErrorCode(error),
      };
    }
  }, [id, user]);

  const handleRealtimeAlert = useCallback((event: MarketplaceRealtimeAlert) => {
    const key = `${event.kind}:${event.eventKey}`;
    if (seenRealtimeAlerts.current.has(key)) return;
    seenRealtimeAlerts.current.add(key);

    const message = shopRequestRealtimeAlertMessage(event);
    if (message) setRealtimeAlert({ key, message });
  }, []);

  useFocusEffect(useCallback(() => {
    if (isAuthLoading) return;

    let isCurrent = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const reload = async () => {
      const result = await loadRequestData();
      if (!isCurrent) return;
      setShop(result.shop);
      setRequest(result.request);
      setOffers(result.offers);
      setOrder(result.order);
      setCustomerWhatsAppNumber(result.customerWhatsAppNumber);
      setErrorCode(result.errorCode);
      setIsLoading(false);
    };

    const scheduleReload = () => {
      if (!isCurrent) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void reload();
      }, 120);
    };

    const handlers = { refresh: scheduleReload, alert: handleRealtimeAlert };
    const unsubscribeOrder = user && id
      ? subscribeToShopRequestOrder(id, handlers)
      : () => {};
    const reloadNow = () => void reload();
    requestReloadRef.current = reloadNow;
    void reload();

    return () => {
      isCurrent = false;
      if (requestReloadRef.current === reloadNow) requestReloadRef.current = null;
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribeOrder();
    };
  }, [handleRealtimeAlert, id, isAuthLoading, loadRequestData, user]));

  function refreshRequest(showLoading = false) {
    const reload = requestReloadRef.current;
    if (!reload) return;

    setErrorCode(null);
    if (showLoading) setIsLoading(true);
    reload();
  }

  const normalizedPrice = normalizePrice(price, currencyCode);
  const priceAmount = Number(normalizedPrice);
  const isPriceValid = Number.isFinite(priceAmount) && priceAmount > 0 && priceAmount <= 9999999999.99;
  const validWhatsAppNumber = shop
    ? normalizeInternationalWhatsAppNumber(shop.whatsapp_number)
    : null;
  const missingOfferRequirements = [
    !itemName.trim() ? 'اسم المنتج' : null,
    !isPriceValid ? 'سعر صحيح' : null,
    !deliveryNote.trim() ? 'ملاحظة التوصيل' : null,
    !validWhatsAppNumber ? 'رقم واتساب دولي بملف المحل' : null,
  ].filter((requirement): requirement is string => requirement !== null);
  const canOffer = Boolean(
    user &&
      shop?.status === 'active' &&
      request?.status === 'open' &&
      missingOfferRequirements.length === 0 &&
      !isSaving,
  );
  const nextStage = order ? getNextOrderStage(order.stage) : null;
  const selectedOrderOffer = order
    ? offers.find((offer) => offer.id === order.offer_id) ?? null
    : null;

  async function submitOffer() {
    if (!canOffer || !request || !shop) return;

    setIsSaving(true);
    setErrorCode(null);
    setOfferSaved(false);
    try {
      await createOwnerOffer({
        requestId: request.id,
        shopId: shop.id,
        itemName: itemName.trim(),
        priceAmount,
        currencyCode,
        deliveryNote: deliveryNote.trim(),
      });
      setItemName('');
      setPrice('');
      setDeliveryNote('');
      setOfferSaved(true);
      setOffers(await loadOwnerOffers(request.id, shop.id));
    } catch (error) {
      setErrorCode(shopOwnerErrorCode(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function advanceOrder() {
    if (!order || !shop || shop.status !== 'active' || !nextStage || isAdvancingOrder) return;

    setIsAdvancingOrder(true);
    setOrderErrorCode(null);
    try {
      await advanceOwnerOrderStage(order.id, nextStage);
      const savedOrder = await loadOwnerOrder(order.request_id, shop.id);
      if (!savedOrder) throw new Error('ORDER_NOT_VISIBLE_AFTER_UPDATE');
      setOrder(savedOrder);
    } catch (error) {
      setOrderErrorCode(shopOwnerErrorCode(error));
    } finally {
      setIsAdvancingOrder(false);
    }
  }

  function contactCustomer() {
    if (!request || !order || !shop || !customerWhatsAppNumber) return;
    const message = [
      `مرحبا، أنا صاحب محل ${shop.shop_name}. عم بتواصل معك بخصوص طلبك «${request.title}».`,
      selectedOrderOffer ? `العرض المختار: ${selectedOrderOffer.item_name}.` : '',
    ].filter(Boolean).join('\n');
    const url = createWhatsAppTextUrl(customerWhatsAppNumber, message);
    if (!url) {
      Alert.alert('رقم واتساب غير متاح', 'الرقم الذي شاركه الزبون غير صالح حالياً.');
      return;
    }
    void Linking.openURL(url).catch(() => {
      Alert.alert('تعذّر فتح واتساب', 'تأكد إن في تطبيق بيفتح روابط واتساب وحاول مرة تانية.');
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="تفاصيل الطلب"
        subtitle="راجع تفاصيل الطلب والصورة، وجهّز عرضاً مناسباً للزبون."
        onBack={() => router.back()}
      />
      {realtimeAlert ? (
        <RealtimeAlert
          announcementKey={realtimeAlert.key}
          message={realtimeAlert.message}
          onDismiss={() => setRealtimeAlert(null)}
        />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {isAuthLoading || isLoading ? (
          <SurfaceCard style={styles.stateCard}>
            <ActivityIndicator color={DALLNI_COLORS.green} />
            <Text style={styles.stateText}>عم نتحقق من الطلب ونحمّل تفاصيله…</Text>
          </SurfaceCard>
        ) : !user ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>سجّل دخولك للمتابعة</Text>
            <PrimaryButton label="فتح تسجيل الدخول" onPress={() => router.push('/auth' as Href)} />
          </SurfaceCard>
        ) : errorCode ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما قدرنا نحمّل تفاصيل الطلب</Text>
            <Text style={styles.stateText}>تأكد من اتصال الإنترنت وحاول تحديث الطلب.</Text>
            <PrimaryButton
              label="إعادة المحاولة"
              onPress={() => refreshRequest(true)}
            />
          </SurfaceCard>
        ) : !request ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>الطلب غير متاح</Text>
            <Text style={styles.stateText}>
              يمكن تغيّرت حالة الطلب أو ما عاد متاحاً.
            </Text>
          </SurfaceCard>
        ) : (
          <>
            <SurfaceCard style={styles.requestCard}>
              {request.image_url ? (
                <Image
                  accessibilityLabel="صورة خاصة لطلب مصرح بعرضه"
                  source={{ uri: request.image_url }}
                  style={styles.requestImage}
                  resizeMode="cover"
                />
              ) : request.image_path ? (
                <View style={styles.imageFallback}>
                  <Text style={styles.imageFallbackText}>تعذّر عرض الصورة الخاصة</Text>
                </View>
              ) : null}
              <View style={styles.requestMeta}>
                <Text style={styles.category}>{request.category}</Text>
                <Text style={styles.status}>{requestStatusLabel(request.status)}</Text>
              </View>
              <Text style={styles.requestTitle}>{request.title}</Text>
              <Text style={styles.detailLine}>المنطقة: {request.requested_area}</Text>
              <Text style={styles.requestDetails}>
                {request.details || 'ما في تفاصيل مكتوبة.'}
              </Text>
            </SurfaceCard>

            {!shop ? (
              <SurfaceCard style={styles.stateCard}>
                <Text style={styles.stateTitle}>جهّز ملف المحل أولاً</Text>
                <PrimaryButton
                  label="إعداد ملف المحل"
                  onPress={() => router.push('/owner/online-profile' as Href)}
                />
              </SurfaceCard>
            ) : shop.status !== 'active' ? (
              <SurfaceCard style={styles.stateCard}>
                <Text style={styles.stateTitle}>ما في إمكانية لإرسال عرض بعد</Text>
                <Text style={styles.stateText}>
                  ملف المحل «{shopStatusLabel(shop.status)}». بنبلغك بعد مراجعته وتجهيزه لإرسال العروض.
                </Text>
              </SurfaceCard>
            ) : order ? (
              <SurfaceCard style={styles.orderCard}>
                <Text style={styles.sectionTitle}>متابعة طلب لمحلّك</Text>
                <OrderProgress stage={order.stage} />
                {selectedOrderOffer ? <OrderOfferDetails offer={selectedOrderOffer} /> : null}
                {customerWhatsAppNumber ? (
                  <PrimaryButton label="مراسلة الزبون عبر واتساب" onPress={contactCustomer} />
                ) : (
                  <Text style={styles.contactNoticeText}>
                    الزبون ما شارك رقم واتساب مع المحل بعد. بعد ما يشاركه من شاشة طلباته، حدّث الصفحة لتتواصل معه.
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => refreshRequest(true)}
                  style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
                  <Text style={styles.profileButtonText}>تحديث بيانات التواصل</Text>
                </Pressable>
                {nextStage ? (
                  <PrimaryButton
                    disabled={isAdvancingOrder}
                    label={isAdvancingOrder
                      ? 'عم نحدّث حالة الطلب…'
                      : `تحديث الحالة إلى ${orderStageLabel(nextStage)}`}
                    onPress={() => void advanceOrder()}
                  />
                ) : (
                  <Text style={styles.completedNote}>اكتمل الطلب.</Text>
                )}
                {orderErrorCode ? (
                  <Text style={styles.errorText}>
                    ما قدرنا نحدّث حالة الطلب. حدّث الصفحة وتأكد من اتصال الإنترنت وحاول مرة تانية.
                  </Text>
                ) : null}
              </SurfaceCard>
            ) : request.status !== 'open' ? (
              <SurfaceCard style={styles.stateCard}>
                <Text style={styles.stateTitle}>الطلب مش مفتوح للعروض</Text>
                <Text style={styles.stateText}>
                  يمكن تغيّرت حالة الطلب. حدّث الصفحة قبل ما تحاول ترسل عرضاً.
                </Text>
              </SurfaceCard>
            ) : (
              <SurfaceCard style={styles.offerCard}>
                <Text style={styles.sectionTitle}>حضّر عرض للمحل</Text>
                {!validWhatsAppNumber && (
                  <View style={styles.contactNotice}>
                    <Text style={styles.contactNoticeText}>
                      أضف رقم واتساب دولي صحيح بملف المحل قبل إرسال العرض. الرقم ما بينعرض ببطاقة الزبون.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push('/owner/online-profile' as Href)}
                      style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
                      <Text style={styles.profileButtonText}>تعديل ملف المحل</Text>
                    </Pressable>
                  </View>
                )}
                <OfferField
                  label="اسم المنتج"
                  placeholder="مثلاً: Samsung Galaxy A54"
                  value={itemName}
                  onChangeText={(value) => { setItemName(value); setOfferSaved(false); }}
                  maxLength={120}
                />
                <View style={styles.priceHeader}>
                  <Text style={styles.currencyLabel}>العملة</Text>
                  <View style={styles.currencySwitch}>
                    <CurrencyOption
                      label="دولار USD"
                      selected={currencyCode === 'USD'}
                      onPress={() => setCurrencyCode('USD')}
                    />
                    <CurrencyOption
                      label="ليرة LBP"
                      selected={currencyCode === 'LBP'}
                      onPress={() => setCurrencyCode('LBP')}
                    />
                  </View>
                </View>
                <OfferField
                  label="السعر"
                  placeholder={currencyCode === 'USD' ? 'مثلاً: ٢٣٠٫٥٠' : 'مثلاً: ٢٠٠٠٠٠٠'}
                  value={price}
                  onChangeText={(value) => { setPrice(value); setOfferSaved(false); }}
                  keyboardType="decimal-pad"
                  maxLength={18}
                />
                <OfferField
                  label="ملاحظة التوصيل"
                  placeholder="مثلاً: توصيل لجونية خلال يومين"
                  value={deliveryNote}
                  onChangeText={(value) => { setDeliveryNote(value); setOfferSaved(false); }}
                  multiline
                  maxLength={500}
                />
                <View style={styles.offerPreview}>
                  <View style={styles.previewHeading}>
                    <Text style={styles.previewBadge}>معاينة</Text>
                    <Text style={styles.previewTitle}>{itemName.trim() || 'اسم المنتج'}</Text>
                  </View>
                  <View style={styles.previewPriceRow}>
                    <Text style={styles.previewPriceLabel}>السعر</Text>
                    <Text style={styles.previewPriceValue}>
                      {isPriceValid ? `${formatPrice(priceAmount)} ${currencyCode}` : 'أدخل السعر'}
                    </Text>
                  </View>
                  <Text style={styles.previewDelivery}>
                    {deliveryNote.trim() || 'أضف ملاحظة التوصيل'}
                  </Text>
                </View>
                {missingOfferRequirements.length > 0 && (
                  <Text style={styles.offerHint}>
                    لإرسال العرض، كمّل: {missingOfferRequirements.join('، ')}.
                  </Text>
                )}
                {errorCode && (
                  <Text style={styles.errorText}>ما قدرنا نرسل العرض. تحقق من البيانات واتصال الإنترنت وحاول مرة تانية.</Text>
                )}
                {offerSaved && (
                  <ConfirmationPanel>
                    <Text style={styles.savedTitle}>تم حفظ العرض</Text>
                    <Text style={styles.savedText}>
                      صار ضمن عروض الطلب. رقم واتسابك بيضل مخفياً لحد ما يختار الزبون عرضك.
                    </Text>
                  </ConfirmationPanel>
                )}
                <PrimaryButton
                  disabled={!canOffer}
                  label={isSaving ? 'عم نحفظ العرض…' : 'إرسال العرض'}
                  onPress={() => void submitOffer()}
                />
              </SurfaceCard>
            )}

            <View style={styles.offersHeading}>
              <Text style={styles.count}>{offers.length} عرض</Text>
              <Text style={styles.sectionTitle}>عروض محلك على هالطلب</Text>
            </View>
            {offers.length === 0 ? (
              <SurfaceCard style={styles.emptyOffers}>
                <Text style={styles.emptyText}>ما أرسلت عرضاً لهالطلب بعد.</Text>
              </SurfaceCard>
            ) : offers.map((offer) => (
              <SurfaceCard key={offer.id} style={styles.savedOffer}>
                <Text style={styles.offerName}>{offer.item_name}</Text>
                <Text style={styles.offerDetail}>
                  السعر: {formatPrice(offer.price_amount)} {offer.currency_code}
                </Text>
                <Text style={styles.offerDetail}>التوصيل: {offer.delivery_note}</Text>
                <Text style={styles.offerDetail}>الموقع: {offer.shop_location_snapshot || 'غير محدد'}</Text>
              </SurfaceCard>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CurrencyOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.currencyOption, selected && styles.currencyOptionSelected]}>
      <Text style={[styles.currencyOptionText, selected && styles.currencyOptionTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function getNextOrderStage(stage: OrderStage): OrderStage | null {
  const index = ORDER_STAGES.findIndex((item) => item.id === stage);
  return ORDER_STAGES[index + 1]?.id ?? null;
}

function orderStageLabel(stage: OrderStage) {
  return ORDER_STAGES.find((item) => item.id === stage)?.label ?? '';
}

function OrderOfferDetails({ offer }: { offer: ShopOffer }) {
  return (
    <View style={styles.orderOffer}>
      <Text style={styles.offerName}>{offer.item_name}</Text>
      <Text style={styles.offerDetail}>
        السعر: {formatPrice(offer.price_amount)} {offer.currency_code}
      </Text>
      <Text style={styles.offerDetail}>التوصيل: {offer.delivery_note}</Text>
    </View>
  );
}

function requestStatusLabel(status: ShopInboxRequest['status']) {
  if (status === 'open') return 'مفتوح';
  if (status === 'closed') return 'مغلق';
  if (status === 'cancelled') return 'ملغي';
  return 'مسودة';
}

function shopStatusLabel(status: OwnerShopProfile['status']) {
  if (status === 'active') return 'مفعّل';
  if (status === 'suspended') return 'موقوف';
  return 'قيد المراجعة';
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(price);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DALLNI_COLORS.background },
  content: { gap: 12, paddingHorizontal: 20, paddingBottom: 32 },
  stateCard: { alignItems: 'flex-end', gap: 9, padding: 16 },
  stateTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stateText: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestCard: { gap: 9, padding: 15 },
  requestImage: {
    alignSelf: 'center',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 14,
    height: 220,
    width: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 54,
    padding: 10,
    width: '100%',
  },
  imageFallbackText: { color: DALLNI_COLORS.muted, fontSize: 10, writingDirection: 'rtl' },
  requestMeta: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10 },
  category: { color: DALLNI_COLORS.green, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  status: { color: DALLNI_COLORS.muted, fontSize: 10, writingDirection: 'rtl' },
  requestTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailLine: { color: DALLNI_COLORS.greenDark, fontSize: 11, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  requestDetails: {
    color: DALLNI_COLORS.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  offerCard: { gap: 12, padding: 15 },
  offerPreview: {
    backgroundColor: '#F4F8F6',
    borderColor: '#DDEAE3',
    borderRadius: 14,
    borderWidth: 1,
    gap: 9,
    padding: 13,
  },
  previewHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8 },
  previewBadge: { color: DALLNI_COLORS.green, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  previewTitle: { color: DALLNI_COLORS.ink, flex: 1, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  previewPriceRow: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  previewPriceLabel: { color: DALLNI_COLORS.muted, fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },
  previewPriceValue: { color: DALLNI_COLORS.greenDark, fontSize: 14, fontWeight: '900' },
  previewDelivery: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  offerHint: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  orderCard: { gap: 12, padding: 15 },
  orderOffer: {
    backgroundColor: '#F7F9F8',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    padding: 11,
  },
  completedNote: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  contactNotice: { backgroundColor: '#FFF7E5', borderRadius: 12, gap: 8, padding: 11 },
  contactNoticeText: { color: '#755B24', fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  profileButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  profileButtonText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  priceHeader: { alignItems: 'flex-end', gap: 7 },
  currencyLabel: { color: DALLNI_COLORS.ink, fontSize: 12, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  currencySwitch: { flexDirection: 'row-reverse', gap: 7 },
  currencyOption: {
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  currencyOptionSelected: { backgroundColor: DALLNI_COLORS.greenLight, borderColor: DALLNI_COLORS.green },
  currencyOptionText: { color: DALLNI_COLORS.muted, fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },
  currencyOptionTextSelected: { color: DALLNI_COLORS.greenDark },
  errorText: { color: '#A3493C', fontSize: 11, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  savedTitle: { color: DALLNI_COLORS.greenDark, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  savedText: { color: DALLNI_COLORS.ink, fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  offersHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 5 },
  count: { color: DALLNI_COLORS.muted, fontSize: 10, writingDirection: 'rtl' },
  emptyOffers: { padding: 14 },
  emptyText: { color: DALLNI_COLORS.muted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  savedOffer: { gap: 6, padding: 13 },
  offerName: { color: DALLNI_COLORS.ink, fontSize: 13, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  offerDetail: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.8 },
});
