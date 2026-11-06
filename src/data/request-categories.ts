export const REQUEST_CATEGORIES = [
  'إلكترونيات',
  'أثاث',
  'رياضة',
  'أزياء',
  'منزل ومطبخ',
  'جمال وعناية',
  'ألعاب',
  'أخرى',
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export const REQUEST_CATEGORY_ICONS: Record<RequestCategory, string> = {
  إلكترونيات: '📱',
  أثاث: '🛋️',
  رياضة: '⚽',
  أزياء: '👟',
  'منزل ومطبخ': '🏠',
  'جمال وعناية': '🧴',
  ألعاب: '🧸',
  أخرى: '✨',
};

export const REQUEST_CATEGORY_PROMPTS: Record<RequestCategory, string> = {
  إلكترونيات: 'بدّي موبايل أو جهاز إلكتروني جديد',
  أثاث: 'عم فتّش على قطعة أثاث',
  رياضة: 'بدّي معدات أو أغراض رياضية',
  أزياء: 'بدّي أشتري قطعة أزياء',
  'منزل ومطبخ': 'عم فتّش على غرض للمنزل أو المطبخ',
  'جمال وعناية': 'بدّي منتج للجمال أو العناية',
  ألعاب: 'عم فتّش على لعبة',
  أخرى: 'عم فتّش على غرض تاني',
};
