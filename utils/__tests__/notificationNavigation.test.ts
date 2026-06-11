import {
  getNavigationRoute,
  navigateFromNotification,
} from '../notificationNavigation';

/**
 * Notification routing decides where a tapped push lands. Covers the typed
 * mapping (incl. the rejected-DD route and the typed-route-over-flat-hint
 * preference changed in the release hardening pass).
 */

describe('getNavigationRoute', () => {
  it('routes a ride request into the DD ride queue', () => {
    const r = getNavigationRoute({ type: 'ride_request', sessionId: 's1', eventId: 'e1' });
    expect(r).toEqual({
      screen: 'Rides',
      params: { screen: 'DDRideQueue', params: { sessionId: 's1', eventId: 'e1' } },
    });
  });

  it('routes ride status changes to the rider RideStatus screen', () => {
    for (const type of ['ride_accepted', 'ride_picked_up', 'ride_cancelled'] as const) {
      expect(getNavigationRoute({ type, eventId: 'e1' })).toEqual({
        screen: 'Rides',
        params: { screen: 'RideStatus', params: { eventId: 'e1' } },
      });
    }
  });

  it('routes a SEP failure to the admin dashboard', () => {
    expect(getNavigationRoute({ type: 'sep_failure', alertId: 'a1' })).toMatchObject({
      screen: 'Admin',
      params: { screen: 'AdminDashboard' },
    });
  });

  it('sends an approved DD into the upgrade flow', () => {
    expect(getNavigationRoute({ type: 'dd_request_approved' })).toEqual({ screen: 'DDUpgrade' });
  });

  it('sends a rejected DD to the event detail, NOT the become-a-DD form', () => {
    expect(getNavigationRoute({ type: 'dd_request_rejected', eventId: 'e9' })).toEqual({
      screen: 'Events',
      params: { screen: 'EventDetail', params: { eventId: 'e9' } },
    });
  });

  it('falls back to the Events tab for a rejected DD with no eventId', () => {
    expect(getNavigationRoute({ type: 'dd_request_rejected' })).toEqual({ screen: 'Events' });
  });

  it('returns null for an unknown type', () => {
    expect(getNavigationRoute({ type: 'totally_made_up' as any })).toBeNull();
  });
});

describe('navigateFromNotification', () => {
  it('prefers the typed nested route over the flat server-provided screen hint', () => {
    const navigate = jest.fn();
    // Server sent a flat hint, but the typed route reaches the nested tab stack
    navigateFromNotification(
      { type: 'ride_request', sessionId: 's1', eventId: 'e1', screen: 'DDRideQueue' } as any,
      { navigate }
    );
    expect(navigate).toHaveBeenCalledWith('Rides', {
      screen: 'DDRideQueue',
      params: { sessionId: 's1', eventId: 'e1' },
    });
  });

  it('falls back to the flat screen hint when the type is unmapped', () => {
    const navigate = jest.fn();
    navigateFromNotification({ screen: 'SomeScreen', params: { x: 1 } } as any, { navigate });
    expect(navigate).toHaveBeenCalledWith('SomeScreen', { x: 1 });
  });

  it('no-ops safely when the navigation ref is missing', () => {
    expect(() => navigateFromNotification({ type: 'ride_request' } as any, null)).not.toThrow();
  });
});
