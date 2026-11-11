import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
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

import { useDemoSession } from '@/context/demo-session';
import { useSupabaseAuth } from '@/context/supabase-auth';
import {
  ConfirmationPanel,
  DALLNI_COLORS,
  FlowHeader,
  FlowSteps,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import { REQUEST_CATEGORIES } from '@/data/request-categories';
import {
  publishCustomerRequest,
  type CustomerRequestPublishProgress,
} from '@/lib/publish-customer-request';

const SHOP_SHARING_DISCLOSURE =
  'بعد ما تنشر طلبك، أصحاب المحلات الموثّقين بيقدروا يشوفوا وصف الطلب وفئته ومنطقته والصورة المرفقة ليقدّموا عروض. إذا اخترت عرض، المحل المختار بيضل عنده وصول لتفاصيل الطلب والصورة للمتابعة.';

function requestTitle(details: string, hasImage: boolean) {
  const firstUsefulLine = details
    .split(/\r?\n/u)
    .map((line) => line.replace(/^[\s•\-]+/u, '').trim())
    .find(Boolean);

  return (firstUsefulLine || (hasImage ? 'طلب مع صورة مرفقة' : 'طلب جديد')).slice(0, 72);
}

function friendlyPublishError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (/SUPABASE_NOT_CONFIGURED/.test(message)) {
    return 'ما قدرنا نجهّز حفظ الطلب. جرّب مرة تانية، أو تابع بالتجربة من دون تسجيل دخول.';
  }
  if (/REQUEST_IMAGE_UNSUPPORTED_TYPE/.test(message)) {
    return 'صيغة الصورة غير مدعومة. اختار صورة JPG أو PNG أو WEBP.';
  }
  if (/REQUEST_IMAGE_TOO_LARGE/.test(message)) {
    return 'حجم الصورة أكبر من ٨ ميغابايت. اختار صورة أصغر.';
  }
  if (/REQUEST_IMAGE_READ_FAILED/.test(message)) {
    return 'ما قدرنا نقرأ الصورة من الجهاز. اختارها مرة تانية وحاول من جديد.';
  }
  if (/REQUEST_DRAFT_NOT_FOUND|REQUEST_DRAFT_NOT_EDITABLE/.test(message)) {
    return 'المسودة ما عادت متاحة. ارجع للرئيسية وابدأ طلب جديد.';
  }
  if (/network request failed|failed to fetch|networkerror|econnrefused|timeout/i.test(message)) {
    return 'ما قدرنا نوصل بالخدمة. تحقق من اتصال الإنترنت وحاول مرة تانية.';
  }
  if (/PGRST202|PGRST205|could not find the function|could not find the table|relation .* does not exist|bucket.*not found/i.test(message)) {
    return 'في مشكلة مؤقتة بحفظ الطلب. حاول مرة تانية، وإذا استمرت تواصل معنا.';
  }
  return 'ما قدرنا نحفظ الطلب هلّق. تحقق من اتصال الإنترنت وحاول مرة تانية.';
}

export default function ReviewScreen() {
  const { addApprovedRequest } = useDemoSession();
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const { details, imageUri, imageMimeType, category: selectedCategory } = useLocalSearchParams<{
    details?: string | string[];
    imageUri?: string | string[];
    imageMimeType?: string | string[];
    category?: string | string[];
  }>();
  const detailText = Array.isArray(details) ? details[0] : details;
  const imageText = Array.isArray(imageUri) ? imageUri[0] : imageUri;
  const imageMimeTypeText = Array.isArray(imageMimeType)
    ? imageMimeType[0]
    : imageMimeType;
  const categoryText = Array.isArray(selectedCategory)
    ? selectedCategory[0]
    : selectedCategory;
  const attachmentUri = imageText?.trim() ? imageText : null;
  const attachmentMimeType = imageMimeTypeText?.trim() || null;
  const [detailsText, setDetailsText] = useState(detailText ?? '');
  const initialCategory = categoryText?.trim().slice(0, 80) ?? '';
  const [category, setCategory] = useState<string | null>(initialCategory || null);
  const [area, setArea] = useState('');
  const [approved, setApproved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [savedToSupabase, setSavedToSupabase] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishProgress, setPublishProgress] =
    useState<CustomerRequestPublishProgress | null>(null);
  const hasRequestContent = detailsText.trim().length > 0 || attachmentUri !== null;
  const canApprove =
    hasRequestContent && category !== null && area.trim().length > 0;
  const categoryOptions = category && !REQUEST_CATEGORIES.includes(category as (typeof REQUEST_CATEGORIES)[number])
    ? [...REQUEST_CATEGORIES, category]
    : REQUEST_CATEGORIES;

  async function handleApproval() {
    if (!approved || !canApprove || !category || !area.trim() || isAuthLoading || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      if (user) {
        await publishCustomerRequest(
          {
            customerId: user.id,
            title: requestTitle(detailsText, attachmentUri !== null),
            details: detailsText,
            category,
            requestedArea: area.trim(),
            imageUri: attachmentUri,
            imageMimeType: attachmentMimeType,
          },
          publishProgress,
          setPublishProgress,
        );
        setSavedToSupabase(true);
      } else {
        setSavedToSupabase(false);
      }

      // Keep the existing same-session shop demo usable after the cloud save.
      addApprovedRequest({
        category,
        area: area.trim(),
        details: detailsText,
        imageUri: attachmentUri,
      });
      setConfirmed(true);
    } catch (error) {
      setSaveError(friendlyPublishError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlowHeader
        title={confirmed ? 'طلبك صار جاهز' : 'راجع طلبك'}
        subtitle={
          confirmed
            ? savedToSupabase
              ? 'تم نشر طلبك. تابع العروض من صفحة طلباتي والعروض.'
              : 'تم حفظ طلبك بالتجربة.'
            : 'راجع النص أو الصورة المرفقة قبل ما توافق.'
        }
        onBack={() => router.back()}
      />
      <FlowSteps activeStep="review" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.summaryHeading}>
          <View style={styles.summaryIcon}>
            <Text style={styles.summaryIconText}>✦</Text>
          </View>
          <View style={styles.summaryHeadingCopy}>
            <Text style={styles.summaryTitle}>تفاصيل الطلب</Text>
            <Text style={styles.summarySubtitle}>تأكّد من تفاصيل طلبك</Text>
          </View>
        </View>

        {detailsText.trim().length > 0 && (
          <SurfaceCard style={styles.detailsCard}>
            <TextInput
              accessibilityLabel="تفاصيل طلبك القابلة للتعديل"
              maxLength={1400}
              multiline
              editable={!confirmed && !isSaving}
              onChangeText={setDetailsText}
              placeholder="اكتب تفاصيل طلبك هون..."
              placeholderTextColor="#9AA8A0"
              style={styles.editableDetails}
              textAlign="right"
              textAlignVertical="top"
              value={detailsText}
            />
          </SurfaceCard>
        )}

        {attachmentUri && (
          <SurfaceCard style={styles.attachmentCard}>
            <Text style={styles.attachmentTitle}>الصورة المرفقة</Text>
            <Image
              source={{ uri: attachmentUri }}
              style={styles.reviewImage}
              resizeMode="contain"
            />
          </SurfaceCard>
        )}

        <SurfaceCard style={styles.matchingFields}>
          <Text style={styles.matchingTitle}>اختار فئة الطلب</Text>
          <View style={styles.categoryOptions}>
            {categoryOptions.map((requestCategory) => {
              const selected = category === requestCategory;
              return (
                <Pressable
                  key={requestCategory}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: confirmed || isSaving }}
                  disabled={confirmed || isSaving}
                  onPress={() => setCategory(requestCategory)}
                  style={({ pressed }) => [
                    styles.categoryOption,
                    selected && styles.categoryOptionSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.categoryOptionText,
                      selected && styles.categoryOptionTextSelected,
                    ]}>
                    {requestCategory}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.matchingTitle}>المنطقة المطلوبة</Text>
          <TextInput
            accessibilityLabel="المنطقة المطلوبة"
            editable={!confirmed && !isSaving}
            maxLength={80}
            onChangeText={setArea}
            placeholder="مثلاً: بيروت - الحمرا"
            placeholderTextColor="#9AA8A0"
            style={styles.areaInput}
            textAlign="right"
            value={area}
          />
          <Text style={styles.matchingHint}>
            اختار الفئة واكتب المنطقة لحتى نعرض الطلبات المطابقة للمحلات.
          </Text>
        </SurfaceCard>

        {!confirmed && (
          <View style={styles.disclosureCard}>
            <Text style={styles.disclosureTitle}>
              {user ? 'مين بيقدر يشوف طلبك؟' : 'مشاركة الطلب بالتجربة'}
            </Text>
            <Text style={styles.disclosureText}>
              {user
                ? SHOP_SHARING_DISCLOSURE
                : 'إذا وافقت، صاحب المحل التجريبي بهالجلسة بيشوف تفاصيل الطلب والصورة المرفقة. ما في محل حقيقي بيستقبل الطلب.'}
            </Text>
          </View>
        )}

        <View style={styles.localNotice}>
          <Text style={styles.localNoticeIcon}>ⓘ</Text>
          <Text style={styles.localNoticeText}>
            {isAuthLoading
              ? 'عم نتحقق من حالة تسجيل الدخول…'
              : user
                ? 'بعد النشر، أصحاب المحلات المؤهّلين بيقدروا يقدّموا عروض. بتشوفها وتتابع طلبك من صفحة طلباتي والعروض.'
                : 'هيدي تجربة من دون حساب؛ الطلب والصورة بيضلّوا لهالجلسة وبيتنمسحوا لما تسكّر التطبيق.'}
          </Text>
        </View>

        {!user && !isAuthLoading && !confirmed && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/auth' as Href)}
            style={({ pressed }) => [styles.signInPrompt, pressed && styles.pressed]}>
            <Text style={styles.signInPromptText}>
              سجّل دخولك لحفظ الطلب بحسابك ومتابعة العروض من أي جهاز.
            </Text>
          </Pressable>
        )}

        {saveError && !confirmed && (
          <View style={styles.errorNotice}>
            <Text style={styles.errorText}>{saveError}</Text>
            {publishProgress && (
              <Text style={styles.errorHint}>
                طلبك محفوظ كمسودة خاصة وما اننشر بعد. جرّب مرة تانية لإكمال النشر.
              </Text>
            )}
          </View>
        )}

        {confirmed ? (
          <ConfirmationPanel>
            <Text style={styles.confirmationTitle}>تمّ تأكيد طلبك</Text>
            <Text style={styles.confirmationText}>
              {savedToSupabase
                ? 'تم نشر طلبك بنجاح. أصحاب المحلات المؤهّلون بيقدروا يقدّموا عروض، وتقدر تتابعها من صفحة طلباتي والعروض.'
                : 'تم حفظ طلبك بالتجربة بهالجلسة فقط، وما رح يوصل لمحل حقيقي.'}
            </Text>
            <Text style={styles.confirmationText}>
              الفئة: {category ?? ''} · المنطقة: {area.trim()}
            </Text>
          </ConfirmationPanel>
        ) : (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: approved, disabled: isSaving || isAuthLoading }}
            disabled={isSaving || isAuthLoading}
            onPress={() => setApproved((current) => !current)}
            style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}>
            <View style={[styles.checkbox, approved && styles.checkboxChecked]}>
              {approved && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              {user
                ? 'قرأت وفهمت هالمعلومة وبوافق على نشر الطلب بهالشروط.'
                : 'راجعت التفاصيل وبوافق على اعتماد هالطلب التجريبي بهالجلسة.'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {confirmed ? (
          <PrimaryButton
            label="الرئيسية"
            onPress={() => router.replace('/(tabs)')}
          />
        ) : (
          <PrimaryButton
            disabled={!approved || !canApprove || isSaving || isAuthLoading}
            label={
              isAuthLoading
                ? 'عم نتحقق من الحساب…'
                : isSaving
                  ? 'عم نحفظ طلبك…'
                  : user
                    ? 'انشر الطلب'
                    : 'أكّد الطلب'
            }
            onPress={handleApproval}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: DALLNI_COLORS.background,
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  summaryHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 11,
    marginBottom: 12,
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 17,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  summaryIconText: {
    color: DALLNI_COLORS.green,
    fontSize: 19,
  },
  summaryHeadingCopy: {
    alignItems: 'flex-end',
  },
  summaryTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summarySubtitle: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailsCard: {
    padding: 12,
  },
  editableDetails: {
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    lineHeight: 23,
    minHeight: 132,
    padding: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  attachmentCard: {
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  matchingFields: {
    gap: 11,
    marginTop: 12,
    padding: 14,
  },
  matchingTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  categoryOptions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  categoryOptionSelected: {
    backgroundColor: DALLNI_COLORS.green,
    borderColor: DALLNI_COLORS.green,
  },
  categoryOptionText: {
    color: DALLNI_COLORS.ink,
    fontSize: 11,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  categoryOptionTextSelected: {
    color: '#FFFFFF',
  },
  areaInput: {
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    writingDirection: 'rtl',
  },
  matchingHint: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  attachmentTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  reviewImage: {
    alignSelf: 'stretch',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 12,
    height: 190,
    width: '100%',
  },
  localNotice: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 9,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  localNoticeIcon: {
    color: DALLNI_COLORS.green,
    fontSize: 17,
    lineHeight: 21,
  },
  localNoticeText: {
    color: DALLNI_COLORS.muted,
    flex: 1,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  disclosureCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9EAE1',
    borderRadius: 15,
    borderWidth: 1,
    gap: 7,
    marginTop: 15,
    padding: 14,
  },
  disclosureTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  disclosureText: {
    color: DALLNI_COLORS.ink,
    fontSize: 11,
    lineHeight: 19,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  signInPrompt: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingVertical: 6,
  },
  signInPromptText: {
    color: DALLNI_COLORS.green,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorNotice: {
    backgroundColor: '#FFF5F3',
    borderColor: '#F0D4CF',
    borderRadius: 13,
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
    padding: 12,
  },
  errorText: {
    color: '#9B3830',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorHint: {
    color: '#7D4A44',
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  consentRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 11,
    marginTop: 22,
    paddingVertical: 8,
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#B9C9C0',
    borderRadius: 6,
    borderWidth: 1.5,
    height: 23,
    justifyContent: 'center',
    marginTop: 1,
    width: 23,
  },
  checkboxChecked: {
    backgroundColor: DALLNI_COLORS.green,
    borderColor: DALLNI_COLORS.green,
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 17,
  },
  consentText: {
    color: DALLNI_COLORS.ink,
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  confirmationTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  confirmationText: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  footer: {
    backgroundColor: DALLNI_COLORS.background,
    borderTopColor: DALLNI_COLORS.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  pressed: {
    opacity: 0.82,
  },
});
