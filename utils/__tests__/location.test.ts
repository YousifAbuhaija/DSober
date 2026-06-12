import { calculateDistance } from '../location';

/**
 * calculateDistance backs the "distance to each on-duty DD" feature and the
 * nearest-first sort on the Find-a-DD list, so its correctness and ordering
 * behavior are pinned here.
 */

describe('calculateDistance', () => {
  it('is zero for identical points', () => {
    expect(calculateDistance(37.2284, -80.4234, 37.2284, -80.4234)).toBe(0);
  });

  it('approximates one degree of latitude as ~69 miles', () => {
    expect(calculateDistance(0, 0, 1, 0)).toBeCloseTo(69.1, 1);
  });

  it('is symmetric (A→B equals B→A)', () => {
    const a = calculateDistance(37.2270, -80.4210, 37.2120, -80.4080);
    const b = calculateDistance(37.2120, -80.4080, 37.2270, -80.4210);
    expect(a).toBe(b);
  });

  it('orders nearer points smaller (drives the nearest-first sort)', () => {
    const rider = { lat: 37.2284, lng: -80.4234 };
    const near = calculateDistance(rider.lat, rider.lng, 37.2270, -80.4210);
    const far = calculateDistance(rider.lat, rider.lng, 37.2120, -80.4080);
    expect(near).toBeLessThan(far);
  });
});
