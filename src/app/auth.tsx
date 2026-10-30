import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FlowHeader, SurfaceCard, DALLNI_COLORS } from '@/components/dallni/flow-ui';
import { useSupabaseAuth } from '@/context/supabase-auth';
import type { SupabaseConfigurationIssue } from '@/lib/supabase';

type AuthMode = 'sign-in' | 'sign-up';
type Feedback = { tone: 'error' | 'success'; text: string } | null;

function configurationMessage(issue: SupabaseConfigurationIssue | null) {
  switch (issue) {
    case 'missing-url':
      return 'أضف عنوان المشروع في EXPO_PUBLIC_SUPABASE_URL داخل ملف .env.local.';
    case 'missing-key':
      return 'أضف المفتاح القابل للنشر في EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY داخل ملف .env.local.';
    case 'invalid-url':
      return 'عنوان Supabase لازم يكون رابطاً صالحاً يبدأ بـ http:// أو https://.';
    case 'invalid-key':
      return 'استخدم مفتاحاً قابلاً للنشر يبدأ بـ sb_publishable_. لا تضع Secret أو service_role key بتطبيق الموبايل.';
    case 'unsupported-host':
      return 'استخدم رابط Supabase مستضافاً يبدأ بـ https وينتهي بـ .supabase.co، أو عنواناً محلياً ضمن شبكتك للتطوير.';
    default:
      return 'إعداد اتصال Supabase غير مكتمل.';
  }
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (/SUPABASE_NOT_CONFIGURED/.test(message)) {
    return 'إعداد اتصال Supabase غير مكتمل بعد.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'البريد الإلكتروني أو كلمة المرور مش مظبوطين.';
  }
  if (/user already registered|already been registered/i.test(message)) {
    return 'هيدا البريد مسجّل من قبل. جرّب تسجّل دخول.';
  }
  if (/password.*(6|six)|at least 6 characters/i.test(message)) {
    return 'كلمة المرور لازم تكون ٦ أحرف أو أكتر.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'أكد بريدك الإلكتروني من رسالة التأكيد، وبعدها جرّب تسجّل دخول.';
  }
  if (/network request failed|failed to fetch|networkerror|econnrefused|timeout/i.test(message)) {
    return 'ما قدرنا نوصل بمشروع Supabase. تحقق من الإنترنت وعنوان المشروع وحاول من جديد.';
  }
  return 'ما زبطت العملية هلّق. تحقق من إعداد Supabase وحاول من جديد.';
}

export default function AuthScreen() {
  const {
    user,
    isLoading,
    isConfigured,
    configurationIssue,
    usesLoopbackAddress,
    signIn,
    signUp,
    signOut,
  } = useSupabaseAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit() {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFeedback({ tone: 'error', text: 'اكتب بريد إلكتروني صالح.' });
      return;
    }
    if (!password) {
      setFeedback({ tone: 'error', text: 'اكتب كلمة المرور.' });
      return;
    }
    if (mode === 'sign-up' && password.length < 6) {
      setFeedback({ tone: 'error', text: 'كلمة المرور لازم تكون ٦ أحرف أو أكتر.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      if (mode === 'sign-in') {
        await signIn(cleanEmail, password);
        setFeedback({
          tone: 'success',
          text: 'تم تسجيل الدخول. افتح «أنا صاحب محل» لتستخدم ملف المحل وصندوق الطلبات المتصل.',
        });
      } else {
        const hasSession = await signUp(cleanEmail, password);
        setFeedback({
          tone: 'success',
          text: hasSession
            ? 'تم إنشاء الحساب وتسجيل الدخول. جهّز ملف المحل؛ لازم موافقة مشغّل المشروع قبل إرسال العروض.'
            : 'تم إنشاء الحساب. راجع بريدك لتأكيده، وبعدها سجّل دخول.',
        });
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: friendlyError(error) });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await signOut();
      setFeedback({ tone: 'success', text: 'تم تسجيل الخروج.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: friendlyError(error) });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FlowHeader
          title="حساب دَلّني"
          subtitle="سجّل دخول أو أنشئ حساب بالبريد وكلمة المرور."
          onBack={() => router.back()}
        />

        <SurfaceCard style={styles.card}>
          <Text style={styles.cardTitle}>حساب دَلّني</Text>
          <Text style={styles.cardDescription}>
            سجّل دخولك لحساب Supabase لحفظ الطلبات والعروض وتحديث حالة الطلب بين الزبون والمحل. بعد اختيار العرض، التواصل بين الزبون والمحل بيكون عبر واتساب، مش برسائل داخل التطبيق.
          </Text>

          {usesLoopbackAddress && (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>ملاحظة للتجربة على التلفون</Text>
              <Text style={styles.noticeText}>
                localhost و127.0.0.1 بيشيروا للتلفون نفسه. حط عنوان IP الكمبيوتر على نفس شبكة Wi-Fi، مثل http://192.168.1.10:54321.
              </Text>
            </View>
          )}

          {!isConfigured ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>الاتصال غير مجهّز</Text>
              <Text style={styles.noticeText}>{configurationMessage(configurationIssue)}</Text>
              <Text style={styles.noticeHint}>
                ملف .env.example فيه أسماء المتغيرات المطلوبة. انسخه إلى .env.local وعبّي القيم من مشروعك المحلي.
              </Text>
            </View>
          ) : user ? (
            <View style={styles.signedIn}>
              <Text style={styles.signedInLabel}>أنت مسجّل دخول بهالحساب</Text>
              <Text style={styles.emailValue} selectable>{user.email}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleSignOut}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                {isSubmitting ? (
                  <ActivityIndicator color={DALLNI_COLORS.green} />
                ) : (
                  <Text style={styles.secondaryButtonText}>تسجيل خروج</Text>
                )}
              </Pressable>
            </View>
          ) : isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={DALLNI_COLORS.green} />
              <Text style={styles.loadingText}>عم نتحقق من الجلسة…</Text>
            </View>
          ) : (
            <>
              <View style={styles.modeSwitch}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { setMode('sign-in'); setFeedback(null); }}
                  style={[styles.modeButton, mode === 'sign-in' && styles.modeButtonActive]}>
                  <Text style={[styles.modeText, mode === 'sign-in' && styles.modeTextActive]}>
                    تسجيل دخول
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { setMode('sign-up'); setFeedback(null); }}
                  style={[styles.modeButton, mode === 'sign-up' && styles.modeButtonActive]}>
                  <Text style={[styles.modeText, mode === 'sign-up' && styles.modeTextActive]}>
                    حساب جديد
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.label}>البريد الإلكتروني</Text>
              <TextInput
                accessibilityLabel="البريد الإلكتروني"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor="#98A59F"
                returnKeyType="next"
                style={styles.input}
                textAlign="left"
                value={email}
              />

              <Text style={styles.label}>كلمة المرور</Text>
              <TextInput
                accessibilityLabel="كلمة المرور"
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="٦ أحرف على الأقل"
                placeholderTextColor="#98A59F"
                returnKeyType="done"
                secureTextEntry
                style={styles.input}
                textAlign="right"
                value={password}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitting }}
                disabled={isSubmitting}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  isSubmitting && styles.disabledButton,
                  pressed && !isSubmitting && styles.pressed,
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === 'sign-in' ? 'دخول' : 'إنشاء حساب'}
                  </Text>
                )}
              </Pressable>
            </>
          )}

          {feedback && (
            <Text style={[styles.feedback, feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
              {feedback.text}
            </Text>
          )}
        </SurfaceCard>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}>
          <Text style={styles.demoButtonText}>كمّل بالتجربة المحلية</Text>
          <Text style={styles.demoButtonNote}>ما بدها تسجيل دخول، وبياناتها بتضل بهالجلسة.</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DALLNI_COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 34,
  },
  card: {
    marginTop: 8,
  },
  cardTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cardDescription: {
    color: DALLNI_COLORS.muted,
    fontSize: 13,
    lineHeight: 22,
    marginTop: 7,
    marginBottom: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  notice: {
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: '#D4E9DF',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  noticeTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  noticeText: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  noticeHint: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modeSwitch: {
    backgroundColor: '#F0F4F1',
    borderRadius: 13,
    flexDirection: 'row-reverse',
    marginBottom: 18,
    padding: 4,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 11,
  },
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 1,
  },
  modeText: {
    color: DALLNI_COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  modeTextActive: {
    color: DALLNI_COLORS.green,
  },
  label: {
    color: DALLNI_COLORS.ink,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    marginTop: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 13,
    borderWidth: 1,
    color: DALLNI_COLORS.ink,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
    writingDirection: 'ltr',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.green,
    borderRadius: 13,
    justifyContent: 'center',
    marginTop: 21,
    minHeight: 50,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.65,
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 12,
    marginTop: 16,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 13,
    fontWeight: '800',
  },
  signedIn: {
    alignItems: 'flex-end',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 15,
  },
  signedInLabel: {
    color: DALLNI_COLORS.muted,
    fontSize: 12,
    textAlign: 'right',
  },
  emailValue: {
    color: DALLNI_COLORS.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'right',
  },
  loading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: DALLNI_COLORS.muted,
    fontSize: 12,
  },
  feedback: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  feedbackError: {
    color: '#A83232',
  },
  feedbackSuccess: {
    color: DALLNI_COLORS.greenDark,
  },
  demoButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  demoButtonText: {
    color: DALLNI_COLORS.green,
    fontSize: 14,
    fontWeight: '800',
  },
  demoButtonNote: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
