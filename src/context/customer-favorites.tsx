import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useSupabaseAuth } from '@/context/supabase-auth';
import {
  addCustomerProductFavorite,
  addCustomerShopFavorite,
  loadCustomerFavorites,
  removeCustomerProductFavorite,
  removeCustomerShopFavorite,
  type CustomerFavorites,
} from '@/lib/customer-favorites-supabase';

type FavoriteSnapshot = CustomerFavorites & { customerId: string };

type CustomerFavoritesContextValue = {
  productIds: ReadonlySet<string>;
  shopIds: ReadonlySet<string>;
  isLoading: boolean;
  hasError: boolean;
  refreshFavorites: () => Promise<CustomerFavorites>;
  setProductFavorite: (productId: string, shouldSave: boolean) => Promise<void>;
  setShopFavorite: (shopId: string, shouldSave: boolean) => Promise<void>;
};

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();
const CustomerFavoritesContext = createContext<CustomerFavoritesContextValue | null>(null);

export function CustomerFavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabaseAuth();
  const [snapshot, setSnapshot] = useState<FavoriteSnapshot | null>(null);
  const [errorCustomerId, setErrorCustomerId] = useState<string | null>(null);
  const [refreshingCustomerId, setRefreshingCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let isCurrent = true;
    void loadCustomerFavorites(user.id).then((favorites) => {
      if (!isCurrent) return;
      setSnapshot({ ...favorites, customerId: user.id });
      setErrorCustomerId(null);
    }).catch(() => {
      if (isCurrent) setErrorCustomerId(user.id);
    });

    return () => { isCurrent = false; };
  }, [user]);

  const refreshFavorites = useCallback(async () => {
    if (!user) return { productIds: [], shopIds: [] };

    setRefreshingCustomerId(user.id);
    try {
      const favorites = await loadCustomerFavorites(user.id);
      setSnapshot({ ...favorites, customerId: user.id });
      setErrorCustomerId(null);
      return favorites;
    } catch (error) {
      setErrorCustomerId(user.id);
      throw error;
    } finally {
      setRefreshingCustomerId((current) => current === user.id ? null : current);
    }
  }, [user]);

  const setProductFavorite = useCallback(async (productId: string, shouldSave: boolean) => {
    if (!user) throw new Error('FAVORITES_REQUIRE_SIGN_IN');

    if (shouldSave) await addCustomerProductFavorite(user.id, productId);
    else await removeCustomerProductFavorite(user.id, productId);

    setSnapshot((current) => {
      const productIds = new Set(current?.customerId === user.id ? current.productIds : []);
      const shopIds = new Set(current?.customerId === user.id ? current.shopIds : []);
      if (shouldSave) productIds.add(productId);
      else productIds.delete(productId);
      return { customerId: user.id, productIds: [...productIds], shopIds: [...shopIds] };
    });
  }, [user]);

  const setShopFavorite = useCallback(async (shopId: string, shouldSave: boolean) => {
    if (!user) throw new Error('FAVORITES_REQUIRE_SIGN_IN');

    if (shouldSave) await addCustomerShopFavorite(user.id, shopId);
    else await removeCustomerShopFavorite(user.id, shopId);

    setSnapshot((current) => {
      const productIds = new Set(current?.customerId === user.id ? current.productIds : []);
      const shopIds = new Set(current?.customerId === user.id ? current.shopIds : []);
      if (shouldSave) shopIds.add(shopId);
      else shopIds.delete(shopId);
      return { customerId: user.id, productIds: [...productIds], shopIds: [...shopIds] };
    });
  }, [user]);

  const matchingSnapshot = user && snapshot?.customerId === user.id ? snapshot : null;
  const value = useMemo<CustomerFavoritesContextValue>(() => ({
    productIds: new Set(matchingSnapshot?.productIds ?? EMPTY_IDS),
    shopIds: new Set(matchingSnapshot?.shopIds ?? EMPTY_IDS),
    isLoading: Boolean(user && (
      refreshingCustomerId === user.id
      || (!matchingSnapshot && errorCustomerId !== user.id)
    )),
    hasError: Boolean(user && errorCustomerId === user.id),
    refreshFavorites,
    setProductFavorite,
    setShopFavorite,
  }), [
    errorCustomerId,
    matchingSnapshot,
    refreshFavorites,
    refreshingCustomerId,
    setProductFavorite,
    setShopFavorite,
    user,
  ]);

  return <CustomerFavoritesContext.Provider value={value}>{children}</CustomerFavoritesContext.Provider>;
}

export function useCustomerFavorites() {
  const context = useContext(CustomerFavoritesContext);
  if (!context) throw new Error('useCustomerFavorites must be inside CustomerFavoritesProvider');
  return context;
}
