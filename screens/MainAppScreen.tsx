import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { theme } from '../theme';
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

// Notification Bell Button Component
function NotificationBellButton({ navigation }: any) {
  const { getBadgeCount } = useNotifications();
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    // Update badge count periodically
    const updateBadge = async () => {
      const count = await getBadgeCount();
      setBadgeCount(count);
    };

    updateBadge();
    const interval = setInterval(updateBadge, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [getBadgeCount]);

  return (
    <TouchableOpacity
      style={headerStyles.bellButton}
      onPress={() => navigation.navigate('NotificationCenter')}
      activeOpacity={0.7}
    >
      <Text style={headerStyles.bellIcon}>🔔</Text>
      {badgeCount > 0 && (
        <View style={headerStyles.badge}>
          <Text style={headerStyles.badgeText}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const headerStyles = StyleSheet.create({
  bellButton: {
    marginRight: 16,
    position: 'relative',
  },
  bellIcon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.functional.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: theme.colors.text.primary,
    fontSize: 10,
    fontWeight: '700',
  },
});

// Stack navigator for Events tab
function EventsStackNavigator() {
  return (
    <EventsStack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerRight: () => <NotificationBellButton navigation={navigation} />,
      })}
    >
      <EventsStack.Screen 
        name="EventsList" 
        component={EventsListScreen}
        options={{ title: 'Events' }}
      />
      <EventsStack.Screen 
        name="EventDetail" 
        component={EventDetailScreen}
        options={{ title: 'Event Details' }}
      />
      <EventsStack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen}
        options={{ title: 'Create Event' }}
      />
      <EventsStack.Screen 
        name="NotificationCenter" 
        component={NotificationCenterScreen}
        options={{ 
          title: 'Notifications',
          headerRight: undefined,
        }}
      />
      <EventsStack.Screen 
        name="SEPReaction" 
        component={SEPReactionScreen}
        options={{ title: 'Reaction Time Test' }}
      />
      <EventsStack.Screen 
        name="SEPPhrase" 
        component={SEPPhraseScreen}
        options={{ title: 'Phrase Recording' }}
      />
      <EventsStack.Screen 
        name="SEPSelfie" 
        component={SEPSelfieScreen}
        options={{ title: 'Selfie Capture' }}
      />
      <EventsStack.Screen 
        name="SEPResult" 
        component={SEPResultScreen}
        options={{ 
          title: 'SEP Results',
          headerLeft: () => null,
          gestureEnabled: false,
        }}
      />
      <EventsStack.Screen 
        name="DDActiveSession" 
        component={DDActiveSessionScreen}
        options={{ title: 'Active DD Session' }}
      />
      <EventsStack.Screen 
        name="DDRideQueue" 
        component={DDRideQueueScreen}
        options={{ title: 'Ride Queue' }}
      />
      <EventsStack.Screen 
        name="RideStatus" 
        component={RideStatusScreen}
        options={{ title: 'Ride Status' }}
      />
    </EventsStack.Navigator>
  );
}

// Stack navigator for DDs tab
function DDsStackNavigator() {
  return (
    <DDsStack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerRight: () => <NotificationBellButton navigation={navigation} />,
      })}
    >
      <DDsStack.Screen 
        name="DDsList" 
        component={DDsListScreen}
        options={{ title: 'Active DDs' }}
      />
      <DDsStack.Screen 
        name="DDDetail" 
        component={DDDetailScreen}
        options={{ title: 'DD Details' }}
      />
      <DDsStack.Screen 
        name="NotificationCenter" 
        component={NotificationCenterScreen}
        options={{ 
          title: 'Notifications',
          headerRight: undefined,
        }}
      />
      <DDsStack.Screen 
        name="RideStatus" 
        component={RideStatusScreen}
        options={{ title: 'Ride Status' }}
      />
    </DDsStack.Navigator>
  );
}

// Stack navigator for Rides tab
function RidesStackNavigator() {
  return (
    <RidesStack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerRight: () => <NotificationBellButton navigation={navigation} />,
      })}
    >
      <RidesStack.Screen 
        name="RidesMain" 
        component={RidesScreen}
        options={{ title: 'Rides' }}
      />
      <RidesStack.Screen 
        name="DDRideQueue" 
        component={DDRideQueueScreen}
        options={{ title: 'Ride Queue' }}
      />
      <RidesStack.Screen 
        name="NotificationCenter" 
        component={NotificationCenterScreen}
        options={{ 
          title: 'Notifications',
          headerRight: undefined,
        }}
      />
      <RidesStack.Screen 
        name="RideStatus" 
        component={RideStatusScreen}
        options={{ title: 'Ride Status' }}
      />
      <RidesStack.Screen 
        name="EventDetail" 
        component={EventDetailScreen}
        options={{ title: 'Event Details' }}
      />
    </RidesStack.Navigator>
  );
}

// Stack navigator for Admin tab
function AdminStackNavigator() {
  return (
    <AdminStack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerRight: () => <NotificationBellButton navigation={navigation} />,
      })}
    >
      <AdminStack.Screen 
        name="AdminDashboard" 
        component={AdminDashboardScreen}
        options={{ title: 'Admin' }}
      />
      <AdminStack.Screen 
        name="AdminRideLog" 
        component={AdminRideLogScreen}
        options={{ title: 'Ride Activity Log' }}
      />
      <AdminStack.Screen 
        name="NotificationCenter" 
        component={NotificationCenterScreen}
        options={{ 
          title: 'Notifications',
          headerRight: undefined,
        }}
      />
    </AdminStack.Navigator>
  );
}

// Stack navigator for Profile tab
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerRight: () => <NotificationBellButton navigation={navigation} />,
      })}
    >
      <ProfileStack.Screen 
        name="ProfileMain" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <ProfileStack.Screen 
        name="NotificationPreferences" 
        component={NotificationPreferencesScreen}
        options={{ title: 'Notification Settings' }}
      />
      <ProfileStack.Screen 
        name="NotificationCenter" 
        component={NotificationCenterScreen}
        options={{ 
          title: 'Notifications',
          headerRight: undefined,
        }}
      />
    </ProfileStack.Navigator>
  );
}

// Tab Navigator component
function TabNavigator() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background.primary,
          borderTopColor: theme.colors.border.default,
        },
        tabBarActiveTintColor: theme.colors.primary.light,
        tabBarInactiveTintColor: theme.colors.state.inactive,
      }}
    >
      <Tab.Screen 
        name="Events" 
        component={EventsStackNavigator}
        options={{
          tabBarLabel: 'Events',
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
        }}
      />
      <Tab.Screen 
        name="DDs" 
        component={DDsStackNavigator}
        options={{
          tabBarLabel: 'Find DDs',
          tabBarIcon: ({ color }) => <TabIcon name="search" color={color} />,
        }}
      />
      <Tab.Screen 
        name="Rides" 
        component={RidesStackNavigator}
        options={{
          tabBarLabel: 'Rides',
          tabBarIcon: ({ color }) => <TabIcon name="car" color={color} />,
        }}
      />
      {isAdmin && (
        <Tab.Screen 
          name="Admin" 
          component={AdminStackNavigator}
          options={{
            tabBarLabel: 'Admin',
            tabBarIcon: ({ color }) => <TabIcon name="shield" color={color} />,
          }}
        />
      )}
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="person" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Main App Screen with Stack Navigator for modals
export default function MainAppScreen() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen 
        name="MainTabs" 
        component={TabNavigator}
      />
      <MainStack.Screen 
        name="DDUpgrade" 
        component={DDUpgradeNavigator}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </MainStack.Navigator>
  );
}

// Simple icon component using text emojis for MVP
// In production, you'd use @expo/vector-icons or similar
function TabIcon({ name, color }: { name: string; color: string }) {
  const icons: { [key: string]: string } = {
    calendar: '📅',
    car: '🚗',
    search: '🔍',
    shield: '🛡️',
    person: '👤',
  };

  return (
    <Text style={{ fontSize: 24, color }}>
      {icons[name] || '•'}
    </Text>
  );
}
