import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme';
import EventsListScreen from './EventsListScreen';
import EventDetailScreen from './EventDetailScreen';
import CreateEventScreen from './CreateEventScreen';
import DDsListScreen from './DDsListScreen';
import DDDetailScreen from './DDDetailScreen';
import AdminDashboardScreen from './AdminDashboardScreen';
import AdminRideLogScreen from './AdminRideLogScreen';
import ProfileScreen from './ProfileScreen';
import SEPReactionScreen from './onboarding/SEPReactionScreen';
import SEPPhraseScreen from './onboarding/SEPPhraseScreen';
import SEPSelfieScreen from './onboarding/SEPSelfieScreen';
import SEPResultScreen from './onboarding/SEPResultScreen';
import DDActiveSessionScreen from './DDActiveSessionScreen';
import DDRideQueueScreen from './DDRideQueueScreen';
import RideStatusScreen from './RideStatusScreen';
import RidesScreen from './RidesScreen';

const Tab = createBottomTabNavigator();
const EventsStack = createStackNavigator();
const DDsStack = createStackNavigator();
const RidesStack = createStackNavigator();
const AdminStack = createStackNavigator();
const ProfileStack = createStackNavigator();

// Stack navigator for Events tab
function EventsStackNavigator() {
  return (
    <EventsStack.Navigator>
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
    <DDsStack.Navigator>
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
    <RidesStack.Navigator>
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
    <AdminStack.Navigator>
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
    </AdminStack.Navigator>
  );
}

// Stack navigator for Profile tab
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen 
        name="ProfileMain" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </ProfileStack.Navigator>
  );
}

export default function MainAppScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background.primary,
        },
        tabBarActiveTintColor: theme.colors.primary.main,
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
