import { isSyriaLocation, locationsOverlap } from '@/utils/syria-locations';

export type MatchableRequest = {
  category: string;
  area: string;
};

export type ShopMatchingProfile = {
  productCategories: string[];
  location: string;
  serviceAreas?: string[];
};

export type RequestMatch = {
  matches: boolean;
  categoryMatches: boolean;
  areaMatches: boolean;
  hasShopCategories: boolean;
  hasServiceArea: boolean;
};

function normalizeCategory(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .toLocaleLowerCase('ar')
    .trim()
    .replace(/\s+/gu, ' ');
}

export function matchRequestToShop(
  request: MatchableRequest,
  profile: ShopMatchingProfile,
): RequestMatch {
  const requestCategory = normalizeCategory(request.category);
  const shopCategories = profile.productCategories.map(normalizeCategory).filter(Boolean);
  const shopAreas = [profile.location, ...(profile.serviceAreas ?? [])].filter(isSyriaLocation);
  const categoryMatches = requestCategory.length > 0 && shopCategories.includes(requestCategory);
  const areaMatches = isSyriaLocation(request.area) &&
    shopAreas.some((shopArea) => locationsOverlap(request.area, shopArea));

  return {
    matches: categoryMatches && areaMatches,
    categoryMatches,
    areaMatches,
    hasShopCategories: shopCategories.length > 0,
    hasServiceArea: shopAreas.length > 0,
  };
}
