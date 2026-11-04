import { router } from 'expo-router';
import { useState } from 'react';
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
import * as Linking from 'expo-linking';

import {
  ConfirmationPanel,
  DALLNI_COLORS,
  FlowHeader,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import { CustomerRating } from '@/components/dallni/customer-rating';
import { ConnectedCustomerRequests } from '@/components/dallni/connected-customer-requests';
import { OrderProgress } from '@/components/dallni/order-progress';
import { useDemoSession } from '@/context/demo-session';
import { useSupabaseAuth } from '@/context/supabase-auth';
import {
  createWhatsAppClickToChatUrl,
  normalizeInternationalWhatsAppNumber,
} from '@/utils/whatsapp';

export default function CustomerRequestsScreen() {
  const { user, isLoading } = useSupabaseAuth();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <FlowHeader
          title="طلباتي والعروض"
          subtitle="عم نتحقق من حسابك…"
          onBack={() => router.back()}
        />
        <View style={styles.emptyCard}>
          <ActivityIndicator color={DALLNI_COLORS.green} />
          <Text style={styles.emptyText}>عم نجهّز طلباتك…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return user
    ? <ConnectedCustomerRequests customerId={user.id} />
    : <DemoCustomerRequestsScreen />;
}

function DemoCustomerRequestsScreen() {
  const { approvedRequests, rateCompletedOrder, selectOffer } = useDemoSession();
  const [pendingOfferIds, setPendingOfferIds] = useState<Record<string, string>>({});

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title="طلباتي والعروض"
        subtitle="طلباتك بهالجلسة وأي عرض تجريبي وصلها."
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <SurfaceCard style={styles.demoNotice}>
          <Text style={styles.demoNoticeTitle}>تجربة مؤقتة</Text>
          <Text style={styles.demoNoticeText}>
            الطلبات والصور والعروض بتضلّ بهالجلسة وبتنمسح لما تسكّر التطبيق. ما في شي بينبعت لزبون أو محل حقيقي.
          </Text>
        </SurfaceCard>

        {approvedRequests.length === 0 ? (
          <SurfaceCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>ما عندك طلبات بهالجلسة بعد</Text>
            <Text style={styles.emptyText}>
              ابدأ طلب جديد ووافق عليه، ورح تلاقيه هون.
            </Text>
          </SurfaceCard>
        ) : (
          approvedRequests.map((request) => {
            const pendingOfferId =
              pendingOfferIds[request.id] ?? request.selectedOfferId;
            const selectedOffer = request.offers.find(
              (offer) => offer.id === request.selectedOfferId,
            );
            const whatsappNumber = selectedOffer
              ? normalizeInternationalWhatsAppNumber(selectedOffer.whatsappNumber ?? '')
              : null;
            const selectionConfirmed =
              selectedOffer !== undefined && pendingOfferId === selectedOffer.id;

            return (
              <SurfaceCard key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeading}>
                  <Text style={styles.statusTag}>
                    {request.offers.length > 0
                      ? `${request.offers.length} عروض تجريبية`
                      : 'ناطرين عرض'}
                  </Text>
                  <Text style={styles.requestTitle}>{request.title}</Text>
                </View>

                {request.details.length > 0 && (
                  <Text style={styles.details}>{request.details}</Text>
                )}

                <OfferLine label="الفئة" value={request.category} />
                <OfferLine label="منطقة الطلب" value={request.area} />

                {request.imageUri && (
                  <Image
                    accessibilityLabel="الصورة التي أرفقتها بطلبك"
                    source={{ uri: request.imageUri }}
                    style={styles.requestImage}
                    resizeMode="contain"
                  />
                )}

                {request.offers.length === 0 ? (
                  <View style={styles.waitingCard}>
                    <Text style={styles.waitingHeading}>بعده ما وصل ولا عرض</Text>
                    <Text style={styles.waitingText}>
                      أول ما صاحب محل يأكّد عرض تجريبي، رح يبين هون لتقارني وتختاري.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.comparisonSection}>
                    <Text style={styles.offerHeading}>قارن عروض المحلات</Text>
                    {request.offers.map((offer) => {
                      const isPending = pendingOfferId === offer.id;
                      const isSelected = request.selectedOfferId === offer.id;

                      return (
                        <Pressable
                          key={offer.id}
                          accessibilityRole="radio"
                          accessibilityLabel={`اختيار عرض من ${offer.shopName} بسعر ${offer.price} دولار`}
                          accessibilityState={{ checked: isPending }}
                          onPress={() =>
                            setPendingOfferIds((current) => ({
                              ...current,
                              [request.id]: offer.id,
                            }))
                          }
                          style={({ pressed }) => [
                            styles.offerChoice,
                            isPending && styles.offerChoiceActive,
                            pressed && styles.offerChoicePressed,
                          ]}>
                          <View style={styles.offerChoiceHeading}>
                            <Text style={styles.offerChoiceStatus}>
                              {isSelected ? 'مختار' : isPending ? 'للتأكيد' : 'عرض'}
                            </Text>
                            <Text style={styles.shopName}>{offer.shopName}</Text>
                          </View>
                          <OfferLine
                            label="الموقع"
                            value={offer.shopLocation || 'الموقع غير محدد'}
                          />
                          <OfferLine label="المنتج" value={offer.itemName} />
                          <OfferLine label="السعر" value={offer.price + ' $'} />
                          <OfferLine label="التوصيل" value={offer.deliveryNote} />
                        </Pressable>
                      );
                    })}

                    {pendingOfferId && !selectionConfirmed && (
                      <PrimaryButton
                        label="تأكيد اختيار العرض"
                        onPress={() => selectOffer(request.id, pendingOfferId)}
                      />
                    )}

                    {selectionConfirmed && selectedOffer && (
                      <ConfirmationPanel>
                        <Text style={styles.confirmationTitle}>تمّ اختيار العرض</Text>
                        <Text style={styles.confirmationText}>
                          اخترت عرض {selectedOffer.shopName}. هيدا اختيار تجريبي ومحفوظ بهالجلسة بس.
                        </Text>
                        <OfferLine label="الموقع" value={selectedOffer.shopLocation || 'الموقع غير محدد'} />
                        <OfferLine label="المنتج" value={selectedOffer.itemName} />
                        <OfferLine label="السعر" value={selectedOffer.price + ' $'} />
                        <OfferLine label="التوصيل" value={selectedOffer.deliveryNote} />
                      </ConfirmationPanel>
                    )}

                    {selectedOffer && request.orderStage && (
                      <OrderProgress stage={request.orderStage} />
                    )}

                    {selectionConfirmed &&
                      selectedOffer &&
                      request.orderStage === 'completed' && (
                        <CustomerRating
                          rating={request.rating}
                          shopName={selectedOffer.shopName}
                          onSubmit={(stars, comment) =>
                            rateCompletedOrder(request.id, stars, comment)
                          }
                        />
                      )}

                    {selectionConfirmed && selectedOffer && (
                      <View style={styles.whatsappSection}>
                        <PrimaryButton
                          disabled={!whatsappNumber}
                          label="تواصل عبر واتساب"
                          onPress={() => {
                            const url = createWhatsAppClickToChatUrl(
                              selectedOffer.whatsappNumber ?? '',
                              {
                                requestTitle: request.title,
                                requestDetails: request.details,
                                shopName: selectedOffer.shopName,
                                itemName: selectedOffer.itemName,
                                price: selectedOffer.price,
                                deliveryNote: selectedOffer.deliveryNote,
                              },
                            );

                            if (!url) {
                              Alert.alert(
                                'رقم واتساب غير متاح',
                                'رقم المحل مفقود أو غير صالح حالياً.',
                              );
                              return;
                            }

                            void Linking.openURL(url).catch(() => {
                              Alert.alert(
                                'تعذّر فتح واتساب',
                                'جرّب مرة تانية أو تأكد إن في تطبيق بيفتح رابط واتساب.',
                              );
                            });
                          }}
                        />
                        <Text style={styles.whatsappNote}>
                          {whatsappNumber
                            ? 'رح يفتح واتساب برسالة جاهزة. ما بتنرسل إلا لما تضغط إرسال.'
                            : 'رقم واتساب للمحل غير متوفر أو غير صالح.'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </SurfaceCard>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: DALLNI_COLORS.background,
    flex: 1,
  },
  content: {
    gap: 13,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  demoNotice: {
    backgroundColor: DALLNI_COLORS.greenLight,
    gap: 5,
    padding: 14,
  },
  demoNoticeTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  demoNoticeText: {
    color: '#526A60',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestCard: {
    gap: 12,
    padding: 15,
  },
  requestHeading: {
    alignItems: 'flex-end',
    gap: 7,
  },
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
  requestTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  details: {
    color: '#566C62',
    fontSize: 12,
    lineHeight: 21,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  requestImage: {
    alignSelf: 'stretch',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 13,
    height: 185,
    width: '100%',
  },
  offerCard: {
    backgroundColor: '#F7F9F8',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 13,
  },
  offerHeading: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  comparisonSection: {
    gap: 10,
  },
  whatsappSection: {
    gap: 6,
  },
  whatsappNote: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  offerChoice: {
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 13,
    borderWidth: 1,
    gap: 9,
    padding: 12,
  },
  offerChoiceActive: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: DALLNI_COLORS.green,
  },
  offerChoicePressed: {
    opacity: 0.82,
  },
  offerChoiceHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  shopName: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  offerChoiceStatus: {
    color: DALLNI_COLORS.green,
    fontSize: 10,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  offerLine: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'space-between',
  },
  offerLabel: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  offerValue: {
    color: DALLNI_COLORS.ink,
    flex: 1,
    fontSize: 12,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  waitingCard: {
    backgroundColor: '#F7F9F8',
    borderRadius: 13,
    padding: 12,
  },
  waitingText: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  waitingHeading: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
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
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emptyCard: {
    alignItems: 'flex-end',
    gap: 7,
    padding: 16,
  },
  emptyTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emptyText: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
