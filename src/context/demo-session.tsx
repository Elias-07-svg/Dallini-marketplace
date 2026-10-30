import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DemoOffer = {
  id: string;
  shopName: string;
  whatsappNumber: string;
  shopLocation: string;
  itemName: string;
  price: string;
  deliveryNote: string;
};

export type DemoShopProfile = {
  shopName: string;
  whatsappNumber: string;
  location: string;
  productCategories: string[];
};

export type DemoShopRating = {
  id: string;
  shopName: string;
  stars: number;
  comment: string;
  createdAt: number;
};

export type ApprovedCustomerRequest = {
  id: string;
  title: string;
  category: string;
  area: string;
  details: string;
  imageUri: string | null;
  approvedAt: number;
  offers: DemoOffer[];
  selectedOfferId: string | null;
  orderStage: OrderStage | null;
  rating: DemoShopRating | null;
};

export type DemoOfferDraft = Omit<DemoOffer, 'id'>;

export const ORDER_STAGES = [
  { id: 'confirmed', label: 'تم تأكيد الطلب', shortLabel: 'مؤكّد' },
  { id: 'preparing', label: 'قيد التحضير', shortLabel: 'تحضير' },
  { id: 'ready', label: 'جاهز', shortLabel: 'جاهز' },
  { id: 'completed', label: 'مكتمل', shortLabel: 'مكتمل' },
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number]['id'];

type DemoSessionContextValue = {
  approvedRequests: ApprovedCustomerRequest[];
  shopProfile: DemoShopProfile;
  updateShopProfile: (profile: DemoShopProfile) => void;
  addApprovedRequest: (input: {
    category: string;
    area: string;
    details: string;
    imageUri: string | null;
  }) => string;
  confirmOffer: (requestId: string, offer: DemoOfferDraft) => string;
  selectOffer: (requestId: string, offerId: string) => void;
  updateOrderStage: (requestId: string, stage: OrderStage) => void;
  rateCompletedOrder: (requestId: string, stars: number, comment: string) => void;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);
let nextRequestId = 1;
let nextOfferId = 1;
let nextRatingId = 1;

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [approvedRequests, setApprovedRequests] = useState<ApprovedCustomerRequest[]>([]);
  const [shopProfile, setShopProfile] = useState<DemoShopProfile>({
    shopName: '',
    whatsappNumber: '',
    location: '',
    productCategories: [],
  });

  const updateShopProfile = useCallback((profile: DemoShopProfile) => {
    setShopProfile({ ...profile, productCategories: [...profile.productCategories] });
  }, []);

  const addApprovedRequest = useCallback(
    ({ category, area, details, imageUri }: {
      category: string;
      area: string;
      details: string;
      imageUri: string | null;
    }) => {
      const cleanDetails = details.trim();
      const title = cleanDetails
        .split(/\r?\n/)
        .map((line) => line.replace(/^[•\-\s]+/u, '').trim())
        .find(Boolean);
      const request: ApprovedCustomerRequest = {
        id: `customer-${Date.now()}-${nextRequestId++}`,
        title: (title || (imageUri ? 'طلب مع صورة مرفقة' : 'طلب جديد من زبون')).slice(0, 72),
        category,
        area,
        details: cleanDetails,
        imageUri,
        approvedAt: Date.now(),
        offers: [],
        selectedOfferId: null,
        orderStage: null,
        rating: null,
      };

      setApprovedRequests((current) => [request, ...current]);
      return request.id;
    },
    [],
  );

  const confirmOffer = useCallback((requestId: string, offer: DemoOfferDraft) => {
    const savedOffer = { ...offer, id: `offer-${Date.now()}-${nextOfferId++}` };
    setApprovedRequests((current) =>
      current.map((request) =>
        request.id === requestId
          ? { ...request, offers: [...request.offers, savedOffer] }
          : request,
      ),
    );
    return savedOffer.id;
  }, []);

  const selectOffer = useCallback((requestId: string, offerId: string) => {
    setApprovedRequests((current) =>
      current.map((request) =>
        request.id === requestId && request.offers.some((offer) => offer.id === offerId)
          ? {
              ...request,
              selectedOfferId: offerId,
              orderStage:
                request.selectedOfferId === offerId
                  ? request.orderStage ?? 'confirmed'
                  : 'confirmed',
              rating: request.selectedOfferId === offerId ? request.rating : null,
            }
          : request,
      ),
    );
  }, []);

  const updateOrderStage = useCallback((requestId: string, stage: OrderStage) => {
    setApprovedRequests((current) =>
      current.map((request) =>
        request.id === requestId && request.selectedOfferId
          ? { ...request, orderStage: stage }
          : request,
      ),
    );
  }, []);

  const rateCompletedOrder = useCallback(
    (requestId: string, stars: number, comment: string) => {
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) return;
      const cleanComment = comment.trim().slice(0, 240);

      setApprovedRequests((current) =>
        current.map((request) => {
          if (
            request.id !== requestId ||
            request.orderStage !== 'completed' ||
            request.rating
          ) {
            return request;
          }

          const selectedOffer = request.offers.find(
            (offer) => offer.id === request.selectedOfferId,
          );
          if (!selectedOffer) return request;

          return {
            ...request,
            rating: {
              id: `rating-${Date.now()}-${nextRatingId++}`,
              shopName: selectedOffer.shopName,
              stars,
              comment: cleanComment,
              createdAt: Date.now(),
            },
          };
        }),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      approvedRequests,
      shopProfile,
      updateShopProfile,
      addApprovedRequest,
      confirmOffer,
      selectOffer,
      updateOrderStage,
      rateCompletedOrder,
    }),
    [
      approvedRequests,
      shopProfile,
      updateShopProfile,
      addApprovedRequest,
      confirmOffer,
      selectOffer,
      updateOrderStage,
      rateCompletedOrder,
    ],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  const value = useContext(DemoSessionContext);
  if (!value) {
    throw new Error('useDemoSession must be used inside DemoSessionProvider');
  }
  return value;
}
