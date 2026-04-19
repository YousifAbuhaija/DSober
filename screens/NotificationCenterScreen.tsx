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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { navigateFromNotification, NotificationData } from '../utils/notificationNavigation';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../theme';

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

const NOTIF_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  ride_request:        'car-outline',
  ride_accepted:       'checkmark-circle-outline',
  ride_picked_up:      'car-outline',
  ride_cancelled:      'close-circle-outline',
  sep_failure:         'warning-outline',
  dd_revoked:          'warning-outline',
  dd_session_started:  'radio-button-on-outline',
  dd_session_reminder: 'time-outline',
  dd_request_approved: 'checkmark-circle-outline',
  dd_request_rejected: 'close-circle-outline',
  event_active:        'calendar-outline',
  event_cancelled:     'calendar-outline',
  dd_assigned:         'person-outline',
};

const NOTIF_ICON_COLORS: Record<string, string> = {
  ride_request:        colors.brand.primary,
  ride_accepted:       colors.ui.success,
  ride_picked_up:      colors.ui.info,
  ride_cancelled:      colors.ui.error,
  sep_failure:         colors.ui.error,
  dd_revoked:          colors.ui.warning,
  dd_session_started:  colors.ui.success,
  dd_session_reminder: colors.ui.warning,
  dd_request_approved: colors.ui.success,
  dd_request_rejected: colors.ui.error,
  event_active:        colors.brand.primary,
  event_cancelled:     colors.ui.error,
  dd_assigned:         colors.brand.primary,
};

const isSameDay = (a: Date, b: Date) =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

const formatDateKey = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export default function NotificationCenterScreen({ navigation }: any) {
  const { user } = useAuth();
  const { refreshUnreadCount, clearBadge } = useNotifications();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchNotifications = useCallback(async (pageNum = 0, append = false) => {
    if (!user?.id) return;
    try {
      if (!append) setLoading(true); else setLoadingMore(true);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - DAYS_TO_FETCH);

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: false })
        .range(pageNum * ITEMS_PER_PAGE, (pageNum + 1) * ITEMS_PER_PAGE - 1);

      const fetched = data || [];
      if (append) {
        setNotifications((prev) => [...prev, ...fetched]);
      } else {
        setNotifications(fetched);
        const unreadIds = fetched.filter((n) => !n.read).map((n) => n.id);
        if (unreadIds.length > 0) {
          await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
          await clearBadge();
          await refreshUnreadCount();
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }
      }
      setHasMore(fetched.length === ITEMS_PER_PAGE);
      setPage(pageNum);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchNotifications(0, false); }, [fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    fetchNotifications(0, false);
  }, [fetchNotifications]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) fetchNotifications(page + 1, true);
  }, [loadingMore, hasMore, loading, page, fetchNotifications]);

  const handleTap = async (item: NotificationItem) => {
    if (!item.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', item.id);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }
    if (item.data) navigateFromNotification(item.data, navigation);
  };

  const grouped: GroupedNotifications[] = (() => {
    const map: Record<string, NotificationItem[]> = {};
    notifications.forEach((n) => {
      const key = formatDateKey(new Date(n.created_at));
      if (!map[key]) map[key] = [];
      map[key].push(n);
    });
    return Object.entries(map).map(([date, notifs]) => ({ date, notifications: notifs }));
  })();

  if (loading && !refreshing) return <LoadingScreen message="Loading notifications…" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <EmptyState icon="notifications-outline" title="No notifications" subtitle="You'll see notifications here when you receive them." />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.brand.primary} />
            </View>
          ) : null
        }
        renderItem={({ item: group }) => (
          <View>
            <View style={styles.dayHeader}>
              <Text style={styles.dayHeaderText}>{group.date}</Text>
            </View>
            {group.notifications.map((n) => {
              const iconName = NOTIF_ICONS[n.type] ?? 'notifications-outline';
              const iconColor = NOTIF_ICON_COLORS[n.type] ?? colors.brand.primary;
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.item, !n.read && styles.itemUnread]}
                  onPress={() => handleTap(n)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${iconColor}22` }]}>
                    <Ionicons name={iconName} size={20} color={iconColor} />
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{n.title}</Text>
                      <Text style={styles.itemTime}>{formatTime(n.created_at)}</Text>
                    </View>
                    <Text style={styles.itemBody} numberOfLines={2}>{n.body}</Text>
                  </View>
                  {!n.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  emptyList: { flex: 1 },
  dayHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  dayHeaderText: { ...typography.label, color: colors.text.tertiary },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.base,
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: spacing.md,
  },
  itemUnread: { backgroundColor: colors.bg.elevated },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemContent: { flex: 1 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  itemTitle: { ...typography.bodyBold, color: colors.text.primary, flex: 1 },
  itemTime: { ...typography.caption, color: colors.text.tertiary },
  itemBody: { ...typography.callout, color: colors.text.secondary, lineHeight: 20 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.primary,
    marginTop: 6,
    flexShrink: 0,
  },
  loadingMore: { paddingVertical: spacing.xl, alignItems: 'center' },
});
