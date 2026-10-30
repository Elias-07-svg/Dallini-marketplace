export type MockShopRequest = {
  id: string;
  customer: string;
  received: string;
  title: string;
  category: string;
  location: string;
  budgetLabel: string;
  description: string;
  imageEmoji: string;
  imageBackground: string;
};

export const mockShopRequests: MockShopRequest[] = [
  {
    id: 'phone-104',
    customer: 'لينا',
    received: 'منذ ١٢ دقيقة',
    title: 'موبايل سامسونغ مستعمل',
    category: 'إلكترونيات',
    location: 'بيروت، الحمرا',
    budgetLabel: 'لحدود ٢٥٠$',
    description:
      'بدّي موبايل سامسونغ مستعمل بحالة منيحة، بطاريته بتدوم وشاشته بلا كسور. بفضّل استلمه من بيروت.',
    imageEmoji: '📱',
    imageBackground: '#E8F3EE',
  },
  {
    id: 'sofa-208',
    customer: 'جاد',
    received: 'منذ ٣٥ دقيقة',
    title: 'كنباية زاوية للصالون',
    category: 'أثاث',
    location: 'جونية',
    budgetLabel: 'لحدود ٤٠٠$',
    description:
      'عم فتّش على كنباية زاوية مستعملة أو جديدة، لونها بيج أو رمادي، وقماشها سهل التنظيف.',
    imageEmoji: '🛋️',
    imageBackground: '#F5EFE5',
  },
  {
    id: 'bike-310',
    customer: 'رنا',
    received: 'منذ ساعة',
    title: 'دراجة هوائية للكبار',
    category: 'رياضة',
    location: 'طرابلس',
    budgetLabel: 'لحدود ١٨٠$',
    description:
      'بدي دراجة للمدينة بحالة منيحة، مناسبة لطول متوسط، وإذا في توصيل لطرابلس بيكون أحسن.',
    imageEmoji: '🚲',
    imageBackground: '#EEF0F8',
  },
];
