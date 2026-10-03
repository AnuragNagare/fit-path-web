// MOCK DATA — placeholders until a real source (e.g. Google Places) is added.
// Everything fake in the UI comes from this file so it is easy to find and remove.

// Stable per-gym number, so the same gym always gets the same mock values.
function hashId(gymId: string): number {
  let hash = 0;
  for (let i = 0; i < gymId.length; i++) hash = (hash * 31 + gymId.charCodeAt(i)) >>> 0;
  return hash;
}

// Rating between 3.8 and 4.8.
export function mockRating(gymId: string): number {
  return Math.round((3.8 + (hashId(gymId) % 11) / 10) * 10) / 10;
}

// Review count between 40 and about 2,000, shown like "1.2K".
export function mockReviews(gymId: string): string {
  const count = 40 + ((hashId(gymId) >>> 4) % 1960);
  return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);
}

// Monthly price ₹999–₹2,499 (ends in 99) and a day pass at roughly 18% of it.
export function mockPrices(gymId: string): { month: string; day: string } {
  const month = 999 + ((hashId(gymId) >>> 8) % 16) * 100;
  const day = Math.round((month * 0.18) / 10) * 10 - 1;
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  return { month: inr(month), day: inr(day) };
}

// Shown on the landing page as "Avg. rating" (mock, like the per-gym ratings).
export const MOCK_AVG_RATING = 4.6;
