import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { DALLNI_COLORS } from '@/components/dallni/flow-ui';
import { useSupabaseAuth } from '@/context/supabase-auth';
import { useCustomerFavorites } from '@/context/customer-favorites';

export function FavoriteButton({
  itemId,
  itemType,
  size = 'small',
  style,
}: {
  itemId: string;
  itemType: 'product' | 'shop';
  size?: 'small' | 'large';
  style?: StyleProp<ViewStyle>;
}) {
  const { user, isLoading: isAuthLoading } = useSupabaseAuth();
  const {
    productIds,
    shopIds,
    isLoading: areFavoritesLoading,
    setProductFavorite,
    setShopFavorite,
  } = useCustomerFavorites();
  const [isSaving, setIsSaving] = useState(false);
  const isFavorite = itemType === 'product'
    ? productIds.has(itemId)
    : shopIds.has(itemId);
  const itemLabel = itemType === 'product' ? 'المنتج' : 'المحل';
  const disabled = isAuthLoading || isSaving || (Boolean(user) && areFavoritesLoading);

  async function toggleFavorite() {
    if (isAuthLoading || isSaving || areFavoritesLoading) return;
    if (!user) {
      router.push('/auth' as Href);
      return;
    }

    setIsSaving(true);
    try {
      if (itemType === 'product') await setProductFavorite(itemId, !isFavorite);
      else await setShopFavorite(itemId, !isFavorite);
    } catch {
      Alert.alert('ما قدرنا نحفظ المفضلة', 'تأكّد من الاتصال وحاول مرة تانية.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={!user
        ? `سجّل دخولك لحفظ ${itemLabel} بالمفضلة`
        : isFavorite
          ? `إزالة ${itemLabel} من المفضلة`
          : `إضافة ${itemLabel} للمفضلة`}
      accessibilityState={{ checked: isFavorite, disabled }}
      disabled={disabled}
      onPress={() => void toggleFavorite()}
      style={({ pressed }) => [
        styles.button,
        size === 'large' && styles.largeButton,
        isFavorite && styles.selected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text style={[styles.heart, size === 'large' && styles.largeHeart, isFavorite && styles.selectedHeart]}>
        {isFavorite ? '♥' : '♡'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: DALLNI_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  largeButton: { borderRadius: 14, height: 46, width: 46 },
  selected: { backgroundColor: DALLNI_COLORS.greenLight, borderColor: '#A9CFC0' },
  heart: { color: DALLNI_COLORS.muted, fontSize: 22, lineHeight: 25 },
  largeHeart: { fontSize: 27, lineHeight: 30 },
  selectedHeart: { color: DALLNI_COLORS.green },
  disabled: { opacity: 0.56 },
  pressed: { transform: [{ scale: 0.94 }] },
});
