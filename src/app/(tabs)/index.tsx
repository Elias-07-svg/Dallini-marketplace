
import React from 'react';
import { router, type Href } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  StatusBar,
} from 'react-native';

import { useDemoSession } from '@/context/demo-session';
import { useSupabaseAuth } from '@/context/supabase-auth';

const categories = [
  { icon: '📱', name: 'إلكترونيات', prompt: 'بدّي موبايل أو جهاز إلكتروني جديد' },
  { icon: '🛋️', name: 'أثاث', prompt: 'عم فتّش على قطعة أثاث' },
  { icon: '👟', name: 'أزياء', prompt: 'بدّي أشتري قطعة أزياء' },
  { icon: '🧰', name: 'منزل ومطبخ', prompt: 'عم فتّش على غرض للمنزل أو المطبخ' },
];

export default function HomeScreen() {
  const { approvedRequests } = useDemoSession();
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const canOpenCustomerRequests = approvedRequests.length > 0 || (!isAuthLoading && Boolean(user));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>دَلّني</Text>
          <Text style={styles.brandSub}>DALLNI</Text>
        </View>

        <Text style={styles.greeting}>أهلاً وسهلاً 👋</Text>
        <Text style={styles.heading}>شو محتاج اليوم؟</Text>
        <Text style={styles.subtitle}>
          احكيلنا شو بدك، ومنساعدك تلاقي العرض المناسب.
        </Text>

        <View style={styles.hero}>
          <Text style={styles.heroTag}>✦ طلبك يوصل للمحلات المناسبة</Text>
          <Text style={styles.heroTitle}>
            اطلبها بطريقتك،{"\n"}وخلي الباقي علينا.
          </Text>
          <Text style={styles.heroDescription}>
            اكتب طلبك أو ابعت صورة، ومنرتّب التفاصيل
            قبل ما نوصّلها للمحلات المناسبة.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ابدأ طلب جديد"
            style={styles.primaryButton}
            onPress={() => router.push('/request')}
          >
            <Text style={styles.primaryText}>ابدأ طلب جديد ←</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isAuthLoading }}
          disabled={isAuthLoading}
          onPress={() => router.push('/auth' as Href)}
          style={({ pressed }) => [
            styles.ownerEntry,
            styles.authEntry,
            pressed && !isAuthLoading && styles.ownerEntryPressed,
          ]}>
          <View style={styles.ownerEntryCopy}>
            <Text style={styles.ownerEntryTitle}>حساب دَلّني</Text>
            <Text style={styles.ownerEntrySubtitle}>
              {isAuthLoading
                ? 'عم نتحقق من الحساب…'
                : user
                  ? `مسجّل دخول: ${user.email ?? 'حساب دَلّني'}`
                  : 'سجّل دخول أو أنشئ حساب بالبريد وكلمة المرور.'}
            </Text>
          </View>
          <View style={styles.ownerEntryAction}>
            <Text style={styles.ownerEntryActionText}>
              {isAuthLoading ? 'انتظر' : user ? 'حسابي' : 'دخول'}
            </Text>
            <Text style={styles.ownerEntryArrow}>←</Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isAuthLoading }}
          disabled={isAuthLoading}
          onPress={() => router.push((user ? '/owner/online' : '/owner') as Href)}
          style={({ pressed }) => [
            styles.ownerEntry,
            pressed && !isAuthLoading && styles.ownerEntryPressed,
          ]}>
          <View style={styles.ownerEntryCopy}>
            <Text style={styles.ownerEntryTitle}>أنا صاحب محل</Text>
            <Text style={styles.ownerEntrySubtitle}>
              {isAuthLoading
                ? 'عم نتحقق من الحساب…'
                : user
                  ? 'افتح صندوق المحل المتصل وقدّم عروض للطلبات المسموحة.'
                  : 'جرّب صندوق المحل أو سجّل دخول لاستخدام الطلبات المحفوظة.'}
            </Text>
          </View>
          <View style={styles.ownerEntryAction}>
            <Text style={styles.ownerEntryActionText}>
              {isAuthLoading ? 'انتظر' : user ? 'افتح الصندوق' : 'افتح الطلبات'}
            </Text>
            <Text style={styles.ownerEntryArrow}>←</Text>
          </View>
        </Pressable>

        {canOpenCustomerRequests && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/customer/requests')}
            style={({ pressed }) => [
              styles.ownerEntry,
              styles.customerRequestsEntry,
              pressed && styles.ownerEntryPressed,
            ]}>
            <View style={styles.ownerEntryCopy}>
              <Text style={styles.ownerEntryTitle}>طلباتي والعروض</Text>
              <Text style={styles.ownerEntrySubtitle}>
                {user
                  ? 'افتح طلبات حسابك والعروض اللي وصلتها.'
                  : `${approvedRequests.length} طلب محفوظ بهالجلسة. شوف آخر العروض.`}
              </Text>
            </View>
            <View style={styles.ownerEntryAction}>
              <Text style={styles.ownerEntryActionText}>افتح طلباتي</Text>
              <Text style={styles.ownerEntryArrow}>←</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionHint}>اختار فئة وبلّش طلبك</Text>
          <Text style={styles.sectionTitle}>شو عم تفتّش؟</Text>
        </View>

        <View style={styles.categories}>
          {categories.map((category) => (
            <Pressable
              key={category.name}
              accessibilityRole="button"
              accessibilityLabel={`ابدأ طلب ضمن فئة ${category.name}`}
              style={({ pressed }) => [styles.category, pressed && styles.categoryPressed]}
              onPress={() =>
                router.push({
                  pathname: '/request',
                  params: { prompt: category.prompt, category: category.name },
                })
              }
            >
              <View style={styles.categoryIconWrap}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
              </View>
              <View style={styles.categoryCopy}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryAction}>ابدأ الطلب ←</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>كيف بيشتغل دَلّني؟</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            ① احكيلنا شو محتاج
            {'\n'}
            ② راجع طلبك ووافق عليه
            {'\n'}
            ③ استقبل عروض من المحلات
            {'\n'}
            ④ اختار العرض اللي بناسبك
          </Text>
        </View>

        <Text style={styles.footer}>DALLNI • النسخة الأولية</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F7',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
    alignItems: 'flex-end',
  },
  brand: {
    color: '#176B5B',
    fontSize: 30,
    fontWeight: '900',
  },
  brandSub: {
    color: '#8A9992',
    fontSize: 10,
    letterSpacing: 3,
  },
  greeting: {
    fontSize: 16,
    color: '#60746C',
    textAlign: 'right',
  },
  heading: {
    fontSize: 29,
    fontWeight: 'bold',
    color: '#152D27',
    textAlign: 'right',
    marginTop: 5,
  },
  subtitle: {
    color: '#7D8C85',
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 23,
    marginTop: 8,
    marginBottom: 24,
  },
  hero: {
    backgroundColor: '#176B5B',
    borderRadius: 24,
    padding: 23,
    alignItems: 'flex-end',
    shadowColor: '#0D4C40',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  heroTag: {
    color: '#BDE4D5',
    fontSize: 12,
    marginBottom: 13,
    writingDirection: 'rtl',
  },
  heroTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
    lineHeight: 37,
    writingDirection: 'rtl',
  },
  heroDescription: {
    color: '#DBF0E9',
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 23,
    marginTop: 12,
    marginBottom: 20,
    writingDirection: 'rtl',
  },
  primaryButton: {
    backgroundColor: '#F0BA50',
    paddingVertical: 13,
    paddingHorizontal: 23,
    borderRadius: 13,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#26352E',
    fontSize: 13,
    fontWeight: 'bold',
  },
  ownerEntry: {
    alignItems: 'center',
    backgroundColor: '#EAF5F0',
    borderColor: '#D9EAE1',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 78,
  },
  customerRequestsEntry: {
    backgroundColor: '#F0F6F2',
    marginTop: 10,
  },
  authEntry: {
    backgroundColor: '#FFFFFF',
  },
  ownerEntryCopy: {
    alignItems: 'flex-end',
    flex: 1,
    paddingLeft: 10,
  },
  ownerEntryTitle: {
    color: '#152D27',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ownerEntrySubtitle: {
    color: '#60746C',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ownerEntryAction: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9EAE1',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  ownerEntryActionText: {
    color: '#176B5B',
    fontSize: 11,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  ownerEntryArrow: {
    color: '#176B5B',
    fontSize: 16,
    lineHeight: 18,
  },
  ownerEntryPressed: {
    opacity: 0.82,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#152D27',
    textAlign: 'right',
    marginBottom: 3,
    writingDirection: 'rtl',
  },
  sectionHeading: {
    alignItems: 'flex-end',
    marginTop: 28,
    marginBottom: 15,
  },
  sectionHint: {
    color: '#8A9992',
    fontSize: 11,
    marginBottom: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  categories: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  category: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7EDE9',
    minHeight: 76,
  },
  categoryPressed: {
    backgroundColor: '#F0F7F3',
    borderColor: '#BBD8CB',
    transform: [{ scale: 0.98 }],
  },
  categoryIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EAF5F0',
  },
  categoryIcon: {
    fontSize: 23,
  },
  categoryCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 8,
    gap: 4,
  },
  categoryName: {
    fontSize: 12,
    color: '#25372E',
    fontWeight: 'bold',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  categoryAction: {
    color: '#829188',
    fontSize: 9,
    writingDirection: 'rtl',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E7EDE9',
  },
  infoText: {
    fontSize: 14,
    color: '#40564C',
    lineHeight: 35,
    textAlign: 'right',
  },
  footer: {
    textAlign: 'center',
    color: '#9AA8A0',
    fontSize: 11,
    marginTop: 28,
  },
});
