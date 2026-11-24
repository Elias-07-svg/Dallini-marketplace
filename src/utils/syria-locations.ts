import { SYRIA_LOCATION_CATALOG } from '@/data/syria-locations.generated';

export type SyriaLocationLevel = 'governorate' | 'district' | 'subdistrict' | 'locality';

export type SyriaLocation = {
  id: string;
  parentId: string | null;
  name: string;
  nameEnglish: string;
  level: SyriaLocationLevel;
};

const locationsById = new Map<string, SyriaLocation>();
const childrenByParent = new Map<string, SyriaLocation[]>();

function addLocation(location: SyriaLocation) {
  locationsById.set(location.id, location);
  if (location.parentId) {
    const current = childrenByParent.get(location.parentId) ?? [];
    current.push(location);
    childrenByParent.set(location.parentId, current);
  }
}

SYRIA_LOCATION_CATALOG.governorates.forEach(([id, name, nameEnglish]) => {
  addLocation({ id, parentId: null, name, nameEnglish, level: 'governorate' });
});
SYRIA_LOCATION_CATALOG.districts.forEach(([id, parentId, name, nameEnglish]) => {
  addLocation({ id, parentId, name, nameEnglish, level: 'district' });
});
SYRIA_LOCATION_CATALOG.subdistricts.forEach(([id, parentId, name, nameEnglish]) => {
  addLocation({ id, parentId, name, nameEnglish, level: 'subdistrict' });
});
SYRIA_LOCATION_CATALOG.localities.forEach(([id, parentId, name, nameEnglish]) => {
  addLocation({ id, parentId, name, nameEnglish, level: 'locality' });
});

export function getSyriaLocation(value: string | null | undefined) {
  return value ? locationsById.get(value) ?? null : null;
}

export function isSyriaLocation(value: string | null | undefined): value is string {
  return Boolean(value && locationsById.has(value));
}

export function getSyriaLocationChildren(parentId?: string | null) {
  return parentId ? childrenByParent.get(parentId) ?? [] : SYRIA_LOCATION_CATALOG.governorates.map(
    ([id, name, nameEnglish]) => ({ id, parentId: null, name, nameEnglish, level: 'governorate' as const }),
  );
}

export function searchSyriaLocalities(subdistrictId: string, query: string, limit = 18) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ar');
  if (normalizedQuery.length < 1) return [];

  return (childrenByParent.get(subdistrictId) ?? [])
    .filter((location) =>
      location.name.toLocaleLowerCase('ar').includes(normalizedQuery) ||
      location.nameEnglish.toLocaleLowerCase('en').includes(normalizedQuery),
    )
    .slice(0, limit);
}

export function getSyriaLocationPath(value: string | null | undefined) {
  const location = getSyriaLocation(value);
  if (!location) return [];

  const path: SyriaLocation[] = [location];
  let parent = location.parentId ? getSyriaLocation(location.parentId) : null;
  while (parent) {
    path.unshift(parent);
    parent = parent.parentId ? getSyriaLocation(parent.parentId) : null;
  }
  return path;
}

export function getSyriaLocationName(location: SyriaLocation, language: 'ar' | 'en' = 'ar') {
  return language === 'ar' ? location.name : location.nameEnglish;
}

export function formatSyriaLocation(value: string | null | undefined) {
  return formatSyriaLocationForLanguage(value, 'ar');
}

export function formatSyriaLocationForLanguage(value: string | null | undefined, language: 'ar' | 'en') {
  if (!value) return language === 'ar' ? 'الموقع غير محدد' : 'Location not specified';
  const path = getSyriaLocationPath(value);
  if (!path.length) return language === 'ar' ? 'موقع محفوظ بحاجة لتحديث' : 'Saved location needs updating';
  return path.map((item) => getSyriaLocationName(item, language)).join(language === 'ar' ? '، ' : ', ');
}

export function locationsOverlap(firstId: string, secondId: string) {
  const firstPath = getSyriaLocationPath(firstId);
  const secondPath = getSyriaLocationPath(secondId);
  if (firstPath.length === 0 || secondPath.length === 0) return false;
  return firstPath.some((location) => location.id === secondId) ||
    secondPath.some((location) => location.id === firstId);
}

export const SYRIA_LOCATION_LEVEL_LABELS: Record<SyriaLocationLevel, string> = {
  governorate: 'المحافظة',
  district: 'المدينة أو المنطقة',
  subdistrict: 'الناحية',
  locality: 'البلدة أو القرية',
};
