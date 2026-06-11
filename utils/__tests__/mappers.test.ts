import {
  mapUser,
  mapRideRequest,
  mapDDSession,
  mapNotification,
} from '../mappers';

/**
 * Mappers translate snake_case DB rows into camelCase domain objects. A wrong
 * field name here fails silently (data just goes missing in the UI), so these
 * lock the column mapping and the nullable-date handling.
 */

describe('mapUser', () => {
  it('maps snake_case columns and parses dates', () => {
    const row = {
      id: 'u1', email: 'a@b.com', name: 'Alex', birthday: '2004-05-01',
      age: 21, gender: 'male', group_id: 'g1', role: 'member', is_dd: true,
      dd_status: 'active', car_make: 'Toyota', car_model: 'Camry', car_plate: 'ABC123',
      phone_number: '+15551234567', license_photo_url: 'lic', profile_photo_url: 'pic',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
    };
    const u = mapUser(row);
    expect(u.groupId).toBe('g1');
    expect(u.isDD).toBe(true);
    expect(u.ddStatus).toBe('active');
    expect(u.carPlate).toBe('ABC123');
    expect(u.phoneNumber).toBe('+15551234567');
    expect(u.profilePhotoUrl).toBe('pic');
    expect(u.createdAt).toBeInstanceOf(Date);
    expect(u.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('mapRideRequest', () => {
  const base = {
    id: 'r1', dd_user_id: 'dd1', rider_user_id: 'rd1', event_id: 'e1',
    pickup_location_text: 'Library', pickup_latitude: 1.2, pickup_longitude: 3.4,
    status: 'pending', created_at: '2026-01-01T00:00:00Z',
    accepted_at: null, picked_up_at: null, completed_at: null,
  };

  it('leaves optional timestamps undefined when null', () => {
    const r = mapRideRequest(base);
    expect(r.acceptedAt).toBeUndefined();
    expect(r.pickedUpAt).toBeUndefined();
    expect(r.completedAt).toBeUndefined();
    expect(r.ddUserId).toBe('dd1');
    expect(r.riderUserId).toBe('rd1');
  });

  it('parses optional timestamps into Dates when present', () => {
    const r = mapRideRequest({ ...base, accepted_at: '2026-01-01T01:00:00Z' });
    expect(r.acceptedAt).toBeInstanceOf(Date);
    expect(r.acceptedAt!.toISOString()).toBe('2026-01-01T01:00:00.000Z');
  });
});

describe('mapDDSession', () => {
  it('maps active session with no end time', () => {
    const s = mapDDSession({
      id: 's1', user_id: 'u1', event_id: 'e1',
      started_at: '2026-01-01T00:00:00Z', ended_at: null, is_active: true,
    });
    expect(s.isActive).toBe(true);
    expect(s.endedAt).toBeUndefined();
    expect(s.startedAt).toBeInstanceOf(Date);
  });
});

describe('mapNotification', () => {
  it('defaults retryCount to 0 when the column is null', () => {
    const n = mapNotification({
      id: 'n1', user_id: 'u1', type: 'ride_request', title: 'T', body: 'B',
      data: {}, priority: 'high', read: false,
      sent_at: null, delivered_at: null, failed_at: null, failure_reason: null,
      retry_count: null, created_at: '2026-01-01T00:00:00Z',
    });
    expect(n.retryCount).toBe(0);
    expect(n.read).toBe(false);
    expect(n.sentAt).toBeUndefined();
  });
});
