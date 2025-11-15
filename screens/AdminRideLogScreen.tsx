import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RideRequest, User, Event } from '../types/database.types';

interface RideRequestWithDetails extends RideRequest {
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
  cancelledRides: number;
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

export default function AdminRideLogScreen() {
  const { user } = useAuth();
  const [rideRequests, setRideRequests] = useState<RideRequestWithDetails[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RideRequestWithDetails[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<RideStats>({
    totalRides: 0,
    activeRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    averageDuration: 0,
  });
  const [ddStats, setDDStats] = useState<DDStats[]>([]);
  const [eventStats, setEventStats] = useState<EventStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: 'all',
    status: 'all',
    eventId: null,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showDDStats, setShowDDStats] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [user?.groupId])
  );

  const fetchData = async () => {
    if (!user?.groupId || user.role !== 'admin') {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Fetch all events for the admin's group
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('group_id', user.groupId)
        .order('date_time', { ascending: false });

      if (eventsError) throw eventsError;

      const mappedEvents: Event[] = (eventsData || []).map((event) => ({
        id: event.id,
        groupId: event.group_id,
        name: event.name,
        description: event.description,
        dateTime: new Date(event.date_time),
        locationText: event.location_text,
        status: event.status,
        createdByUserId: event.created_by_user_id,
        createdAt: new Date(event.created_at),
      }));
      setEvents(mappedEvents);

      // Fetch all ride requests for events in the admin's group
      const eventIds = mappedEvents.map((e) => e.id);
      
      if (eventIds.length === 0) {
        setRideRequests([]);
        setFilteredRequests([]);
        calculateStats([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data: requestsData, error: requestsError } = await supabase
        .from('ride_requests')
        .select('*')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Fetch user details for riders and DDs
      const userIds = new Set<string>();
      (requestsData || []).forEach((req) => {
        userIds.add(req.rider_user_id);
        userIds.add(req.dd_user_id);
      });

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name')
        .in('id', Array.from(userIds));

      if (usersError) throw usersError;

      // Map requests with details
      const mappedRequests: RideRequestWithDetails[] = (requestsData || []).map((req) => {
        const rider = usersData?.find((u) => u.id === req.rider_user_id);
        const dd = usersData?.find((u) => u.id === req.dd_user_id);
        const event = mappedEvents.find((e) => e.id === req.event_id);

        return {
          id: req.id,
          ddUserId: req.dd_user_id,
          riderUserId: req.rider_user_id,
          eventId: req.event_id,
          pickupLocationText: req.pickup_location_text,
          pickupLatitude: req.pickup_latitude,
          pickupLongitude: req.pickup_longitude,
          status: req.status,
          createdAt: new Date(req.created_at),
          acceptedAt: req.accepted_at ? new Date(req.accepted_at) : undefined,
          pickedUpAt: req.picked_up_at ? new Date(req.picked_up_at) : undefined,
          completedAt: req.completed_at ? new Date(req.completed_at) : undefined,
          riderName: rider?.name || 'Unknown',
          ddName: dd?.name || 'Unknown',
          eventName: event?.name || 'Unknown Event',
        };
      });

      setRideRequests(mappedRequests);
      applyFilters(mappedRequests, filters);
      calculateStats(mappedRequests);
      calculateDDStats(mappedRequests);
      calculateEventStats(mappedRequests, mappedEvents);
    } catch (error) {
      console.error('Error fetching ride log data:', error);
      Alert.alert('Error', 'Failed to load ride activity log');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStats = (requests: RideRequestWithDetails[]) => {
    const totalRides = requests.length;
    const activeRides = requests.filter((r) => 
      r.status === 'accepted' || r.status === 'picked_up'
    ).length;
    const completedRides = requests.filter((r) => r.status === 'completed').length;
    const cancelledRides = requests.filter((r) => r.status === 'cancelled').length;

    // Calculate average ride duration for completed rides
    const completedWithDuration = requests.filter(
      (r) => r.status === 'completed' && r.acceptedAt && r.completedAt
    );
    
    let averageDuration = 0;
    if (completedWithDuration.length > 0) {
      const totalDuration = completedWithDuration.reduce((sum, r) => {
        const duration = r.completedAt!.getTime() - r.acceptedAt!.getTime();
        return sum + duration;
      }, 0);
      averageDuration = totalDuration / completedWithDuration.length / 60000; // Convert to minutes
    }

    setStats({
      totalRides,
      activeRides,
      completedRides,
      cancelledRides,
      averageDuration,
    });
  };

  const calculateDDStats = (requests: RideRequestWithDetails[]) => {
    // Group rides by DD
    const ddMap = new Map<string, { name: string; rides: RideRequestWithDetails[] }>();
    
    requests.forEach((ride) => {
      if (!ddMap.has(ride.ddUserId)) {
        ddMap.set(ride.ddUserId, { name: ride.ddName, rides: [] });
      }
      ddMap.get(ride.ddUserId)!.rides.push(ride);
    });

    // Calculate stats for each DD
    const stats: DDStats[] = Array.from(ddMap.entries()).map(([ddUserId, data]) => {
      const totalRides = data.rides.length;
      const completedRides = data.rides.filter((r) => r.status === 'completed').length;
      
      // Calculate average duration for this DD
      const completedWithDuration = data.rides.filter(
        (r) => r.status === 'completed' && r.acceptedAt && r.completedAt
      );
      
      let averageDuration = 0;
      if (completedWithDuration.length > 0) {
        const totalDuration = completedWithDuration.reduce((sum, r) => {
          const duration = r.completedAt!.getTime() - r.acceptedAt!.getTime();
          return sum + duration;
        }, 0);
        averageDuration = totalDuration / completedWithDuration.length / 60000;
      }

      return {
        ddUserId,
        ddName: data.name,
        totalRides,
        completedRides,
        averageDuration,
      };
    });

    // Sort by total rides (descending)
    stats.sort((a, b) => b.totalRides - a.totalRides);
    setDDStats(stats);
  };

  const calculateEventStats = (requests: RideRequestWithDetails[], events: Event[]) => {
    // Group rides by event
    const eventMap = new Map<string, { name: string; dateTime: Date; count: number }>();
    
    requests.forEach((ride) => {
      const event = events.find((e) => e.id === ride.eventId);
      if (event) {
        if (!eventMap.has(ride.eventId)) {
          eventMap.set(ride.eventId, { 
            name: event.name, 
            dateTime: event.dateTime,
            count: 0 
          });
        }
        eventMap.get(ride.eventId)!.count++;
      }
    });

    // Convert to array and sort by ride count (descending)
    const stats: EventStats[] = Array.from(eventMap.entries()).map(([eventId, data]) => ({
      eventId,
      eventName: data.name,
      eventDateTime: data.dateTime,
      totalRides: data.count,
    }));

    stats.sort((a, b) => b.totalRides - a.totalRides);
    setEventStats(stats);
  };

  const applyFilters = (requests: RideRequestWithDetails[], currentFilters: FilterState) => {
    let filtered = [...requests];

    // Apply date range filter
    if (currentFilters.dateRange !== 'all') {
      const now = new Date();
      const startDate = new Date();
      
      switch (currentFilters.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter((r) => r.createdAt >= startDate);
    }

    // Apply status filter
    if (currentFilters.status !== 'all') {
      filtered = filtered.filter((r) => r.status === currentFilters.status);
    }

    // Apply event filter
    if (currentFilters.eventId) {
      filtered = filtered.filter((r) => r.eventId === currentFilters.eventId);
    }

    setFilteredRequests(filtered);
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    applyFilters(rideRequests, newFilters);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'accepted':
        return '#34C759';
      case 'picked_up':
        return '#007AFF';
      case 'completed':
        return '#8E8E93';
      case 'cancelled':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'picked_up':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const renderStatsCard = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.totalRides}</Text>
        <Text style={styles.statLabel}>Total Rides</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: '#007AFF' }]}>{stats.activeRides}</Text>
        <Text style={styles.statLabel}>Active</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: '#34C759' }]}>{stats.completedRides}</Text>
        <Text style={styles.statLabel}>Completed</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>
          {stats.averageDuration > 0 ? formatDuration(stats.averageDuration) : 'N/A'}
        </Text>
        <Text style={styles.statLabel}>Avg Duration</Text>
      </View>
    </View>
  );

  const renderDDStatsSection = () => {
    if (ddStats.length === 0) return null;

    return (
      <View style={styles.ddStatsSection}>
        <TouchableOpacity
          style={styles.sectionToggle}
          onPress={() => setShowDDStats(!showDDStats)}
        >
          <Text style={styles.sectionToggleTitle}>Driver Statistics</Text>
          <Text style={styles.sectionToggleIcon}>{showDDStats ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {showDDStats && (
          <View style={styles.ddStatsContent}>
            {ddStats.slice(0, 10).map((dd) => (
              <View key={dd.ddUserId} style={styles.ddStatCard}>
                <View style={styles.ddStatHeader}>
                  <Text style={styles.ddStatName}>{dd.ddName}</Text>
                  <Text style={styles.ddStatBadge}>{dd.totalRides} rides</Text>
                </View>
                <View style={styles.ddStatDetails}>
                  <View style={styles.ddStatItem}>
                    <Text style={styles.ddStatItemLabel}>Completed:</Text>
                    <Text style={styles.ddStatItemValue}>{dd.completedRides}</Text>
                  </View>
                  {dd.averageDuration > 0 && (
                    <View style={styles.ddStatItem}>
                      <Text style={styles.ddStatItemLabel}>Avg Duration:</Text>
                      <Text style={styles.ddStatItemValue}>{formatDuration(dd.averageDuration)}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderEventStatsSection = () => {
    if (eventStats.length === 0) return null;

    return (
      <View style={styles.eventStatsSection}>
        <Text style={styles.eventStatsTitle}>Busiest Events</Text>
        {eventStats.slice(0, 5).map((event) => (
          <View key={event.eventId} style={styles.eventStatCard}>
            <View style={styles.eventStatInfo}>
              <Text style={styles.eventStatName}>{event.eventName}</Text>
              <Text style={styles.eventStatDate}>
                {event.eventDateTime.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.eventStatBadge}>
              <Text style={styles.eventStatBadgeText}>{event.totalRides}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <View style={styles.filtersContainer}>
        {/* Date Range Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Date Range</Text>
          <View style={styles.filterButtons}>
            {(['all', 'today', 'week', 'month'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.filterButton,
                  filters.dateRange === range && styles.filterButtonActive,
                ]}
                onPress={() => handleFilterChange('dateRange', range)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filters.dateRange === range && styles.filterButtonTextActive,
                  ]}
                >
                  {range === 'all' ? 'All' : range === 'today' ? 'Today' : range === 'week' ? 'Week' : 'Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Status Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.filterButtons}>
            {(['all', 'pending', 'accepted', 'picked_up', 'completed', 'cancelled'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  filters.status === status && styles.filterButtonActive,
                ]}
                onPress={() => handleFilterChange('status', status)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filters.status === status && styles.filterButtonTextActive,
                  ]}
                >
                  {getStatusLabel(status)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Event Filter */}
        {events.length > 0 && (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Event</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterButtons}>
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    filters.eventId === null && styles.filterButtonActive,
                  ]}
                  onPress={() => handleFilterChange('eventId', null)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filters.eventId === null && styles.filterButtonTextActive,
                    ]}
                  >
                    All Events
                  </Text>
                </TouchableOpacity>
                {events.slice(0, 10).map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={[
                      styles.filterButton,
                      filters.eventId === event.id && styles.filterButtonActive,
                    ]}
                    onPress={() => handleFilterChange('eventId', event.id)}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        filters.eventId === event.id && styles.filterButtonTextActive,
                      ]}
                    >
                      {event.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderRideCard = (ride: RideRequestWithDetails) => {
    const statusColor = getStatusColor(ride.status);
    const duration = ride.acceptedAt && ride.completedAt
      ? (ride.completedAt.getTime() - ride.acceptedAt.getTime()) / 60000
      : null;

    return (
      <View key={ride.id} style={styles.rideCard}>
        <View style={styles.rideHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{getStatusLabel(ride.status)}</Text>
          </View>
          <Text style={styles.rideTime}>{formatDateTime(ride.createdAt)}</Text>
        </View>

        <View style={styles.rideInfo}>
          <View style={styles.rideRow}>
            <Text style={styles.rideLabel}>Rider:</Text>
            <Text style={styles.rideValue}>{ride.riderName}</Text>
          </View>
          <View style={styles.rideRow}>
            <Text style={styles.rideLabel}>Driver:</Text>
            <Text style={styles.rideValue}>{ride.ddName}</Text>
          </View>
          <View style={styles.rideRow}>
            <Text style={styles.rideLabel}>Event:</Text>
            <Text style={styles.rideValue}>{ride.eventName}</Text>
          </View>
          <View style={styles.rideRow}>
            <Text style={styles.rideLabel}>Pickup:</Text>
            <Text style={styles.rideValue}>{ride.pickupLocationText}</Text>
          </View>
          {duration !== null && (
            <View style={styles.rideRow}>
              <Text style={styles.rideLabel}>Duration:</Text>
              <Text style={styles.rideValue}>{formatDuration(duration)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyText}>No Ride Activity</Text>
      <Text style={styles.emptySubtext}>
        {filters.dateRange !== 'all' || filters.status !== 'all' || filters.eventId
          ? 'No rides match the selected filters'
          : 'Ride activity will appear here once members start requesting rides'}
      </Text>
    </View>
  );

  if (user?.role !== 'admin') {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Admin Access Required</Text>
          <Text style={styles.emptySubtext}>This section is only available to admins</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ride Activity Log</Text>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterToggleText}>
            {showFilters ? '✕ Hide Filters' : '⚙️ Filters'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderStatsCard()}
        {renderFilters()}
        {renderDDStatsSection()}
        {renderEventStatsSection()}

        <View style={styles.logSection}>
          <Text style={styles.logTitle}>
            Ride History ({filteredRequests.length})
          </Text>
          {filteredRequests.length === 0 ? (
            renderEmptyState()
          ) : (
            filteredRequests.map(renderRideCard)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  filterToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  logSection: {
    paddingHorizontal: 16,
  },
  logTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  rideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  rideTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  rideInfo: {
    gap: 8,
  },
  rideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rideLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  rideValue: {
    fontSize: 14,
    color: '#000',
    flex: 1,
    textAlign: 'right',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  ddStatsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
  },
  sectionToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  sectionToggleIcon: {
    fontSize: 14,
    color: '#666',
  },
  ddStatsContent: {
    padding: 16,
    gap: 12,
  },
  ddStatCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
  },
  ddStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ddStatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  ddStatBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ddStatDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  ddStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ddStatItemLabel: {
    fontSize: 13,
    color: '#666',
  },
  ddStatItemValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  eventStatsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventStatsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  eventStatCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  eventStatInfo: {
    flex: 1,
  },
  eventStatName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  eventStatDate: {
    fontSize: 13,
    color: '#666',
  },
  eventStatBadge: {
    backgroundColor: '#34C759',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  eventStatBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
