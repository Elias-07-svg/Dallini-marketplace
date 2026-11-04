import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const DALLNI_COLORS = {
  green: '#176B5B',
  greenDark: '#125347',
  greenLight: '#EAF5F0',
  background: '#F6F8F7',
  surface: '#FFFFFF',
  ink: '#152D27',
  muted: '#71817A',
  border: '#E3EBE6',
  gold: '#F0BA50',
} as const;

type FlowHeaderProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
};

export function FlowHeader({ title, subtitle, onBack }: FlowHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.brand}>
          <Text style={styles.brandName}>دَلّني</Text>
          <Text style={styles.brandSub}>DALLNI</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>رجوع</Text>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

type FlowStepsProps = {
  activeStep: 'request' | 'review';
};

export function FlowSteps({ activeStep }: FlowStepsProps) {
  const requestComplete = activeStep === 'review';

  return (
    <View style={styles.steps}>
      <StepBadge
        number="١"
        label="وصف الطلب"
        status={requestComplete ? 'complete' : 'active'}
      />
      <View style={[styles.stepLine, requestComplete && styles.stepLineComplete]} />
      <StepBadge
        number="٢"
        label="مراجعة"
        status={activeStep === 'review' ? 'active' : 'upcoming'}
      />
    </View>
  );
}

function StepBadge({
  number,
  label,
  status,
}: {
  number: string;
  label: string;
  status: 'active' | 'complete' | 'upcoming';
}) {
  return (
    <View style={styles.stepItem}>
      <View
        style={[
          styles.stepCircle,
          status !== 'upcoming' && styles.stepCircleActive,
        ]}>
        <Text style={[styles.stepNumber, status !== 'upcoming' && styles.stepNumberActive]}>
          {status === 'complete' ? '✓' : number}
        </Text>
      </View>
      <Text style={[styles.stepLabel, status === 'upcoming' && styles.stepLabelUpcoming]}>
        {label}
      </Text>
    </View>
  );
}

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, disabled = false }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
      <Text style={styles.primaryButtonArrow}>←</Text>
    </Pressable>
  );
}

export function SurfaceCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.surfaceCard, style]}>{children}</View>;
}

export function ConfirmationPanel({ children }: { children: ReactNode }) {
  return (
    <View style={styles.confirmationPanel}>
      <View style={styles.confirmationIcon}>
        <Text style={styles.confirmationCheck}>✓</Text>
      </View>
      <View style={styles.confirmationCopy}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  brand: {
    alignItems: 'flex-end',
  },
  brandName: {
    color: DALLNI_COLORS.green,
    fontSize: 21,
    fontWeight: '900',
    writingDirection: 'rtl',
  },
  brandSub: {
    color: '#8A9992',
    fontSize: 9,
    letterSpacing: 2.2,
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: DALLNI_COLORS.border,
  },
  backText: {
    color: DALLNI_COLORS.green,
    fontSize: 13,
    fontWeight: '700',
  },
  backArrow: {
    color: DALLNI_COLORS.green,
    fontSize: 18,
    lineHeight: 20,
  },
  title: {
    color: DALLNI_COLORS.ink,
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subtitle: {
    color: DALLNI_COLORS.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  steps: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.surface,
    borderColor: DALLNI_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stepItem: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
  },
  stepCircle: {
    alignItems: 'center',
    backgroundColor: '#F1F4F2',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  stepCircleActive: {
    backgroundColor: DALLNI_COLORS.green,
  },
  stepNumber: {
    color: DALLNI_COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 11,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  stepLabelUpcoming: {
    color: '#9BA8A1',
  },
  stepLine: {
    backgroundColor: '#E6ECE8',
    flex: 1,
    height: 2,
    marginHorizontal: 11,
  },
  stepLineComplete: {
    backgroundColor: '#8AB7A7',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.green,
    borderRadius: 15,
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: {
    backgroundColor: '#A5B7AF',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  primaryButtonArrow: {
    color: '#D8EEE5',
    fontSize: 20,
    lineHeight: 22,
  },
  surfaceCard: {
    backgroundColor: DALLNI_COLORS.surface,
    borderColor: DALLNI_COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 17,
  },
  confirmationPanel: {
    alignItems: 'flex-start',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: '#D5EAE0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 12,
    padding: 15,
  },
  confirmationIcon: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.green,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  confirmationCheck: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  confirmationCopy: {
    flex: 1,
    gap: 4,
  },
  pressed: {
    opacity: 0.82,
  },
});
