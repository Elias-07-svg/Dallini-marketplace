import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ORDER_STAGES, type OrderStage } from '@/context/demo-session';

const arabicNumbers = ['١', '٢', '٣', '٤'];

export function OrderProgress({ stage }: { stage: OrderStage }) {
  const currentIndex = ORDER_STAGES.findIndex((item) => item.id === stage);
  const currentStage = ORDER_STAGES[currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>متابعة الطلب</Text>
        <Text style={styles.currentStage}>الحالة: {currentStage.label}</Text>
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
    backgroundColor: '#F7F9F8',
    borderColor: '#E3EBE6',
    borderRadius: 14,
    borderWidth: 1,
    gap: 11,
    padding: 12,
  },
  heading: {
    alignItems: 'flex-end',
    gap: 3,
  },
  title: {
    color: '#152D27',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentStage: {
    color: '#176B5B',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  track: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    width: '100%',
  },
  step: {
    alignItems: 'center',
    width: 51,
  },
  dot: {
    alignItems: 'center',
    backgroundColor: '#E7ECE9',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  completedDot: {
    backgroundColor: '#8AB7A7',
  },
  currentDot: {
    backgroundColor: '#176B5B',
  },
  dotText: {
    color: '#71817A',
    fontSize: 10,
    fontWeight: '800',
  },
  activeDotText: {
    color: '#FFFFFF',
  },
  stepLabel: {
    color: '#8A9992',
    fontSize: 9,
    marginTop: 5,
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
    marginTop: 11,
  },
  completedLine: {
    backgroundColor: '#8AB7A7',
  },
});
