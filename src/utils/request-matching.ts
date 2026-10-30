export type MatchableRequest = {
  category: string;
  area: string;
};

export type ShopMatchingProfile = {
  productCategories: string[];
  location: string;
};

export type RequestMatch = {
  matches: boolean;
  categoryMatches: boolean;
  areaMatches: boolean;
  hasShopCategories: boolean;
  hasServiceArea: boolean;
};

export function normalizeMatchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLocaleLowerCase('ar')
    .replace(/[^\w\u0600-\u06FF]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function splitAreas(value: string) {
  return value
    .split(/[,،;؛|\/\n-]+/)
    .map(normalizeMatchText)
    .filter(Boolean);
}

function containsWholePhrase(value: string, phrase: string) {
  return ` ${value} `.includes(` ${phrase} `);
}

export function matchRequestToShop(
  request: MatchableRequest,
  profile: ShopMatchingProfile,
): RequestMatch {
  const requestCategory = normalizeMatchText(request.category);
  const shopCategories = profile.productCategories
    .map(normalizeMatchText)
    .filter(Boolean);
  const requestAreas = splitAreas(request.area);
  const shopAreas = splitAreas(profile.location);
  const categoryMatches =
    requestCategory.length > 0 && shopCategories.includes(requestCategory);
  const areaMatches = requestAreas.some((requestArea) =>
    shopAreas.some(
      (shopArea) =>
        containsWholePhrase(requestArea, shopArea) ||
        containsWholePhrase(shopArea, requestArea),
    ),
  );

  return {
    matches: categoryMatches && areaMatches,
    categoryMatches,
    areaMatches,
    hasShopCategories: shopCategories.length > 0,
    hasServiceArea: shopAreas.length > 0,
  };
}
