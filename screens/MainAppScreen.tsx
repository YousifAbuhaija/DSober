import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { colors, spacing, typography } from '../theme';

import EventsListScreen from './EventsListScreen';
import EventDetailScreen from './EventDetailScreen';
import CreateEventScreen from './CreateEventScreen';
import DDsListScreen from './DDsListScreen';
import DDDetailScreen from './DDDetailScreen';
import AdminDashboardScreen from './AdminDashboardScreen';
import AdminRideLogScreen from './AdminRideLogScreen';
import ProfileScreen from './ProfileScreen';
import NotificationPreferencesScreen from './NotificationPreferencesScreen';
import NotificationCenterScreen from './NotificationCenterScreen';
import SEPReactionScreen from './onboarding/SEPReactionScreen';
import SEPPhraseScreen from './onboarding/SEPPhraseScreen';
import SEPSelfieScreen from './onboarding/SEPSelfieScreen';
import SEPResultScreen from './onboarding/SEPResultScreen';
import DDActiveSessionScreen from './DDActiveSessionScreen';
import DDRideQueueScreen from './DDRideQueueScreen';
import RideStatusScreen from './RideStatusScreen';
import RidesScreen from './RidesScreen';
import DDUpgradeNavigator from '../navigation/DDUpgradeNavigator';

const Tab = createBottomTabNavigator();
const MainStack = createStackNavigator();
const EventsStack = createStackNavigator();
const DDsStack = createStackNavigator();
const RidesStack = createStackNavigator();
const AdminStack = createStackNavigator();
const ProfileStack = createStackNavigator();

const HEADER_OPTIONS = {
  headerStyle: {
    backgroundColor: colors.bg.canvas,
    borderBottomWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTintColor: colors.text.primary,
  headerTitleStyle: {
    ...typography.title3,
    color: colors.text.primary,
  },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
};

function NotificationBell({ navigation }: { navigation: any }) {
  const { unreadCount } = useNotifications();

  return (
    <TouchableOpacity
      style={styles.bellButton}
      onPress={() => navigation.navigate('NotificationCenter')}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
        size={22}
        color={colors.text.primary}
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : String(unreadCount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const notifScreenOptions = ({ navigation }: { navigation: any }) => ({
  ...HEADER_OPTIONS,
  headerRight: () => <NotificationBell navigation={navigation} />,
});

function EventsStackNavigator() {
  return (
    <EventsStack.Navigator screenOptions={notifScreenOptions}>
      <EventsStack.Screen name="EventsList" component={EventsListScreen} options={{ title: 'Events' }} />
      <EventsStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
      <EventsStack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'New Event' }} />
      <EventsStack.Screen name="NotificationCenter" component={NotificationCenterScreen} options={{ title: 'Notifications', headerRight: undefined }} />
      <EventsStack.Screen name="SEPReaction" component={SEPReactionScreen} options={{ title: '', headerTransparent: true }} />
      <EventsStack.Screen name="SEPPhrase" component={SEPPhraseScreen} options={{ title: '', headerTransparent: true }} />
      <EventsStack.Screen name="SEPSelfie" component={SEPSelfieScreen} options={{ title: '', headerTransparent: true }} />
      <EventsStack.Screen name="SEPResult" component={SEPResultScreen} options={{ title: '', headerLeft: () => null, gestureEnabled: false }} />
      <EventsStack.Screen name="DDActiveSession" component={DDActiveSessionScreen} options={{ title: 'On Duty' }} />
      <EventsStack.Screen name="DDRideQueue" component={DDRideQueueScreen} options={{ title: 'Ride Queue' }} />
      <EventsStack.Screen name="RideStatus" component={RideStatusScreen} options={{ title: 'Ride Status' }} />
    </EventsStack.Navigator>
  );
}

function DDsStackNavigator() {
  return (
    <DDsStack.Navigator screenOptions={notifScreenOptions}>
      <DDsStack.Screen name="DDsList" component={DDsListScreen} options={{ title: 'Find a DD' }} />
      <DDsStack.Screen name="DDDetail" component={DDDetailScreen} options={{ title: 'Driver' }} />
      <DDsStack.Screen name="NotificationCenter" component={NotificationCenterScreen} options={{ title: 'Notifications', headerRight: undefined }} />
      <DDsStack.Screen name="RideStatus" component={RideStatusScreen} options={{ title: 'Ride Status' }} />
    </DDsStack.Navigator>
  );
}

function RidesStackNavigator() {
  return (
    <RidesStack.Navigator screenOptions={notifScreenOptions}>
      <RidesStack.Screen name="RidesMain" component={RidesScreen} options={{ title: 'Rides' }} />
      <RidesStack.Screen name="DDRideQueue" component={DDRideQueueScreen} options={{ title: 'Ride Queue' }} />
      <RidesStack.Screen name="NotificationCenter" component={NotificationCenterScreen} options={{ title: 'Notifications', headerRight: undefined }} />
      <RidesStack.Screen name="RideStatus" component={RideStatusScreen} options={{ title: 'Ride Status' }} />
      <RidesStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
    </RidesStack.Navigator>
  );
}

function AdminStackNavigator() {
  return (
    <AdminStack.Navigator screenOptions={notifScreenOptions}>
      <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin' }} />
      <AdminStack.Screen name="AdminRideLog" component={AdminRideLogScreen} options={{ title: 'Ride Log' }} />
      <AdminStack.Screen name="NotificationCenter" component={NotificationCenterScreen} options={{ title: 'Notifications', headerRight: undefined }} />
    </AdminStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={notifScreenOptions}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ title: 'Notifications' }} />
      <ProfileStack.Screen name="NotificationCenter" component={NotificationCenterScreen} options={{ title: 'Notification History', headerRight: undefined }} />
    </ProfileStack.Navigator>
  );
}

type TabIconName = keyof typeof Ionicons.glyphMap;

function TabBarIcon({
  name,
  focused,
}: {
  name: { active: TabIconName; inactive: TabIconName };
  focused: boolean;
}) {
  return (
    <Ionicons
      name={focused ? name.active : name.inactive}
      size={24}
      color={focused ? colors.text.primary : colors.text.tertiary}
    />
  );
}

function TabNavigator() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarShowLabel: true,
      }}
    >
      <Tab.Screen
        name="Events"
        component={EventsStackNavigator}
        options={{
          tabBarLabel: 'Events',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name={{ active: 'calendar', inactive: 'calendar-outline' }} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="DDs"
        component={DDsStackNavigator}
        options={{
          tabBarLabel: 'Find DD',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name={{ active: 'car', inactive: 'car-outline' }} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Rides"
        component={RidesStackNavigator}
        options={{
          tabBarLabel: 'Rides',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name={{ active: 'navigate', inactive: 'navigate-outline' }} focused={focused} />
          ),
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminStackNavigator}
          options={{
            tabBarLabel: 'Admin',
            tabBarIcon: ({ focused }) => (
              <TabBarIcon
                name={{ active: 'shield-checkmark', inactive: 'shield-checkmark-outline' }}
                focused={focused}
              />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon name={{ active: 'person', inactive: 'person-outline' }} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function MainAppScreen() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="MainTabs" component={TabNavigator} />
      <MainStack.Screen
        name="DDUpgrade"
        component={DDUpgradeNavigator}
        options={{ presentation: 'modal', headerShown: false }}
      />
    </MainStack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? 0 : spacing.sm,
    height: Platform.OS === 'ios' ? 82 : 60,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  bellButton: {
    marginRight: spacing.base,
    position: 'relative',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.ui.error,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
