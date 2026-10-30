import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OfferField } from '@/components/dallni/offer-field';
import {
  ConfirmationPanel,
  DALLNI_COLORS,
  PrimaryButton,
} from '@/components/dallni/flow-ui';
type CustomerRatingValue = {
  stars: number;
  comment: string;
  shopName?: string;
};

type CustomerRatingProps = {
  rating: CustomerRatingValue | null;
  shopName: string;
  onSubmit: (stars: number, comment: string) => void | Promise<void>;
  isSaving?: boolean;
  errorMessage?: string | null;
  persistenceNote?: string;
  submitLabel?: string;
};

export function CustomerRating({
  rating,
  shopName,
  onSubmit,
  isSaving = false,
  errorMessage = null,
  persistenceNote = 'التقييم محلي وبيضل بهالجلسة التجريبية بس.',
  submitLabel = 'إرسال التقييم التجريبي',
}: CustomerRatingProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  if (rating) {
    return (
      <ConfirmationPanel>
        <Text style={styles.savedTitle}>شكراً على تقييمك</Text>
        <Text style={styles.starsDisplay}>
          {'★'.repeat(rating.stars)}{'☆'.repeat(5 - rating.stars)}
        </Text>
        <Text style={styles.savedText}>
          قيّمت {rating.shopName || shopName} بـ {rating.stars} من ٥ نجوم.
        </Text>
        {rating.comment.length > 0 && (
          <Text style={styles.savedText}>{rating.comment}</Text>
        )}
        <Text style={styles.sessionNote}>{persistenceNote}</Text>
      </ConfirmationPanel>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>قيّم تجربتك مع {shopName}</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((value) => {
          const selected = value <= stars;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`${value} من ٥ نجوم`}
              accessibilityState={{ checked: stars === value }}
              onPress={() => setStars(value)}
              style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}>
              <Text style={[styles.star, selected && styles.starSelected]}>
                {selected ? '★' : '☆'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <OfferField
        label="تعليق اختياري"
        placeholder="اكتب ملاحظة قصيرة عن تجربتك"
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={240}
      />
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      <Text style={styles.sessionNote}>{persistenceNote}</Text>
      <PrimaryButton
        disabled={stars === 0 || isSaving}
        label={isSaving ? 'عم نحفظ التقييم…' : submitLabel}
        onPress={() => onSubmit(stars, comment.trim())}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    backgroundColor: '#F7F9F8',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  title: {
    color: DALLNI_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  starRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'flex-start',
  },
  starButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  star: {
    color: '#AAB5AF',
    fontSize: 25,
    lineHeight: 30,
  },
  starSelected: {
    color: DALLNI_COLORS.gold,
  },
  savedTitle: {
    color: DALLNI_COLORS.greenDark,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  starsDisplay: {
    color: DALLNI_COLORS.gold,
    fontSize: 20,
    textAlign: 'right',
  },
  savedText: {
    color: DALLNI_COLORS.ink,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sessionNote: {
    color: DALLNI_COLORS.muted,
    fontSize: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorText: {
    color: '#A3493C',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.82,
  },
});
