/** Display names for the brief's audience and product-line ids (Email strategy Brief.md). Ids stay in data only. */
export const AUDIENCE_NAMES: Record<string, string> = {
  A1: 'Bucket-List Trekkers', A2: 'Weekend Warriors', A3: 'Past Travelers and Loyalists', A4: 'Gift Givers', A5: 'Dreamers / Never Booked',
};
export const PRODUCT_LINE_NAMES: Record<string, string> = {
  PL1: 'Guided Treks', PL2: 'Weekend Adventures', PL3: 'Winter and Snow Trips', PL4: 'Private and Custom Trips', PL5: 'Gift Cards and Add-ons',
};
export const briefName = (id: string) => AUDIENCE_NAMES[id] ?? PRODUCT_LINE_NAMES[id] ?? id;
/** Replace bare A1-A5 / PL1-PL5 ids inside prose with their names. */
export const nameify = (text: string) => text.replace(/\b(A[1-5]|PL[1-5])\b/g, (m) => briefName(m));
