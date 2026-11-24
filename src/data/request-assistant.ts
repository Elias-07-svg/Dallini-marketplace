import type { RequestCategory } from '@/data/request-categories';

export type AssistantLanguage = 'ar' | 'en';
export type AssistantStep = 'item' | 'description' | 'category' | 'location' | 'summary';

export const ASSISTANT_CATEGORY_LABELS: Record<RequestCategory, string> = {
  إلكترونيات: 'Electronics',
  أثاث: 'Furniture',
  رياضة: 'Sports',
  أزياء: 'Fashion',
  'منزل ومطبخ': 'Home & kitchen',
  'جمال وعناية': 'Beauty & care',
  ألعاب: 'Toys',
  أخرى: 'Other',
};

export function getAssistantCopy(language: AssistantLanguage) {
  const arabic = language === 'ar';
  return {
    title: arabic ? 'مساعد الطلب' : 'Request helper',
    subtitle: arabic ? 'نرتّب طلبك خطوة خطوة' : 'Let’s shape your request one step at a time',
    guidedLabel: arabic ? 'مساعد إرشادي محلي • ما في مزوّد AI متصل' : 'Guided helper • no AI provider connected',
    welcome: arabic
      ? 'أهلاً! رح أساعدك نرتّب طلبك سؤال بسؤال. هالمحادثة محلية، وما بتنشر ولا بتوصل للمحلات.'
      : 'Hi! I’ll help organize your request one question at a time. This chat stays in the app; it does not publish or contact shops.',
    prompts: {
      item: arabic ? 'شو الغرض أو الخدمة اللي عم تدور عليها؟' : 'What item or service are you looking for?',
      description: arabic
        ? 'شو أهم التفاصيل أو المواصفات اللي لازم يعرفها المحل؟'
        : 'What details or specifications should a shop know?',
      category: arabic ? 'أي فئة أقرب لطلبك؟' : 'Which category fits your request best?',
      location: arabic
        ? 'بأي محافظة أو مدينة أو بلدة بسوريا بدك تلاقيه؟'
        : 'Which governorate, city, town, or village in Syria should shops serve?',
    } satisfies Record<Exclude<AssistantStep, 'summary'>, string>,
    placeholders: {
      item: arabic ? 'مثلاً: غسالة أو تصليح مكيّف' : 'For example: washing machine or AC repair',
      description: arabic ? 'النوع، المقاس، الحالة، ميزانيتك…' : 'Type, size, condition, budget…',
    },
    send: arabic ? 'إرسال' : 'Send',
    itemLabel: arabic ? 'الغرض أو الخدمة' : 'Item or service',
    descriptionLabel: arabic ? 'التفاصيل' : 'Details',
    categoryLabel: arabic ? 'الفئة' : 'Category',
    locationLabel: arabic ? 'الموقع في سوريا' : 'Location in Syria',
    summaryHeading: arabic ? 'ملخّص المسودة' : 'Draft summary',
    summaryNote: arabic
      ? 'راجع المعلومات وعدّل أي جزء. ما رح يننشر الطلب أو ينوصل للمحلات من هون.'
      : 'Review and edit any detail. Nothing is published or sent to shops from here.',
    summaryReady: arabic
      ? 'جهّزت ملخّص طلبك. فيك تعدّل أي نقطة، وبعدها تتابع للمراجعة.'
      : 'Your request draft is organized. Edit any part, then continue to review it.',
    edit: arabic ? 'تعديل' : 'Edit',
    editPrompt: (field: AssistantStep) => {
      const labels = arabic
        ? { item: 'شو الغرض أو الخدمة؟', description: 'شو التفاصيل اللي بدك تضيفها؟', category: 'اختار الفئة المناسبة.', location: 'اختار الموقع بسوريا.' }
        : { item: 'What item or service should I use?', description: 'What details should I add?', category: 'Choose the best category.', location: 'Choose a location in Syria.' };
      return field === 'summary' ? '' : labels[field];
    },
    editSaved: arabic ? 'تم تعديل هالمعلومة بالمسودة.' : 'I updated that detail in the draft.',
    continueReview: arabic ? 'تابع لمراجعة الطلب' : 'Continue to request review',
    manualEntry: arabic ? 'اكتب الطلب بنفسك أو أضف صورة' : 'Write it yourself or add a photo',
    languageAction: arabic ? 'English' : 'العربية',
    back: arabic ? 'رجوع' : 'Back',
  };
}

export function getAssistantCategoryLabel(category: RequestCategory, language: AssistantLanguage) {
  return language === 'ar' ? category : ASSISTANT_CATEGORY_LABELS[category];
}
