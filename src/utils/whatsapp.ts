type WhatsAppMessageDetails = {
  requestTitle: string;
  requestDetails: string;
  shopName: string;
  itemName: string;
  price: string;
  currencySuffix?: string;
  deliveryNote: string;
};

export function normalizeInternationalWhatsAppNumber(value: string) {
  const normalizedDigits = value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  const compactNumber = normalizedDigits.replace(/[\s().-]/g, '');

  return /^\+[1-9]\d{7,14}$/.test(compactNumber) ? compactNumber : null;
}

export function createWhatsAppClickToChatUrl(
  phoneNumber: string,
  details: WhatsAppMessageDetails,
) {
  const requestDetails = details.requestDetails.trim().slice(0, 450);
  const message = [
    `مرحبا ${details.shopName}، عم بتواصل معكم بخصوص طلبي «${details.requestTitle}».`,
    requestDetails ? `تفاصيل الطلب: ${requestDetails}` : '',
    `اخترت عرضكم للمنتج «${details.itemName}» بسعر ${details.price}${details.currencySuffix ?? '$'}.`,
    `ملاحظة التوصيل: ${details.deliveryNote}`,
  ]
    .filter(Boolean)
    .join('\n');

  return createWhatsAppTextUrl(phoneNumber, message);
}

export function createWhatsAppTextUrl(phoneNumber: string, message: string) {
  const normalizedNumber = normalizeInternationalWhatsAppNumber(phoneNumber);
  if (!normalizedNumber) return null;
  return `https://wa.me/${normalizedNumber.slice(1)}?text=${encodeURIComponent(message)}`;
}
