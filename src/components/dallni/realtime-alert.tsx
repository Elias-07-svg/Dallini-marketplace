import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DALLNI_COLORS } from '@/components/dallni/flow-ui';

type RealtimeAlertProps = {
  announcementKey: string;
  message: string;
  onDismiss: () => void;
};

export function RealtimeAlert({ announcementKey, message, onDismiss }: RealtimeAlertProps) {
  const lastAnnouncedKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastAnnouncedKey.current === announcementKey) return;
    lastAnnouncedKey.current = announcementKey;
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [announcementKey, message]);

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.title}>تحديث مباشر</Text>
        <Text
          accessibilityLanguage="ar-LB"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.message}>
          {message}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="إخفاء التنبيه"
        hitSlop={8}
        onPress={onDismiss}
        style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
        <Text style={styles.dismissText}>إخفاء</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: DALLNI_COLORS.greenLight,
    borderColor: '#D5EAE0',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  copy: { flex: 1, gap: 3 },
  title: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  message: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  dismiss: {
    borderColor: '#C7DFD4',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  dismissText: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 10,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  pressed: { opacity: 0.7 },
});
