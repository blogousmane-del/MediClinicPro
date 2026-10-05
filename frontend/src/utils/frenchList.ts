// Énumération à la française : « a », « a et b », « a, b et c » (ou « ou »).
export const frenchList = (items: readonly string[], conjunction: 'et' | 'ou' = 'et'): string => {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
};
