import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import {
  DALLNI_COLORS,
  FlowHeader,
  PrimaryButton,
  SurfaceCard,
} from '@/components/dallni/flow-ui';
import { supabase } from '@/lib/supabase';
import {
  acknowledgePasswordRecoveryLink,
  isPasswordRecoveryLink,
  subscribeToPasswordRecoveryLinks,
  takePendingPasswordRecoveryLink,
} from '@/lib/pending-password-recovery-link';

type ScreenStatus = 'checking' | 'ready' | 'invalid' | 'complete';
type Feedback = { tone: 'error'; text: string } | null;
type RecoveryDiagnostic = {
  step: string;
  parameterNames: string[];
  supabaseErrorCode: string;
};

const RECOVERY_PARAMETER_NAMES = [
  'access_token',
  'refresh_token',
  'type',
  'token_hash',
  'code',
  'error',
  'error_code',
  'error_description',
] as const;

let lastRecoveryAttempt: {
  url: string;
  result: RecoveryDiagnostic | null;
  promise: Promise<RecoveryDiagnostic | null> | null;
} | null = null;

function safeSupabaseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return 'not_available';
  }

  const code = error.code;
  return typeof code === 'string' && /^[a-zA-Z0-9_.-]{1,64}$/u.test(code)
    ? code
    : 'not_available';
}

function diagnostic(step: string, parameterNames: string[], error?: unknown): RecoveryDiagnostic {
  return {
    step,
    parameterNames,
    supabaseErrorCode: safeSupabaseErrorCode(error),
  };
}

function reportDiagnostic(result: RecoveryDiagnostic) {
  if (!__DEV__) return;
  const parameters = result.parameterNames.length
    ? result.parameterNames.join(',')
    : 'none';
  console.warn(
    `[password-recovery] step=${result.step} parameters=${parameters} supabaseErrorCode=${result.supabaseErrorCode}`,
  );
}

function getRecoveryParameter(
  searchParams: URLSearchParams,
  fragmentParams: URLSearchParams,
  name: string,
) {
  return searchParams.get(name) ?? fragmentParams.get(name);
}

async function establishRecoverySession(url: string): Promise<RecoveryDiagnostic | null> {
  let step = 'parse_url';
  let parameterNames: string[] = [];

  try {
    const parsedUrl = new URL(url);
    const fragmentParams = new URLSearchParams(parsedUrl.hash.replace(/^#/u, ''));
    parameterNames = RECOVERY_PARAMETER_NAMES.filter(
      (name) => parsedUrl.searchParams.has(name) || fragmentParams.has(name),
    );
    const getParameter = (name: string) =>
      getRecoveryParameter(parsedUrl.searchParams, fragmentParams, name);

    if (!supabase) return diagnostic('supabase_client', parameterNames);
    if (getParameter('error') || getParameter('error_code')) {
      return diagnostic('redirect_error', parameterNames);
    }

    const type = getParameter('type');
    if (type && type !== 'recovery') {
      return diagnostic('validate_recovery_type', parameterNames);
    }

    const code = getParameter('code');
    if (code) {
      step = 'exchange_code_for_session';
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return diagnostic(step, parameterNames, error);
      if (!data.session) return diagnostic(step, parameterNames);
      return null;
    }

    const tokenHash = getParameter('token_hash');
    if (tokenHash && type === 'recovery') {
      step = 'verify_recovery_token_hash';
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });
      if (error) return diagnostic(step, parameterNames, error);
      if (!data.session) return diagnostic(step, parameterNames);
      return null;
    }

    const accessToken = getParameter('access_token');
    const refreshToken = getParameter('refresh_token');
    if (type !== 'recovery' || !accessToken || !refreshToken) {
      return diagnostic('validate_recovery_parameters', parameterNames);
    }

    step = 'set_recovery_session';
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return diagnostic(step, parameterNames, error);
    if (!data.session) return diagnostic(step, parameterNames);
    return null;
  } catch (error) {
    return diagnostic(step, parameterNames, error);
  }
}

function establishRecoverySessionOnce(url: string) {
  if (lastRecoveryAttempt?.url === url) {
    return lastRecoveryAttempt.promise ?? Promise.resolve(lastRecoveryAttempt.result);
  }

  const attempt = {
    url,
    result: null as RecoveryDiagnostic | null,
    promise: null as Promise<RecoveryDiagnostic | null> | null,
  };
  attempt.promise = establishRecoverySession(url).then((result) => {
    attempt.result = result;
    attempt.promise = null;
    if (result && lastRecoveryAttempt === attempt) lastRecoveryAttempt = null;
    return result;
  });
  lastRecoveryAttempt = attempt;
  return attempt.promise;
}

export default function ResetPasswordScreen() {
  const handledUrls = useRef(new Set<string>());
  const [status, setStatus] = useState<ScreenStatus>('checking');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [recoveryDiagnostic, setRecoveryDiagnostic] = useState<RecoveryDiagnostic | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function handleUrl(url: string) {
      acknowledgePasswordRecoveryLink(url);
      if (handledUrls.current.has(url)) return;
      handledUrls.current.add(url);
      setStatus('checking');

      const result = await establishRecoverySessionOnce(url);
      if (!isCurrent) return;

      if (result) {
        setRecoveryDiagnostic(result);
        reportDiagnostic(result);
        setStatus('invalid');
        return;
      }

      setRecoveryDiagnostic(null);
      setStatus('ready');
    }

    const unsubscribeFromRecoveryLinks = subscribeToPasswordRecoveryLinks((url) => {
      void handleUrl(url);
    });
    const pendingUrl = takePendingPasswordRecoveryLink();
    if (pendingUrl) void handleUrl(pendingUrl);

    void Linking.getInitialURL()
      .then((url) => {
        if (!isCurrent) return;
        if (url && isPasswordRecoveryLink(url)) {
          void handleUrl(url);
        } else if (handledUrls.current.size === 0) {
          const result = diagnostic('get_initial_url', []);
          setRecoveryDiagnostic(result);
          reportDiagnostic(result);
          setStatus('invalid');
        }
      })
      .catch(() => {
        if (!isCurrent || handledUrls.current.size > 0) return;
        const result = diagnostic('get_initial_url', []);
        setRecoveryDiagnostic(result);
        reportDiagnostic(result);
        setStatus('invalid');
      });

    return () => {
      isCurrent = false;
      unsubscribeFromRecoveryLinks();
    };
  }, []);

  async function saveNewPassword() {
    if (newPassword.length < 6) {
      setFeedback({ tone: 'error', text: 'كلمة المرور لازم تكون ٦ أحرف أو أكتر.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ tone: 'error', text: 'كلمتا المرور مش متطابقتين.' });
      return;
    }
    if (!supabase || isSaving) {
      setFeedback({ tone: 'error', text: 'ما قدرنا نجهّز تغيير كلمة المرور. حاول مرة تانية.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStatus('complete');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setFeedback({
        tone: 'error',
        text: /password.*(weak|short|minimum|at least|characters)/i.test(message)
          ? 'اختار كلمة مرور أطول أو أقوى وحاول مرة تانية.'
          : 'ما قدرنا نغيّر كلمة المرور. إذا انتهت صلاحية الرابط، اطلب رابطاً جديداً.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}>
      <FlowHeader
        title="تعيين كلمة مرور جديدة"
        subtitle="استخدم الرابط الذي وصلك على بريدك لتحديث كلمة المرور."
        onBack={() => router.replace('/auth')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {status === 'checking' ? (
          <SurfaceCard style={styles.stateCard}>
            <ActivityIndicator color={DALLNI_COLORS.green} />
            <Text style={styles.stateText}>عم نتحقق من رابط إعادة التعيين…</Text>
          </SurfaceCard>
        ) : status === 'invalid' ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.stateTitle}>الرابط غير صالح أو انتهت صلاحيته</Text>
            <Text style={styles.stateText}>
              ارجع لتسجيل الدخول واطلب رابط إعادة تعيين جديد.
            </Text>
            {__DEV__ && recoveryDiagnostic ? (
              <Text selectable style={styles.diagnosticText}>
                {`تشخيص مؤقت: step=${recoveryDiagnostic.step} parameters=${recoveryDiagnostic.parameterNames.join(',') || 'none'} supabaseErrorCode=${recoveryDiagnostic.supabaseErrorCode}`}
              </Text>
            ) : null}
            <PrimaryButton
              label="العودة لتسجيل الدخول"
              onPress={() => router.replace('/auth')}
            />
          </SurfaceCard>
        ) : status === 'complete' ? (
          <SurfaceCard style={styles.stateCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.stateTitle}>تم تغيير كلمة المرور بنجاح</Text>
            <Text style={styles.stateText}>
              صار فيك تتابع استخدام دَلّني بكلمة المرور الجديدة.
            </Text>
            <PrimaryButton
              label="العودة إلى دَلّني"
              onPress={() => router.replace('/(tabs)')}
            />
          </SurfaceCard>
        ) : (
          <SurfaceCard style={styles.formCard}>
            <Text style={styles.formTitle}>اختار كلمة مرور جديدة</Text>
            <Text style={styles.formHint}>استخدم ٦ أحرف على الأقل.</Text>
            <Text style={styles.label}>كلمة المرور الجديدة</Text>
            <TextInput
              accessibilityLabel="كلمة المرور الجديدة"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              onChangeText={setNewPassword}
              onSubmitEditing={() => void saveNewPassword()}
              placeholder="٦ أحرف على الأقل"
              placeholderTextColor="#98A59F"
              returnKeyType="next"
              secureTextEntry
              style={styles.input}
              textAlign="left"
              value={newPassword}
            />
            <Text style={styles.label}>تأكيد كلمة المرور</Text>
            <TextInput
              accessibilityLabel="تأكيد كلمة المرور"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              onChangeText={setConfirmPassword}
              onSubmitEditing={() => void saveNewPassword()}
              placeholder="أعد كتابة كلمة المرور"
              placeholderTextColor="#98A59F"
              returnKeyType="done"
              secureTextEntry
              style={styles.input}
              textAlign="left"
              value={confirmPassword}
            />
            {feedback ? <Text style={styles.errorText}>{feedback.text}</Text> : null}
            <PrimaryButton
              disabled={isSaving}
              label={isSaving ? 'عم نحفظ كلمة المرور…' : 'حفظ كلمة المرور الجديدة'}
              onPress={() => void saveNewPassword()}
            />
          </SurfaceCard>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: DALLNI_COLORS.background, flex: 1 },
  content: { flexGrow: 1, gap: 12, paddingHorizontal: 20, paddingBottom: 32 },
  stateCard: { alignItems: 'flex-end', gap: 10, padding: 17 },
  stateTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stateText: {
    color: DALLNI_COLORS.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  successIcon: {
    alignSelf: 'flex-end',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderRadius: 18,
    color: DALLNI_COLORS.greenDark,
    fontSize: 20,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  formCard: { gap: 11, padding: 17 },
  formTitle: {
    color: DALLNI_COLORS.ink,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  formHint: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  label: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
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
  errorText: {
    color: '#A83232',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  diagnosticText: {
    alignSelf: 'stretch',
    backgroundColor: '#F1F4F2',
    borderRadius: 9,
    color: DALLNI_COLORS.muted,
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 15,
    padding: 8,
    textAlign: 'left',
  },
});
