import { StyleSheet, Text, View } from 'react-native';

type SampleRequestImageProps = {
  emoji: string;
  backgroundColor: string;
  variant?: 'thumbnail' | 'large';
};

export function SampleRequestImage({
  emoji,
  backgroundColor,
  variant = 'large',
}: SampleRequestImageProps) {
  const isThumbnail = variant === 'thumbnail';

  return (
    <View
      accessible
      accessibilityLabel={'صورة تجريبية مرفقة: ' + emoji}
      style={[
        styles.frame,
        isThumbnail ? styles.thumbnail : styles.large,
        { backgroundColor },
      ]}>
      <View style={[styles.glow, isThumbnail && styles.glowThumbnail]} />
      <View style={[styles.sparkle, styles.sparkleTop]}>
        <Text style={styles.sparkleText}>✦</Text>
      </View>
      <Text style={[styles.productEmoji, isThumbnail && styles.productEmojiThumbnail]}>
        {emoji}
      </Text>
      {!isThumbnail && (
        <View style={styles.caption}>
          <Text style={styles.captionText}>صورة مرجعية تجريبية</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    height: 88,
    width: 82,
  },
  large: {
    height: 205,
    width: '100%',
  },
  glow: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 90,
    height: 180,
    left: -48,
    position: 'absolute',
    top: -60,
    width: 180,
  },
  glowThumbnail: {
    height: 85,
    left: -28,
    top: -30,
    width: 85,
  },
  sparkle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 30,
  },
  sparkleTop: {
    transform: [{ rotate: '12deg' }],
  },
  sparkleText: {
    color: '#176B5B',
    fontSize: 15,
  },
  productEmoji: {
    fontSize: 74,
    textAlign: 'center',
  },
  productEmojiThumbnail: {
    fontSize: 36,
  },
  caption: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 12,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
  },
  captionText: {
    color: '#40564C',
    fontSize: 10,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
});
