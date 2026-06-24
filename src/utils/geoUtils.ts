export interface DeliveryZone {
  id: string;
  name: string;
  coordinates: [number, number][]; // Array of [lat, lng]
  deliveryFee: number;
  minOrder: number;
  deliveryTime: string; // e.g. "30-45 mins"
  message: string;
  color: string;
  isNoDelivery?: boolean;
}

/**
 * Checks if a point [lat, lng] is inside a polygon [lat, lng][] using Ray-Casting Algorithm.
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (!polygon || polygon.length < 3) return false;
  
  const lat = point[0];
  const lng = point[1];
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const latI = polygon[i][0];
    const lngI = polygon[i][1];
    const latJ = polygon[j][0];
    const lngJ = polygon[j][1];
    
    // Check if the horizontal ray intersects the polygon boundary segment
    const intersect = ((latI > lat) !== (latJ > lat)) &&
      (lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI);
      
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Standard colors for drawing zones.
 */
export const ZONE_COLORS = [
  { name: 'Indigo Accent', value: '#6366f1' },
  { name: 'Emerald Green', value: '#10b981' },
  { name: 'Sky Blue', value: '#0ea5e9' },
  { name: 'Amber Orange', value: '#f59e0b' },
  { name: 'Rose Red', value: '#f43f5e' },
  { name: 'Purple Dream', value: '#a855f7' }
];

/**
 * Format currency helper
 */
export function formatCurrency(amount: number): string {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
