import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyriaLocationPicker } from '@/components/dallni/syria-location-picker';
import { DALLNI_COLORS, PrimaryButton, SurfaceCard } from '@/components/dallni/flow-ui';
import { REQUEST_CATEGORIES, type RequestCategory } from '@/data/request-categories';
import {
  getAssistantCategoryLabel,
  getAssistantCopy,
  type AssistantLanguage,
  type AssistantStep,
} from '@/data/request-assistant';
import { formatSyriaLocationForLanguage, isSyriaLocation } from '@/utils/syria-locations';

type Message = { id: number; role: 'assistant' | 'customer'; text: string };

export default function RequestAssistantScreen() {
  const [language, setLanguage] = useState<AssistantLanguage>('ar');
  const copy = getAssistantCopy(language);
  const [step, setStep] = useState<AssistantStep>('item');
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'assistant', text: getAssistantCopy('ar').welcome },
    { id: 1, role: 'assistant', text: getAssistantCopy('ar').prompts.item },
  ]);
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RequestCategory | null>(null);
  const [location, setLocation] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const messageSequence = useRef(2);
  const scrollView = useRef<ScrollViewInstance | null>(null);

  function addMessage(role: Message['role'], text: string) {
    const message: Message = { id: messageSequence.current, role, text };
    messageSequence.current += 1;
    setMessages((current) => [...current, message]);
  }

  function ask(nextStep: Exclude<AssistantStep, 'summary'>) {
    setStep(nextStep);
    addMessage('assistant', copy.prompts[nextStep]);
  }

  function finishAnswer(nextStep: Exclude<AssistantStep, 'summary'>) {
    if (editingSummary) {
      setEditingSummary(false);
      setStep('summary');
      addMessage('assistant', copy.editSaved);
      return;
    }
    ask(nextStep);
  }

  function sendText() {
    const answer = messageDraft.trim();
    if (!answer || (step !== 'item' && step !== 'description')) return;
    addMessage('customer', answer);
    setMessageDraft('');

    if (step === 'item') {
      setItemName(answer.slice(0, 80));
      finishAnswer('description');
      return;
    }

    setDescription(answer.slice(0, 500));
    finishAnswer('category');
  }

  function selectCategory(nextCategory: RequestCategory) {
    setCategory(nextCategory);
    addMessage('customer', getAssistantCategoryLabel(nextCategory, language));
    finishAnswer('location');
  }

  function selectLocation(nextLocation: string) {
    if (!isSyriaLocation(nextLocation)) return;
    setLocation(nextLocation);
    addMessage('customer', formatSyriaLocationForLanguage(nextLocation, language));
    if (editingSummary) {
      setEditingSummary(false);
      setStep('summary');
      addMessage('assistant', copy.editSaved);
    } else {
      setStep('summary');
      addMessage('assistant', copy.summaryReady);
    }
  }

  function editField(field: Exclude<AssistantStep, 'summary'>) {
    setEditingSummary(true);
    setMessageDraft('');
    setStep(field);
    addMessage('assistant', copy.editPrompt(field));
  }

  function changeLanguage() {
    const nextLanguage: AssistantLanguage = language === 'ar' ? 'en' : 'ar';
    setLanguage(nextLanguage);
    const nextCopy = getAssistantCopy(nextLanguage);
    addMessage('assistant', nextLanguage === 'ar'
      ? 'تمام، منكمل بالعربي.'
      : 'Okay, I’ll continue in English.');
    if (step !== 'summary') addMessage('assistant', nextCopy.prompts[step]);
  }

  function buildDetails() {
    return [itemName.trim(), description.trim()].filter(Boolean).join('\n');
  }

  function continueToReview() {
    if (!itemName.trim() || !description.trim() || !category || !isSyriaLocation(location)) return;
    router.push({
      pathname: '/review',
      params: {
        details: buildDetails(),
        category,
        area: location,
      },
    } as Href);
  }

  function openManualRequest() {
    router.push({
      pathname: '/request',
      params: {
        prompt: buildDetails(),
        category: category ?? '',
        area: isSyriaLocation(location) ? location : '',
      },
    } as Href);
  }

  const canContinue = Boolean(itemName.trim() && description.trim() && category && isSyriaLocation(location));
  const textStep = step === 'item' || step === 'description';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}>
        <View style={[styles.header, language === 'en' && styles.headerEnglish]}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, language === 'en' && styles.englishText]}>{language === 'ar' ? '→ رجوع' : '← Back'}</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, language === 'en' && styles.englishText]}>{copy.title}</Text>
            <Text style={[styles.subtitle, language === 'en' && styles.englishText]}>{copy.subtitle}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={language === 'ar' ? 'Switch language to English' : 'غيّر اللغة إلى العربية'}
            onPress={changeLanguage}
            style={styles.languageButton}>
            <Text style={styles.languageText}>{copy.languageAction}</Text>
          </Pressable>
        </View>

        <View style={styles.modeNotice}>
          <Text style={[styles.modeLabel, language === 'en' && styles.englishText]}>{copy.guidedLabel}</Text>
        </View>

        <ScrollView
          ref={scrollView}
          contentContainerStyle={styles.conversation}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollView.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} language={language} />
          ))}

          {step === 'category' ? (
            <View style={[styles.choiceGroup, language === 'en' && styles.choiceGroupEnglish]}>
              {REQUEST_CATEGORIES.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: category === item }}
                  onPress={() => selectCategory(item)}
                  style={[styles.categoryChip, category === item && styles.categoryChipSelected]}>
                  <Text style={[styles.categoryChipText, category === item && styles.categoryChipTextSelected]}>
                    {getAssistantCategoryLabel(item, language)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 'location' ? (
            <SurfaceCard style={styles.locationCard}>
              <SyriaLocationPicker
                label={copy.locationLabel}
                value={location}
                language={language}
                onChange={selectLocation}
              />
            </SurfaceCard>
          ) : null}

          {step === 'summary' ? (
            <SurfaceCard style={styles.summaryCard}>
              <Text style={[styles.summaryHeading, language === 'en' && styles.englishText]}>{copy.summaryHeading}</Text>
              <DraftRow label={copy.itemLabel} value={itemName} language={language} onEdit={() => editField('item')} editLabel={copy.edit} />
              <DraftRow label={copy.descriptionLabel} value={description} language={language} onEdit={() => editField('description')} editLabel={copy.edit} />
              <DraftRow
                label={copy.categoryLabel}
                value={category ? getAssistantCategoryLabel(category, language) : ''}
                language={language}
                onEdit={() => editField('category')}
                editLabel={copy.edit}
              />
              <DraftRow
                label={copy.locationLabel}
                value={formatSyriaLocationForLanguage(location, language)}
                language={language}
                onEdit={() => editField('location')}
                editLabel={copy.edit}
              />
              <Text style={[styles.summaryNote, language === 'en' && styles.englishText]}>{copy.summaryNote}</Text>
            </SurfaceCard>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {textStep ? (
            <View style={[styles.composer, language === 'en' && styles.composerEnglish]}>
              <TextInput
                accessibilityLabel={step === 'item' ? copy.itemLabel : copy.descriptionLabel}
                editable
                maxLength={step === 'item' ? 80 : 500}
                multiline={step === 'description'}
                onChangeText={setMessageDraft}
                onSubmitEditing={step === 'item' ? sendText : undefined}
                placeholder={step === 'item' ? copy.placeholders.item : copy.placeholders.description}
                placeholderTextColor={DALLNI_COLORS.muted}
                returnKeyType={step === 'item' ? 'send' : 'default'}
                style={[styles.input, step === 'description' && styles.multilineInput, language === 'en' && styles.englishText]}
                textAlign={language === 'ar' ? 'right' : 'left'}
                textAlignVertical={step === 'description' ? 'top' : 'center'}
                value={messageDraft}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.send}
                accessibilityState={{ disabled: !messageDraft.trim() }}
                disabled={!messageDraft.trim()}
                onPress={sendText}
                style={({ pressed }) => [styles.sendButton, !messageDraft.trim() && styles.disabledButton, pressed && styles.pressed]}>
                <Text style={styles.sendText}>{copy.send}</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 'summary' ? (
            <PrimaryButton disabled={!canContinue} label={copy.continueReview} onPress={continueToReview} />
          ) : null}

          <Pressable accessibilityRole="button" onPress={openManualRequest} style={styles.manualButton}>
            <Text style={[styles.manualText, language === 'en' && styles.englishText]}>{copy.manualEntry}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message, language }: { message: Message; language: AssistantLanguage }) {
  const isCustomer = message.role === 'customer';
  return (
    <View style={[styles.messageRow, isCustomer ? styles.customerMessageRow : styles.assistantMessageRow]}>
      <View style={[styles.messageBubble, isCustomer ? styles.customerBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, isCustomer && styles.customerMessageText, language === 'en' && styles.englishText]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

function DraftRow({ label, value, language, onEdit, editLabel }: { label: string; value: string; language: AssistantLanguage; onEdit: () => void; editLabel: string }) {
  return (
    <View style={[styles.draftRow, language === 'en' && styles.draftRowEnglish]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${editLabel}: ${label}`} onPress={onEdit} style={styles.editButton}>
        <Text style={styles.editText}>{editLabel}</Text>
      </Pressable>
      <View style={styles.draftCopy}>
        <Text style={[styles.draftLabel, language === 'en' && styles.englishText]}>{label}</Text>
        <Text style={[styles.draftValue, language === 'en' && styles.englishText]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  keyboardContainer: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row-reverse', gap: 9, paddingHorizontal: 16, paddingVertical: 10 },
  headerEnglish: { flexDirection: 'row' },
  backButton: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 12, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 10 },
  backText: { color: DALLNI_COLORS.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  headerCopy: { alignItems: 'flex-end', flex: 1, gap: 2 },
  title: { color: DALLNI_COLORS.ink, fontSize: 17, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: DALLNI_COLORS.muted, fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  languageButton: { backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 11, justifyContent: 'center', minHeight: 40, paddingHorizontal: 10 },
  languageText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '900' },
  modeNotice: { borderBottomColor: DALLNI_COLORS.border, borderBottomWidth: 1, paddingHorizontal: 18, paddingBottom: 9 },
  modeLabel: { color: DALLNI_COLORS.muted, fontSize: 9, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  conversation: { gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  messageRow: { flexDirection: 'row', width: '100%' },
  assistantMessageRow: { justifyContent: 'flex-start' },
  customerMessageRow: { justifyContent: 'flex-end' },
  messageBubble: { borderRadius: 16, maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 10 },
  assistantBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 5, borderColor: DALLNI_COLORS.border, borderWidth: 1 },
  customerBubble: { backgroundColor: DALLNI_COLORS.green, borderBottomRightRadius: 5 },
  messageText: { color: DALLNI_COLORS.ink, fontSize: 12, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
  customerMessageText: { color: '#FFFFFF' },
  choiceGroup: { alignItems: 'flex-end', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-start', paddingVertical: 2 },
  choiceGroupEnglish: { flexDirection: 'row', justifyContent: 'flex-start' },
  categoryChip: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 14, borderWidth: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  categoryChipSelected: { backgroundColor: DALLNI_COLORS.greenLight, borderColor: DALLNI_COLORS.green },
  categoryChipText: { color: DALLNI_COLORS.ink, fontSize: 11, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  categoryChipTextSelected: { color: DALLNI_COLORS.greenDark, fontWeight: '900' },
  locationCard: { padding: 11 },
  summaryCard: { gap: 12, padding: 14 },
  summaryHeading: { color: DALLNI_COLORS.ink, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  draftRow: { alignItems: 'flex-start', borderBottomColor: '#EDF2EE', borderBottomWidth: 1, flexDirection: 'row-reverse', gap: 10, paddingBottom: 10 },
  draftRowEnglish: { flexDirection: 'row' },
  editButton: { backgroundColor: DALLNI_COLORS.greenLight, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  editText: { color: DALLNI_COLORS.greenDark, fontSize: 9, fontWeight: '900' },
  draftCopy: { alignItems: 'flex-end', flex: 1, gap: 4 },
  draftLabel: { color: DALLNI_COLORS.muted, fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  draftValue: { color: DALLNI_COLORS.ink, fontSize: 12, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  summaryNote: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  footer: { backgroundColor: DALLNI_COLORS.background, borderTopColor: DALLNI_COLORS.border, borderTopWidth: 1, gap: 8, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 6 },
  composer: { alignItems: 'flex-end', flexDirection: 'row-reverse', gap: 8 },
  composerEnglish: { flexDirection: 'row' },
  input: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 14, borderWidth: 1, color: DALLNI_COLORS.ink, flex: 1, fontSize: 12, maxHeight: 100, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, textAlign: 'right', writingDirection: 'rtl' },
  multilineInput: { minHeight: 58 },
  sendButton: { alignItems: 'center', backgroundColor: DALLNI_COLORS.green, borderRadius: 13, justifyContent: 'center', minHeight: 44, paddingHorizontal: 13 },
  sendText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  manualButton: { alignItems: 'center', alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4 },
  manualText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' },
  englishText: { textAlign: 'left', writingDirection: 'ltr' },
  pressed: { opacity: 0.72 },
});
