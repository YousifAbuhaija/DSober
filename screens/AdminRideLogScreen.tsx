import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Event } from '../types/database.types';
import { colors, spacing, typography, radii } from '../theme';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import SectionHeader from '../components/ui/SectionHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RideRequestWithDetails {
  id: string;
  ddUserId: string;
  riderUserId: string;
  eventId: string;
  pickupLocationText: string;
  status: string;
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  riderName: string;
  ddName: string;
  eventName: string;
}

interface FilterState {
  dateRange: 'all' | 'today' | 'week' | 'month';
  status: 'all' | 'pending' | 'accepted' | 'picked_up' | 'completed' | 'cancelled';
  eventId: string | null;
}

interface RideStats {
  totalRides: number;
  activeRides: number;
  completedRides: number;
  averageDuration: number;
}

interface DDStats {
  ddUserId: string;
  ddName: string;
  totalRides: number;
  completedRides: number;
  averageDuration: number;
}

interface EventStats {
  eventId: string;
  eventName: string;
  totalRides: number;
  eventDateTime: Date;
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',     color: colors.ui.warning },
  accepted:  { label: 'Accepted',    color: colors.ui.success },
  picked_up: { label: 'In Progress', color: colors.brand.primary },
  completed: { label: 'Completed',   color: colors.text.tertiary },
  cancelled: { label: 'Cancelled',   color: colors.ui.error },
};

const DATE_OPTS = [
  { value: 'all' as const,   label: 'All' },
  { value: 'today' as const, label: 'Today' },
  { value: 'week' as const,  label: 'Week' },
  { value: 'month' as const, label: 'Month' },
];

const STATUS_OPTS = [
  { value: 'all' as const,       label: 'All' },
  { value: 'pending' as const,   label: 'Pending' },
  { value: 'accepted' as const,  label: 'Accepted' },
  { value: 'picked_up' as const, label: 'In Progress' },
  { value: 'completed' as const, label: 'Completed' },
  { value: 'cancelled' as const, label: 'Cancelled' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminRideLogScreen() {
  const { user } = useAuth();
  const [allRides, setAllRides] = useState<RideRequestWithDetails[]>([]);
  const [filtered, setFiltered] = useState<RideRequestWithDetails[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<RideStats>({ totalRides: 0, activeRides: 0, completedRides: 0, averageDuration: 0 });
  const [ddStats, setDDStats] = useState<DDStats[]>([]);
  const [eventStats, setEventStats] = useState<EventStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ dateRange: 'all', status: 'all', eventId: null });
  const [showFilters, setShowFilters] = useState(false);
  const [showDDStats, setShowDDStats] = useState(false);

  useFocusEffect(React.useCallback(() => { load(); }, [user?.groupId]));

  // ─── Data ─────────────────────────────────────────────────────────────────

  const load = async () => {
    if (!user?.groupId || user.role !== 'admin') { setLoading(false); setRefreshing(false); return; }
    try {
      const { data: evtData, error: evtErr } = await supabase
        .from('events').select('*').eq('group_id', user.groupId).order('date_time', { ascending: false });
      if (evtErr) throw evtErr;

      const evts: Event[] = (evtData || []).map((e) => ({
        id: e.id, groupId: e.group_id, name: e.name, description: e.description,
        dateTime: new Date(e.date_time), locationText: e.location_text,
        status: e.status, createdByUserId: e.created_by_user_id, createdAt: new Date(e.created_at),
      }));
      setEvents(evts);

      const ids = evts.map((e) => e.id);
      if (!ids.length) { setAllRides([]); setFiltered([]); calcStats([]); setLoading(false); setRefreshing(false); return; }

      const { data: reqData, error: reqErr } = await supabase
        .from('ride_requests').select('*').in('event_id', ids).order('created_at', { ascending: false });
      if (reqErr) throw reqErr;

      const uids = new Set<string>();
      (reqData || []).forEach((r) => { uids.add(r.rider_user_id); uids.add(r.dd_user_id); });
      const { data: usersData } = await supabase.from('users').select('id, name').in('id', [...uids]);

      const rides: RideRequestWithDetails[] = (reqData || []).map((r) => ({
        id: r.id, ddUserId: r.dd_user_id, riderUserId: r.rider_user_id, eventId: r.event_id,
        pickupLocationText: r.pickup_location_text, status: r.status,
        createdAt: new Date(r.created_at),
        acceptedAt:  r.accepted_at  ? new Date(r.accepted_at)  : undefined,
        completedAt: r.completed_at ? new Date(r.completed_at) : undefined,
        riderName: usersData?.find((u) => u.id === r.rider_user_id)?.name ?? 'Unknown',
        ddName:    usersData?.find((u) => u.id === r.dd_user_id)?.name    ?? 'Unknown',
        eventName: evts.find((e) => e.id === r.event_id)?.name             ?? 'Unknown Event',
      }));

      setAllRides(rides);
      applyFilters(rides, filters);
      calcStats(rides);
      calcDDStats(rides);
      calcEventStats(rides, evts);
    } catch {
      Alert.alert('Error', 'Failed to load ride log');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  const calcStats = (rides: RideRequestWithDetails[]) => {
    const done = rides.filter((r) => r.status === 'completed' && r.acceptedAt && r.completedAt);
    setStats({
      totalRides:    rides.length,
      activeRides:   rides.filter((r) => r.status === 'accepted' || r.status === 'picked_up').length,
      completedRides: rides.filter((r) => r.status === 'completed').length,
      averageDuration: done.length
        ? done.reduce((s, r) => s + (r.completedAt!.getTime() - r.acceptedAt!.getTime()), 0) / done.length / 60000
        : 0,
    });
  };

  const calcDDStats = (rides: RideRequestWithDetails[]) => {
    const map = new Map<string, { name: string; rides: RideRequestWithDetails[] }>();
    rides.forEach((r) => {
      if (!map.has(r.ddUserId)) map.set(r.ddUserId, { name: r.ddName, rides: [] });
      map.get(r.ddUserId)!.rides.push(r);
    });
    const out: DDStats[] = [...map.entries()].map(([id, d]) => {
      const done = d.rides.filter((r) => r.status === 'completed' && r.acceptedAt && r.completedAt);
      return {
        ddUserId: id, ddName: d.name, totalRides: d.rides.length,
        completedRides: d.rides.filter((r) => r.status === 'completed').length,
        averageDuration: done.length
          ? done.reduce((s, r) => s + (r.completedAt!.getTime() - r.acceptedAt!.getTime()), 0) / done.length / 60000
          : 0,
      };
    });
    setDDStats(out.sort((a, b) => b.totalRides - a.totalRides));
  };

  const calcEventStats = (rides: RideRequestWithDetails[], evts: Event[]) => {
    const map = new Map<string, { name: string; dt: Date; n: number }>();
    rides.forEach((r) => {
      const e = evts.find((ev) => ev.id === r.eventId);
      if (!e) return;
      if (!map.has(r.eventId)) map.set(r.eventId, { name: e.name, dt: e.dateTime, n: 0 });
      map.get(r.eventId)!.n++;
    });
    setEventStats([...map.entries()]
      .map(([id, d]) => ({ eventId: id, eventName: d.name, eventDateTime: d.dt, totalRides: d.n }))
      .sort((a, b) => b.totalRides - a.totalRides));
  };

  const applyFilters = (rides: RideRequestWithDetails[], f: FilterState) => {
    let out = [...rides];
    if (f.dateRange !== 'all') {
      const start = new Date();
      if (f.dateRange === 'today') start.setHours(0, 0, 0, 0);
      else if (f.dateRange === 'week') start.setDate(start.getDate() - 7);
      else start.setMonth(start.getMonth() - 1);
      out = out.filter((r) => r.createdAt >= start);
    }
    if (f.status !== 'all') out = out.filter((r) => r.status === f.status);
    if (f.eventId) out = out.filter((r) => r.eventId === f.eventId);
    setFiltered(out);
  };

  const setFilter = (key: keyof FilterState, val: any) => {
    const next = { ...filters, [key]: val };
    setFilters(next);
    applyFilters(allRides, next);
  };

  const fmtTime = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const fmtMin = (m: number) => m < 60 ? `${Math.round(m)}m` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (user?.role !== 'admin') {
    return <EmptyState icon="shield-outline" title="Admin Access Required" subtitle="This section is only available to admins." />;
  }
  if (loading) return <LoadingScreen message="Loading ride log…" />;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* ── Page header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Ride Activity Log</Text>
        <TouchableOpacity
          style={[s.filterToggle, showFilters && s.filterToggleOn]}
          onPress={() => setShowFilters((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showFilters ? 'close' : 'options-outline'}
            size={16}
            color={showFilters ? '#fff' : colors.text.secondary}
          />
          {!showFilters && <Text style={s.filterToggleLabel}>Filter</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.brand.primary} />
        }
      >

        {/* ── Stats bar ── */}
        <View style={s.statsBar}>
          <StatCell label="TOTAL" value={String(stats.totalRides)} />
          <View style={s.statDivider} />
          <StatCell label="ACTIVE" value={String(stats.activeRides)} color={stats.activeRides > 0 ? colors.ui.success : undefined} />
          <View style={s.statDivider} />
          <StatCell label="COMPLETED" value={String(stats.completedRides)} color={colors.brand.primary} />
          <View style={s.statDivider} />
          <StatCell label="AVG TIME" value={stats.averageDuration > 0 ? fmtMin(stats.averageDuration) : '—'} />
        </View>

        {/* ── Filters (floats on canvas) ── */}
        {showFilters && (
          <View style={s.filtersWrap}>
            <ChipGroup label="DATE" opts={DATE_OPTS} value={filters.dateRange} onChange={(v) => setFilter('dateRange', v)} />
            <ChipGroup label="STATUS" opts={STATUS_OPTS} value={filters.status} onChange={(v) => setFilter('status', v)} />
            {events.length > 0 && (
              <View>
                <Text style={s.chipGroupLabel}>EVENT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.chipRow}>
                    <Chip label="All Events" active={!filters.eventId} onPress={() => setFilter('eventId', null)} />
                    {events.slice(0, 10).map((e) => (
                      <Chip key={e.id} label={e.name} active={filters.eventId === e.id} onPress={() => setFilter('eventId', e.id)} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* ── Driver stats ── */}
        {ddStats.length > 0 && (
          <>
            <SectionHeader title="Driver Statistics" />
            <View style={s.block}>
              <TouchableOpacity style={s.collapseRow} onPress={() => setShowDDStats((v) => !v)} activeOpacity={0.7}>
                <Text style={s.collapseTitle}>{showDDStats ? 'Hide breakdown' : `${ddStats.length} drivers`}</Text>
                <Ionicons name={showDDStats ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text.tertiary} />
              </TouchableOpacity>
              {showDDStats && ddStats.slice(0, 10).map((dd, i) => (
                <View key={dd.ddUserId} style={[s.listRow, i === 0 && s.listRowFirst]}>
                  <View style={s.listRowLeft}>
                    <Text style={s.listRowPrimary} numberOfLines={1}>{dd.ddName}</Text>
                    <Text style={s.listRowSub}>
                      {dd.completedRides} completed{dd.averageDuration > 0 ? ` · ${fmtMin(dd.averageDuration)} avg` : ''}
                    </Text>
                  </View>
                  <View style={s.listRowRight}>
                    <Text style={s.listRowValue}>{dd.totalRides}</Text>
                    <Text style={s.listRowValueLabel}>rides</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Busiest events ── */}
        {eventStats.length > 0 && (
          <>
            <SectionHeader title="Busiest Events" />
            <View style={s.block}>
              {eventStats.slice(0, 5).map((ev, i) => (
                <View key={ev.eventId} style={[s.listRow, i === 0 && s.listRowFirst]}>
                  <View style={s.listRowLeft}>
                    <Text style={s.listRowPrimary} numberOfLines={1}>{ev.eventName}</Text>
                    <Text style={s.listRowSub}>
                      {ev.eventDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={s.countBadge}>
                    <Text style={s.countBadgeText}>{ev.totalRides}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Ride history ── */}
        <SectionHeader
          title="Ride History"
          rightLabel={filtered.length > 0 ? String(filtered.length) : undefined}
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No Rides"
            subtitle={
              filters.dateRange !== 'all' || filters.status !== 'all' || filters.eventId
                ? 'No rides match the selected filters'
                : 'Ride activity will appear here once members start requesting rides'
            }
          />
        ) : (
          <View style={s.block}>
            {filtered.map((ride, i) => {
              const cfg = STATUS[ride.status] ?? { label: ride.status, color: colors.text.tertiary };
              const dur = ride.acceptedAt && ride.completedAt
                ? (ride.completedAt.getTime() - ride.acceptedAt.getTime()) / 60000 : null;
              return (
                <View key={ride.id} style={[s.rideRow, i === 0 && s.listRowFirst, { borderLeftColor: cfg.color }]}>
                  <View style={s.rideMain}>
                    <View style={s.rideTop}>
                      <Text style={s.rideRider} numberOfLines={1}>{ride.riderName}</Text>
                      <View style={[s.statusDot, { backgroundColor: cfg.color }]} />
                      <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <View style={s.rideMeta}>
                      <Ionicons name="car-outline" size={11} color={colors.text.tertiary} />
                      <Text style={s.rideMetaText} numberOfLines={1}>{ride.ddName}</Text>
                      <Text style={s.rideMetaDot}>·</Text>
                      <Ionicons name="calendar-outline" size={11} color={colors.text.tertiary} />
                      <Text style={s.rideMetaText} numberOfLines={1}>{ride.eventName}</Text>
                    </View>
                    <View style={s.rideMeta}>
                      <Ionicons name="location-outline" size={11} color={colors.text.tertiary} />
                      <Text style={s.rideMetaText} numberOfLines={1} ellipsizeMode="tail">{ride.pickupLocationText}</Text>
                    </View>
                  </View>
                  <View style={s.rideRight}>
                    <Text style={s.rideTime}>{fmtTime(ride.createdAt)}</Text>
                    {dur !== null && <Text style={s.rideDur}>{fmtMin(dur)}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: spacing['3xl'] }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={sc.cell}>
      <Text style={[sc.value, color ? { color } : {}]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={sc.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: 4 },
  value: { ...typography.title1, color: colors.text.primary, lineHeight: 32 },
  label: { ...typography.label, color: colors.text.tertiary, marginTop: 4, textAlign: 'center' },
});

function ChipGroup({ label, opts, value, onChange }: {
  label: string;
  opts: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={cg.group}>
      <Text style={cg.label}>{label}</Text>
      <View style={cg.row}>
        {opts.map((o) => <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />)}
      </View>
    </View>
  );
}

const cg = StyleSheet.create({
  group: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.text.tertiary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[ch.chip, active && ch.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[ch.text, active && ch.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const ch = StyleSheet.create({
  chip: {
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.input,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  chipActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  text: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' },
  textActive: { color: '#fff' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.canvas },

  // Header
  header: {
    backgroundColor: colors.bg.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: { ...typography.title3, color: colors.text.primary },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  filterToggleOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  filterToggleLabel: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' },

  scroll: { paddingBottom: spacing['3xl'] },

  // Stats bar — full-width surface block, no radius, sealed with top+bottom borders
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.base,
  },

  // Filters — floats on canvas
  filtersWrap: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  chipGroupLabel: { ...typography.label, color: colors.text.tertiary, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm },

  // Shared list block
  block: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },

  // Collapse toggle row
  collapseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  collapseTitle: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' },

  // Generic list row
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    minHeight: 60,
  },
  listRowFirst: { borderTopWidth: 0 },
  listRowLeft: { flex: 1, paddingRight: spacing.sm },
  listRowRight: { alignItems: 'flex-end' },
  listRowPrimary: { ...typography.body, color: colors.text.primary, fontWeight: '500' },
  listRowSub: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  listRowValue: { ...typography.title3, color: colors.text.primary },
  listRowValueLabel: { ...typography.label, color: colors.text.tertiary },

  // Event count badge — circle with border
  countBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countBadgeText: { ...typography.bodyBold, color: colors.text.primary },

  // Ride list row
  rideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: spacing.sm,    // narrower to show left color bar
    paddingRight: spacing.base,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    borderLeftWidth: 3,
  },
  rideMain: { flex: 1, paddingLeft: spacing.sm, gap: 4 },
  rideTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rideRider: { ...typography.bodyBold, color: colors.text.primary, flex: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { ...typography.label, fontWeight: '700' },
  rideMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rideMetaText: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  rideMetaDot: { ...typography.caption, color: colors.text.tertiary },
  rideRight: { alignItems: 'flex-end', gap: 2, paddingLeft: spacing.sm, paddingTop: 2 },
  rideTime: { ...typography.caption, color: colors.text.tertiary },
  rideDur: { ...typography.label, color: colors.text.secondary },
});
