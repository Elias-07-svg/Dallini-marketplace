import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DALLNI_COLORS,
  FlowHeader,
  FlowSteps,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';

const quickExamples = ['بدّي موبايل جديد', 'كنباية مستعملة', 'سماعات بلوتوث'];
const MAX_REQUEST_IMAGE_DIMENSION = 1920;

export default function RequestScreen() {
  const { prompt, category } = useLocalSearchParams<{
    prompt?: string | string[];
    category?: string | string[];
  }>();
  const starterPrompt = Array.isArray(prompt) ? prompt[0] : prompt;
  const starterCategory = Array.isArray(category) ? category[0] : category;
  const [details, setDetails] = useState(starterPrompt ?? '');
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [attachmentMimeType, setAttachmentMimeType] = useState<string | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const hasRequestContent = Boolean(details.trim()) || attachmentUri !== null;

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setIsPreparingImage(true);
        const imageContext = ImageManipulator.ImageManipulator.manipulate(
          result.assets[0].uri,
          {
            maxWidth: MAX_REQUEST_IMAGE_DIMENSION,
            maxHeight: MAX_REQUEST_IMAGE_DIMENSION,
          },
        );
        const renderedImage = await imageContext.renderAsync();
        const preparedImage = await renderedImage.saveAsync({
          compress: 0.78,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        setAttachmentUri(preparedImage.uri);
        setAttachmentMimeType('image/jpeg');
      }
    } catch {
      Alert.alert('ما قدرنا نجهّز الصورة', 'اختار صورة تانية أو جرّب مرة تانية.');
    } finally {
      setIsPreparingImage(false);
    }
  }

  function openReview() {
    router.push({
      pathname: '/review',
      params: {
        details: details.trim(),
        imageUri: attachmentUri ?? '',
        imageMimeType: attachmentMimeType ?? '',
        category: starterCategory ?? '',
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <FlowHeader
          title="خلّينا نرتّب طلبك"
          subtitle="اكتب شو بدك، وأضف صورة إذا بتساعد على التوضيح."
          onBack={() => router.back()}
        />
        <FlowSteps activeStep="request" />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {starterCategory && (
            <View style={styles.selectedCategory}>
              <Text style={styles.selectedCategoryHint}>الفئة المختارة</Text>
              <Text style={styles.selectedCategoryName}>{starterCategory}</Text>
              <Text style={styles.selectedCategoryNote}>فيك تغيّرها بصفحة المراجعة</Text>
            </View>
          )}

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>شو بدك تلاقي؟</Text>
            <Text style={styles.sectionDescription}>
              اكتب اسم المنتج ومواصفاته أو أي تفاصيل بتساعد المحل يفهم طلبك.
            </Text>
          </View>

          <SurfaceCard style={styles.detailsCard}>
            <View style={styles.fieldHeading}>
              <Text style={styles.fieldLabel}>وصف الطلب</Text>
              <Text style={styles.characterCount}>{details.length}/500</Text>
            </View>
            <TextInput
              accessibilityLabel="وصف طلبك"
              maxLength={500}
              multiline
              onChangeText={setDetails}
              placeholder="مثلاً: بدّي سماعات بلوتوث بسعر منيح..."
              placeholderTextColor="#9AA8A0"
              style={styles.detailsInput}
              textAlign="right"
              textAlignVertical="top"
              value={details}
            />
          </SurfaceCard>

          {!details.trim() && (
            <View style={styles.examples}>
              <Text style={styles.examplesTitle}>أمثلة سريعة</Text>
              <View style={styles.exampleRow}>
                {quickExamples.map((example) => (
                  <Pressable
                    key={example}
                    accessibilityRole="button"
                    onPress={() => setDetails(example)}
                    style={({ pressed }) => [styles.exampleChip, pressed && styles.pressed]}>
                    <Text style={styles.exampleText}>{example}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {attachmentUri && (
            <SurfaceCard style={styles.attachmentCard}>
              <Image
                accessibilityLabel="الصورة المرفقة بالطلب"
                source={{ uri: attachmentUri }}
                style={styles.attachmentThumbnail}
                resizeMode="cover"
              />
              <View style={styles.attachmentCopy}>
                <Text style={styles.attachmentTitle}>الصورة جاهزة للإرفاق</Text>
                <Text style={styles.attachmentNote}>جهّزناها بحجم مناسب للإرسال.</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إزالة الصورة المرفقة"
                  onPress={() => {
                    setAttachmentUri(null);
                    setAttachmentMimeType(null);
                  }}
                  style={({ pressed }) => [styles.removeImageButton, pressed && styles.pressed]}>
                  <Text style={styles.removeImageText}>إزالة الصورة</Text>
                </Pressable>
              </View>
            </SurfaceCard>
          )}

          <View style={styles.privacyNote}>
            <Text style={styles.privacyIcon}>ⓘ</Text>
            <Text style={styles.privacyText}>
              النص والصورة ما بيننشروا إلا بعد ما تراجع الطلب وتوافق بالخطوة التالية.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isPreparingImage }}
            accessibilityLabel={isPreparingImage
              ? 'جاري تجهيز الصورة'
              : attachmentUri
                ? 'تغيير الصورة المرفقة'
                : 'إرفاق صورة من الجهاز'}
            disabled={isPreparingImage}
            onPress={pickImage}
            style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}>
            {isPreparingImage ? (
              <ActivityIndicator color={DALLNI_COLORS.green} />
            ) : (
              <>
                <Text style={styles.attachIcon}>＋</Text>
                <Text style={styles.attachText}>
                  {attachmentUri ? 'تغيير الصورة' : 'أضف صورة (اختياري)'}
                </Text>
              </>
            )}
          </Pressable>
          <PrimaryButton
            disabled={!hasRequestContent || isPreparingImage}
            label={isPreparingImage ? 'عم نجهّز الصورة…' : 'راجع الطلب'}
            onPress={openReview}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: DALLNI_COLORS.background,
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  selectedCategory: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: '#D8EAE1',
    borderRadius: 13,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectedCategoryHint: {
    color: DALLNI_COLORS.muted,
    fontSize: 9,
    writingDirection: 'rtl',
  },
  selectedCategoryName: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  selectedCategoryNote: {
    color: DALLNI_COLORS.muted,
    fontSize: 9,
    writingDirection: 'rtl',
  },
  sectionHeading: {
    alignItems: 'flex-end',
    gap: 5,
  },
  sectionTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionDescription: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailsCard: {
    gap: 8,
    padding: 13,
  },
  fieldHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  characterCount: {
    color: DALLNI_COLORS.muted,
    fontSize: 9,
  },
  detailsInput: {
    color: DALLNI_COLORS.ink,
    fontSize: 14,
    lineHeight: 23,
    minHeight: 145,
    paddingHorizontal: 3,
    paddingTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  examples: {
    alignItems: 'flex-end',
    gap: 8,
  },
  examplesTitle: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  exampleRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'flex-start',
  },
  exampleChip: {
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  exampleText: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  attachmentCard: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
    padding: 10,
  },
  attachmentThumbnail: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 12,
    height: 62,
    width: 62,
  },
  attachmentCopy: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 5,
  },
  attachmentTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 11,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  attachmentNote: {
    color: DALLNI_COLORS.muted,
    fontSize: 9,
    writingDirection: 'rtl',
  },
  removeImageButton: {
    paddingVertical: 3,
  },
  removeImageText: {
    color: '#A3493C',
    fontSize: 10,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  privacyNote: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 8,
    paddingHorizontal: 4,
  },
  privacyIcon: {
    color: DALLNI_COLORS.green,
    fontSize: 15,
    lineHeight: 20,
  },
  privacyText: {
    color: DALLNI_COLORS.muted,
    flex: 1,
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  footer: {
    backgroundColor: DALLNI_COLORS.background,
    borderTopColor: DALLNI_COLORS.border,
    borderTopWidth: 1,
    gap: 9,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  attachButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    minHeight: 39,
    paddingHorizontal: 11,
  },
  attachIcon: {
    color: DALLNI_COLORS.green,
    fontSize: 20,
    lineHeight: 22,
  },
  attachText: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.82,
  },
});
