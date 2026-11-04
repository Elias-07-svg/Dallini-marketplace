import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ORDER_STAGES, type OrderStage } from '@/context/demo-session';

const arabicNumbers = ['١', '٢', '٣', '٤'];

export function OrderProgress({ stage }: { stage: OrderStage }) {
  const currentIndex = Math.max(0, ORDER_STAGES.findIndex((item) => item.id === stage));
  const currentStage = ORDER_STAGES[currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>متابعة الطلب</Text>
        <View style={styles.stageSummary}>
          <Text style={styles.currentStage}>{currentStage.label}</Text>
          <Text style={styles.stageCount}>{`${arabicNumbers[currentIndex]} / ٤`}</Text>
        </View>
      </View>

      <View style={styles.track}>
        {ORDER_STAGES.map((item, index) => (
          <Fragment key={item.id}>
            <View style={styles.step}>
              <View
                style={[
                  styles.dot,
                  index < currentIndex && styles.completedDot,
                  index === currentIndex && styles.currentDot,
                ]}>
                <Text
                  style={[
                    styles.dotText,
                    index <= currentIndex && styles.activeDotText,
                  ]}>
                  {index < currentIndex ? '✓' : arabicNumbers[index]}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  index <= currentIndex && styles.activeStepLabel,
                ]}>
                {item.shortLabel}
              </Text>
            </View>
            {index < ORDER_STAGES.length - 1 && (
              <View
                style={[
                  styles.line,
                  index < currentIndex && styles.completedLine,
                ]}
              />
            )}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAF9',
    borderColor: '#E1EAE5',
    borderRadius: 16,
    borderWidth: 1,
    gap: 11,
    padding: 13,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    color: '#152D27',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stageSummary: {
    alignItems: 'center',
    backgroundColor: '#EAF5F0',
    borderRadius: 10,
    flexDirection: 'row-reverse',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  currentStage: {
    color: '#125347',
    fontSize: 10,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  stageCount: { color: '#71817A', fontSize: 9, fontWeight: '800' },
  track: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    width: '100%',
  },
  step: {
    alignItems: 'center',
    width: 54,
  },
  dot: {
    alignItems: 'center',
    backgroundColor: '#E7ECE9',
    borderRadius: 15,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  completedDot: {
    backgroundColor: '#8AB7A7',
  },
  currentDot: {
    backgroundColor: '#176B5B',
  },
  dotText: {
    color: '#71817A',
    fontSize: 11,
    fontWeight: '800',
  },
  activeDotText: {
    color: '#FFFFFF',
  },
  stepLabel: {
    color: '#8A9992',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  activeStepLabel: {
    color: '#125347',
    fontWeight: '800',
  },
  line: {
    backgroundColor: '#E2E9E5',
    flex: 1,
    height: 2,
    marginTop: 13,
  },
  completedLine: {
    backgroundColor: '#8AB7A7',
  },
});
