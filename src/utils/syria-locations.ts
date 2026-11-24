import { SYRIA_LOCATION_CATALOG } from '@/data/syria-locations.generated';

export type SyriaLocationLevel = 'governorate' | 'district' | 'subdistrict' | 'locality';

export type SyriaLocation = {
  id: string;
  parentId: string | null;
  name: string;
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

SYRIA_LOCATION_CATALOG.governorates.forEach(([id, name]) => {
  addLocation({ id, parentId: null, name, level: 'governorate' });
});
SYRIA_LOCATION_CATALOG.districts.forEach(([id, parentId, name]) => {
  addLocation({ id, parentId, name, level: 'district' });
});
SYRIA_LOCATION_CATALOG.subdistricts.forEach(([id, parentId, name]) => {
  addLocation({ id, parentId, name, level: 'subdistrict' });
});
SYRIA_LOCATION_CATALOG.localities.forEach(([id, parentId, name]) => {
  addLocation({ id, parentId, name, level: 'locality' });
});

export function getSyriaLocation(value: string | null | undefined) {
  return value ? locationsById.get(value) ?? null : null;
}

export function isSyriaLocation(value: string | null | undefined): value is string {
  return Boolean(value && locationsById.has(value));
}

export function getSyriaLocationChildren(parentId?: string | null) {
  return parentId ? childrenByParent.get(parentId) ?? [] : SYRIA_LOCATION_CATALOG.governorates.map(
    ([id, name]) => ({ id, parentId: null, name, level: 'governorate' as const }),
  );
}

export function searchSyriaLocalities(subdistrictId: string, query: string, limit = 18) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ar');
  if (normalizedQuery.length < 1) return [];

  return (childrenByParent.get(subdistrictId) ?? [])
    .filter((location) => location.name.toLocaleLowerCase('ar').includes(normalizedQuery))
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

export function formatSyriaLocation(value: string | null | undefined) {
  if (!value) return 'الموقع غير محدد';
  const path = getSyriaLocationPath(value);
  return path.length ? path.map((item) => item.name).join('، ') : 'موقع محفوظ بحاجة لتحديث';
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
