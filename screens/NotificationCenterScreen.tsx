import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { navigateFromNotification, NotificationData } from '../utils/notificationNavigation';

interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: NotificationData | null;
  read: boolean;
  created_at: string;
}

interface GroupedNotifications {
  date: string;
  notifications: NotificationItem[];
}

const ITEMS_PER_PAGE = 20;
const DAYS_TO_FETCH = 30;

export default function NotificationCenterScreen({ navigation }: any) {
  const { user } = useAuth();
  const { getBadgeCount, setBadgeCount } = useNotifications();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  /**
   * Fetch notifications from database
   */
  const fetchNotifications = useCallback(async (pageNum: number = 0, append: boolean = false) => {
    if (!user?.id) return;

    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Calculate date range (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - DAYS_TO_FETCH);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .range(pageNum * ITEMS_PER_PAGE, (pageNum + 1) * ITEMS_PER_PAGE - 1);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      const fetchedNotifications = data || [];
      
      if (append) {
        setNotifications(prev => [...prev, ...fetchedNotifications]);
      } else {
        setNotifications(fetchedNotifications);
      }

      // Check if there are more notifications to load
      setHasMore(fetchedNotifications.length === ITEMS_PER_PAGE);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [user?.id]);

  /**
   * Initial load
   */
  useEffect(() => {
    fetchNotifications(0, false);
  }, [fetchNotifications]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    fetchNotifications(0, false);
  }, [fetchNotifications]);

  /**
   * Handle load more (pagination)
   */
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchNotifications(page + 1, true);
    }
  }, [loadingMore, hasMore, loading, page, fetchNotifications]);

  /**
   * Group notifications by date
   */
  const groupNotificationsByDate = useCallback((): GroupedNotifications[] => {
    const grouped: { [key: string]: NotificationItem[] } = {};

    notifications.forEach(notification => {
      const date = new Date(notification.created_at);
      const dateKey = formatDateKey(date);

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(notification);
    });

    return Object.entries(grouped).map(([date, notifs]) => ({
      date,
      notifications: notifs,
    }));
  }, [notifications]);

  /**
   * Format date key for grouping
   */
  const formatDateKey = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) {
      return 'Today';
    } else if (isSameDay(date, yesterday)) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  /**
   * Check if two dates are the same day
   */
  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  /**
   * Format time for display
   */
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  /**
   * Get icon for notification type
   */
  const getNotificationIcon = (type: string): string => {
    const icons: { [key: string]: string } = {
      ride_request: '🚗',
      ride_accepted: '✅',
      ride_picked_up: '🚙',
      ride_cancelled: '❌',
      sep_failure: '🚨',
      dd_revoked: '⚠️',
      dd_session_started: '🟢',
      dd_session_reminder: '⏰',
      dd_request_approved: '✅',
      dd_request_rejected: '❌',
      event_active: '🎉',
      event_cancelled: '❌',
      dd_assigned: '👤',
    };
    return icons[type] || '📬';
  };

  /**
   * Handle notification tap
   */
  const handleNotificationTap = async (notification: NotificationItem) => {
    try {
      // Mark as read if not already
      if (!notification.read) {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.id);

        if (error) {
          console.error('Error marking notification as read:', error);
        } else {
          // Update local state
          setNotifications(prev =>
            prev.map(n => (n.id === notification.id ? { ...n, read: true } : n))
          );

          // Decrement badge count
          const currentBadge = await getBadgeCount();
          if (currentBadge > 0) {
            await setBadgeCount(currentBadge - 1);
          }
        }
      }

      // Navigate to relevant screen
      if (notification.data) {
        navigateFromNotification(notification.data, navigation);
      }
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  };

  /**
   * Render notification item
   */
  const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.read && styles.unreadNotification,
      ]}
      onPress={() => handleNotificationTap(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationIcon}>
        <Text style={styles.iconText}>{getNotificationIcon(item.type)}</Text>
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
        </View>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {item.body}
        </Text>
        {!item.read && <View style={styles.unreadIndicator} />}
      </View>
    </TouchableOpacity>
  );

  /**
   * Render date section header
   */
  const renderSectionHeader = (date: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{date}</Text>
    </View>
  );

  /**
   * Render grouped notifications
   */
  const renderGroupedNotifications = () => {
    const grouped = groupNotificationsByDate();

    return (
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <View>
            {renderSectionHeader(item.date)}
            {item.notifications.map(notification => (
              <View key={notification.id}>
                {renderNotificationItem({ item: notification })}
              </View>
            ))}
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary.light}
            colors={[theme.colors.primary.light]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={theme.colors.primary.light} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubtext}>
                You'll see notifications here when you receive them
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : undefined}
      />
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.light} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderGroupedNotifications()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  sectionHeader: {
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: theme.colors.background.elevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  unreadNotification: {
    backgroundColor: theme.colors.background.input,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
    position: 'relative',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginRight: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
  },
  notificationBody: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  unreadIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary.light,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
