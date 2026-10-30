import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ChatMessageBubble,
  DALLNI_COLORS,
  FlowHeader,
  FlowSteps,
  PrimaryButton,
} from '@/components/dallni/flow-ui';

type Message = {
  id: number;
  role: 'assistant' | 'user';
  text?: string;
  imageUri?: string;
};

const assistantReplies = [
  'تمام! بأي منطقة بدك تلاقيه؟ وفي ميزانية تقريبية؟',
  'منيح، وصلتني. في مواصفات أو ماركة معيّنة بتهمّك؟',
  'ممتاز، هيك صار عندي صورة أوضح. فيك تراجعي طلبك وتعدّلي التفاصيل قبل التأكيد.',
  'وصلت هالتفصيلة كمان. كمّلي للمراجعة وقت تكوني جاهزة.',
];

const imageReply =
  'وصلتني الصورة، شكراً! خبرني شو عم تفتّش عليه وأي تفاصيل بتهمّك.';
const quickPrompts = ['بدّي موبايل جديد', 'كنباية مستعملة'];

export default function RequestScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      text: 'أهلا فيك بدَلّني! احكيلي شو عم تفتّشي عليه، حتى لو وصف بسيط.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [attachmentMimeType, setAttachmentMimeType] = useState<string | null>(null);
  const [requestImageUri, setRequestImageUri] = useState<string | null>(null);
  const [requestImageMimeType, setRequestImageMimeType] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const messageId = useRef(1);
  const userTurns = useRef(0);
  const responseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollViewInstance | null>(null);

  useEffect(
    () => () => {
      if (responseTimer.current) clearTimeout(responseTimer.current);
    },
    [],
  );

  const hasUserMessage = messages.some((message) => message.role === 'user');
  const canSend = Boolean(draft.trim()) || attachmentUri !== null;
  const canReview = hasUserMessage;
  const requestDetails = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.text?.trim() ?? '')
    .filter((text) => text.length > 0)
    .map((text) => '• ' + text)
    .join('\n')
    .slice(0, 1400);

  function sendMessage(value = draft) {
    const text = value.trim();
    const imageToSend = attachmentUri;
    const imageMimeTypeToSend = attachmentMimeType;
    if ((!text && !imageToSend) || isResponding) return;

    const turn = text ? userTurns.current + 1 : userTurns.current;
    if (text) userTurns.current = turn;
    const userMessage: Message = {
      id: messageId.current++,
      role: 'user',
      ...(text ? { text } : {}),
      ...(imageToSend ? { imageUri: imageToSend } : {}),
    };
    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setAttachmentUri(null);
    setAttachmentMimeType(null);
    if (imageToSend) {
      setRequestImageUri(imageToSend);
      setRequestImageMimeType(imageMimeTypeToSend);
    }
    setIsResponding(true);

    responseTimer.current = setTimeout(() => {
      const reply = imageToSend
        ? imageReply
        : assistantReplies[Math.max(0, Math.min(turn - 1, assistantReplies.length - 1))];
      const assistantMessage: Message = {
        id: messageId.current++,
        role: 'assistant',
        text: reply,
      };
      setMessages((current) => [...current, assistantMessage]);
      setIsResponding(false);
      responseTimer.current = null;
    }, 550);
  }

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]) {
        setAttachmentUri(result.assets[0].uri);
        setAttachmentMimeType(result.assets[0].mimeType ?? null);
      }
    } catch {
      Alert.alert('تعذّر فتح الصور', 'جرّب تختار الصورة مرة تانية.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <FlowHeader
          title="خلّينا نرتّب طلبك"
          subtitle="اكتبها بطريقتك وباللهجة اللي بترتاحلها."
          onBack={() => router.back()}
        />
        <FlowSteps activeStep="request" />

        <View style={styles.chatArea}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}>
            {!hasUserMessage && (
              <View style={styles.quickPrompts}>
                <Text style={styles.quickPromptTitle}>مش عارف من وين تبلّش؟</Text>
                <View style={styles.quickPromptRow}>
                  {quickPrompts.map((prompt) => (
                    <Pressable
                      key={prompt}
                      onPress={() => sendMessage(prompt)}
                      style={({ pressed }) => [
                        styles.quickPrompt,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.quickPromptText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {messages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                role={message.role}
                text={message.text}
                imageUri={message.imageUri}
              />
            ))}

            {isResponding && (
              <ChatMessageBubble role="assistant" text="عم رتّب التفاصيل..." />
            )}
          </ScrollView>
        </View>

        <View style={styles.composerWrap}>
          {attachmentUri && (
            <View style={styles.attachmentPreview}>
              <Image
                source={{ uri: attachmentUri }}
                style={styles.attachmentThumbnail}
                resizeMode="cover"
              />
              <View style={styles.attachmentCopy}>
                <Text style={styles.attachmentTitle}>صورة جاهزة للإرفاق</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إزالة الصورة المرفقة"
                  onPress={() => {
                    setAttachmentUri(null);
                    setAttachmentMimeType(null);
                  }}
                  style={styles.removeImageButton}>
                  <Text style={styles.removeImageText}>إزالة الصورة</Text>
                </Pressable>
              </View>
            </View>
          )}
          <View style={styles.composer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إرفاق صورة من الجهاز"
              onPress={pickImage}
              style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}>
              <Text style={styles.attachIcon}>＋</Text>
            </Pressable>
            <TextInput
              accessibilityLabel="اكتب تفاصيل طلبك"
              maxLength={500}
              multiline
              onChangeText={setDraft}
              placeholder="مثلاً: بدّي سماعات بلوتوث بسعر منيح..."
              placeholderTextColor="#9AA8A0"
              style={styles.input}
              textAlign="right"
              value={draft}
            />
            <Pressable
              accessibilityLabel="إرسال الرسالة"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSend || isResponding }}
              disabled={!canSend || isResponding}
              onPress={() => sendMessage()}
              style={({ pressed }) => [
                styles.sendButton,
                (!canSend || isResponding) && styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.sendIcon}>↑</Text>
            </Pressable>
          </View>
          <Text style={styles.localNote}>
            المحادثة تجريبية. ما منرفع الصورة إلا بعد موافقتك على نشر الطلب.
          </Text>
          <PrimaryButton
            disabled={!canReview}
            label="راجع الطلب"
            onPress={() =>
              router.push({
                pathname: '/review',
                params: {
                  details: requestDetails,
                  imageUri: requestImageUri ?? '',
                  imageMimeType: requestImageMimeType ?? '',
                },
              })
            }
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
  chatArea: {
    flex: 1,
    minHeight: 100,
  },
  messageList: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  quickPrompts: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  quickPromptTitle: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    marginBottom: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  quickPromptRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPrompt: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: '#D8EAE1',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickPromptText: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 12,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  composerWrap: {
    backgroundColor: DALLNI_COLORS.background,
    borderTopColor: DALLNI_COLORS.border,
    borderTopWidth: 1,
    gap: 9,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 10,
  },
  attachmentPreview: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.surface,
    borderColor: DALLNI_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 11,
    padding: 9,
  },
  attachmentThumbnail: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 10,
    height: 54,
    width: 54,
  },
  attachmentCopy: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 4,
  },
  attachmentTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  removeImageButton: {
    paddingVertical: 3,
  },
  removeImageText: {
    color: DALLNI_COLORS.green,
    fontSize: 11,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  attachButton: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  attachIcon: {
    color: DALLNI_COLORS.green,
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 27,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: DALLNI_COLORS.surface,
    borderColor: DALLNI_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    minHeight: 54,
    padding: 6,
  },
  input: {
    color: DALLNI_COLORS.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    maxHeight: 90,
    minHeight: 40,
    paddingHorizontal: 9,
    paddingTop: 9,
    textAlignVertical: 'top',
    writingDirection: 'rtl',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.green,
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendButtonDisabled: {
    backgroundColor: '#A5B7AF',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  localNote: {
    color: '#89978F',
    fontSize: 10,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.82,
  },
});
