import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DALLNI_COLORS,
  FlowHeader,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import { OrderProgress } from '@/components/dallni/order-progress';
import { useSupabaseAuth } from '@/context/supabase-auth';
import {
  loadOwnerInboxRequests,
  loadOwnerOrders,
  loadOwnerRatings,
  loadOwnerShop,
  shopOwnerErrorCode,
  type OwnerShopProfile,
  type ShopInboxRequest,
  type ShopOwnerOrderSummary,
  type ShopOwnerRating,
} from '@/lib/shop-owner-supabase';

export default function ConnectedShopInboxScreen() {
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const [shop, setShop] = useState<OwnerShopProfile | null>(null);
  const [requests, setRequests] = useState<ShopInboxRequest[]>([]);
  const [orders, setOrders] = useState<ShopOwnerOrderSummary[]>([]);
  const [ratings, setRatings] = useState<ShopOwnerRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadWorkspace = useCallback(async () => {
    if (!user) {
      return { shop: null, requests: [], orders: [], ratings: [], errorCode: null };
    }

    try {
      const ownerShop = await loadOwnerShop(user.id);
      const isActiveShop = ownerShop?.status === 'active';
      const [visibleRequests, ownOrders, shopRatings] = await Promise.all([
        isActiveShop ? loadOwnerInboxRequests() : Promise.resolve([] as ShopInboxRequest[]),
        isActiveShop && ownerShop
          ? loadOwnerOrders(ownerShop.id)
          : Promise.resolve([] as ShopOwnerOrderSummary[]),
        ownerShop
          ? loadOwnerRatings(ownerShop.id)
          : Promise.resolve([] as ShopOwnerRating[]),
      ]);
      return {
        shop: ownerShop,
        requests: visibleRequests,
        orders: ownOrders,
        ratings: shopRatings,
        errorCode: null,
      };
    } catch (error) {
      return { shop: null, requests: [], orders: [], ratings: [], errorCode: shopOwnerErrorCode(error) };
    }
  }, [user]);

  useEffect(() => {
    if (isAuthLoading) return;

    let isCurrent = true;
    void loadWorkspace().then((result) => {
      if (!isCurrent) return;
      setShop(result.shop);
      setRequests(result.requests);
      setOrders(result.orders);
      setRatings(result.ratings);
      setErrorCode(result.errorCode);
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [isAuthLoading, loadWorkspace, refreshKey]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="صندوق المحل المتصل"
        subtitle="طلبات محفوظة بقاعدة بيانات Supabase، حسب صلاحيات حسابك."
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SurfaceCard style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>بيانات مشروعك</Text>
          <Text style={styles.noticeText}>
            الطلبات والصور والعروض تُقرأ وتُحفظ عبر جلستك المسجّلة. الصور تبقى خاصة، والروابط المؤقتة لا تُنشأ إلا إذا سمحت السياسات لحسابك بقراءتها.
          </Text>
        </SurfaceCard>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/owner' as Href)}
          style={({ pressed }) => [styles.demoLink, pressed && styles.pressed]}>
          <Text style={styles.demoLinkText}>العودة إلى تجربة المحل المحلية</Text>
        </Pressable>

        {isAuthLoading || isLoading ? (
          <SurfaceCard style={styles.stateCard}>
            <ActivityIndicator color={DALLNI_COLORS.green} />
            <Text style={styles.stateText}>عم نحمّل بيانات المحل المسموح لحسابك يشوفها…</Text>
          </SurfaceCard>
        ) : !user ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>سجّل دخولك للمتابعة</Text>
            <Text style={styles.stateText}>صندوق Supabase متاح للحساب المسجّل فقط.</Text>
            <PrimaryButton label="فتح تسجيل الدخول" onPress={() => router.push('/auth' as Href)} />
          </SurfaceCard>
        ) : errorCode ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما قدرنا نحمّل صندوق المحل</Text>
            <Text style={styles.stateText}>
              تأكد إن مشروع Supabase متاح وإن حسابك عنده صلاحية. رمز الخطأ: {errorCode}
            </Text>
            <PrimaryButton
              label="إعادة المحاولة"
              onPress={() => {
                setIsLoading(true);
                setErrorCode(null);
                setRefreshKey((value) => value + 1);
              }}
            />
          </SurfaceCard>
        ) : !shop ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>ما في ملف محل لهالحساب بعد</Text>
            <Text style={styles.stateText}>
              أنشئ الملف باسم المحل ومعلوماته. الملف الجديد بيضل قيد المراجعة لحد ما يوافق عليه مشغّل المشروع.
            </Text>
            <PrimaryButton
              label="إنشاء ملف المحل"
              onPress={() => router.push('/owner/online-profile' as Href)}
            />
          </SurfaceCard>
        ) : (
          <>
            <SurfaceCard style={styles.shopCard}>
              <View style={styles.shopHeading}>
                <Text style={styles.statusBadge}>{shopStatusLabel(shop.status)}</Text>
                <Text style={styles.shopName}>{shop.shop_name}</Text>
              </View>
              <Text style={styles.shopDetail}>الموقع: {shop.location || 'غير محدد'}</Text>
              <Text style={styles.shopDetail}>
                مناطق الخدمة: {shop.service_areas.length ? shop.service_areas.join('، ') : 'غير محددة'}
              </Text>
              <Text style={styles.shopDetail}>
                الفئات: {shop.product_categories.length ? shop.product_categories.join('، ') : 'غير محددة'}
              </Text>
              {shop.status === 'pending' && (
                <Text style={styles.statusNote}>
                  الملف قيد المراجعة اليدوية. ما في صلاحية لإرسال عروض قبل التفعيل.
                </Text>
              )}
              {shop.status === 'suspended' && (
                <Text style={styles.statusNote}>الملف موقوف حالياً، لذلك ما في صندوق عروض متاح.</Text>
              )}
              <View style={styles.shopActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/owner/online-profile' as Href)}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <Text style={styles.secondaryButtonText}>تعديل ملف المحل</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setIsLoading(true);
                    setErrorCode(null);
                    setRefreshKey((value) => value + 1);
                  }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <Text style={styles.secondaryButtonText}>تحديث الطلبات والتقدّم</Text>
                </Pressable>
              </View>
            </SurfaceCard>

            <SurfaceCard style={styles.ratingsCard}>
              <View style={styles.ratingsHeading}>
                <Text style={styles.count}>{ratings.length} تقييم</Text>
                <Text style={styles.sectionTitle}>تقييمات الزبائن لمحلّك</Text>
              </View>
              {ratings.length === 0 ? (
                <Text style={styles.emptyRatingText}>ما وصل تقييم لمحلّك بعد.</Text>
              ) : ratings.map((rating) => (
                <View key={rating.id} style={styles.ratingCard}>
                  <View style={styles.ratingHeading}>
                    <Text style={styles.ratingScore}>{rating.stars} / ٥</Text>
                    <Text style={styles.ratingStars}>
                      {'★'.repeat(rating.stars)}{'☆'.repeat(5 - rating.stars)}
                    </Text>
                  </View>
                  {rating.comment.trim().length > 0 ? (
                    <Text style={styles.ratingComment}>{rating.comment}</Text>
                  ) : (
                    <Text style={styles.ratingComment}>تقييم بدون تعليق.</Text>
                  )}
                </View>
              ))}
            </SurfaceCard>

            {shop.status === 'active' && (
              <>
                <View style={styles.sectionHeading}>
                  <Text style={styles.count}>{orders.length} طلب</Text>
                  <Text style={styles.sectionTitle}>الطلبات المؤكّدة لمحلّك</Text>
                </View>
                {orders.length === 0 ? (
                  <SurfaceCard style={styles.orderEmptyCard}>
                    <Text style={styles.orderEmptyText}>ما في طلبات مؤكّدة لمحلّك بعد.</Text>
                  </SurfaceCard>
                ) : orders.map((order) => (
                  <Pressable
                    key={order.id}
                    accessibilityRole="button"
                    accessibilityLabel={'افتح متابعة الطلب: ' + order.request_title}
                    onPress={() => router.push({
                      pathname: '/owner/online-request/[requestId]',
                      params: { requestId: order.request_id },
                    })}
                    style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}>
                    <View style={styles.orderHeading}>
                      <Text style={styles.orderItem}>{order.item_name || 'العرض المختار'}</Text>
                      <Text style={styles.orderRequestTitle}>{order.request_title}</Text>
                    </View>
                    {order.requested_area ? (
                      <Text style={styles.orderArea}>منطقة الطلب: {order.requested_area}</Text>
                    ) : null}
                    <Text style={styles.orderPrice}>
                      {formatPrice(order.price_amount)} {order.currency_code}
                    </Text>
                    <OrderProgress stage={order.stage} />
                    <Text style={styles.openLink}>افتح الطلب لتحديث الحالة ←</Text>
                  </Pressable>
                ))}

                <View style={styles.sectionHeading}>
                  <Text style={styles.count}>{requests.length} طلب</Text>
                  <Text style={styles.sectionTitle}>طلبات مسموح لمحلّك يشوفها</Text>
                </View>
                {requests.length === 0 ? (
                  <SurfaceCard style={styles.stateCard}>
                    <Text style={styles.stateTitle}>ما في طلبات متاحة حالياً</Text>
                    <Text style={styles.stateText}>
                      الطلبات المفتوحة أو المرتبطة بعروض محلك بتظهر هون حسب سياسات قاعدة البيانات.
                    </Text>
                  </SurfaceCard>
                ) : requests.map((request) => (
                  <Pressable
                    key={request.id}
                    accessibilityRole="button"
                    accessibilityLabel={'افتح الطلب: ' + request.title}
                    onPress={() => router.push({
                      pathname: '/owner/online-request/[requestId]',
                      params: { requestId: request.id },
                    })}
                    style={({ pressed }) => [styles.requestCard, pressed && styles.pressed]}>
                    {request.image_url ? (
                      <Image
                        accessibilityLabel="صورة طلب خاصة ومصرّح بعرضها"
                        source={{ uri: request.image_url }}
                        style={styles.requestImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.imagePlaceholderText}>طلب</Text>
                      </View>
                    )}
                    <View style={styles.requestCopy}>
                      <View style={styles.requestMeta}>
                        <Text style={styles.category}>{request.category}</Text>
                        <Text style={styles.statusInline}>{requestStatusLabel(request.status)}</Text>
                      </View>
                      <Text style={styles.requestTitle}>{request.title}</Text>
                      <Text numberOfLines={2} style={styles.requestDetails}>
                        {request.details || 'ما في تفاصيل مكتوبة.'}
                      </Text>
                      <Text style={styles.requestArea}>{request.requested_area}</Text>
                      {request.status === 'open' && (
                        <Text style={styles.openLink}>افتح الطلب وحضّر عرض ←</Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function shopStatusLabel(status: OwnerShopProfile['status']) {
  if (status === 'active') return 'مفعّل';
  if (status === 'suspended') return 'موقوف';
  return 'قيد المراجعة';
}

function requestStatusLabel(status: ShopInboxRequest['status']) {
  if (status === 'open') return 'مفتوح';
  if (status === 'closed') return 'مغلق';
  if (status === 'cancelled') return 'ملغي';
  return 'مسودة';
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DALLNI_COLORS.background },
  content: { gap: 12, paddingHorizontal: 20, paddingBottom: 30 },
  noticeCard: { gap: 5, padding: 14 },
  noticeTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  noticeText: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  demoLink: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 4 },
  demoLinkText: {
    color: DALLNI_COLORS.green,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stateCard: { alignItems: 'flex-end', gap: 10, padding: 17 },
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
  shopCard: { gap: 8, padding: 15 },
  shopHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
  },
  shopName: {
    color: DALLNI_COLORS.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusBadge: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 8,
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    writingDirection: 'rtl',
  },
  shopDetail: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusNote: {
    backgroundColor: '#FFF7E5',
    borderRadius: 10,
    color: '#755B24',
    fontSize: 10,
    lineHeight: 17,
    padding: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  shopActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 4 },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 8,
  },
  secondaryButtonText: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  count: { color: DALLNI_COLORS.muted, fontSize: 10, writingDirection: 'rtl' },
  sectionTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 12,
    padding: 11,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 9,
    padding: 12,
  },
  orderHeading: { alignItems: 'flex-end', gap: 4 },
  orderItem: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  orderRequestTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  orderArea: { color: DALLNI_COLORS.muted, fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  orderPrice: { color: DALLNI_COLORS.ink, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  orderEmptyCard: { alignItems: 'flex-end', padding: 14 },
  orderEmptyText: { color: DALLNI_COLORS.muted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  ratingsCard: { gap: 10, padding: 14 },
  ratingsHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  emptyRatingText: { color: DALLNI_COLORS.muted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  ratingCard: {
    backgroundColor: '#F7F9F8',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    padding: 10,
  },
  ratingHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  ratingScore: { color: DALLNI_COLORS.ink, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  ratingStars: { color: DALLNI_COLORS.gold, fontSize: 15 },
  ratingComment: { color: DALLNI_COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  requestImage: { backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 12, height: 86, width: 86 },
  imagePlaceholder: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 12,
    height: 86,
    justifyContent: 'center',
    width: 86,
  },
  imagePlaceholderText: { color: DALLNI_COLORS.greenDark, fontSize: 12, fontWeight: '800' },
  requestCopy: { alignItems: 'flex-end', flex: 1, gap: 6 },
  requestMeta: { alignItems: 'center', flexDirection: 'row-reverse', gap: 8 },
  category: { color: DALLNI_COLORS.green, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  statusInline: { color: DALLNI_COLORS.muted, fontSize: 9, writingDirection: 'rtl' },
  requestTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestDetails: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestArea: { color: DALLNI_COLORS.ink, fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  openLink: {
    color: DALLNI_COLORS.green,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pressed: { opacity: 0.8 },
});
