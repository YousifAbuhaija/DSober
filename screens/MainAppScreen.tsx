import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import EventsListScreen from './EventsListScreen';
import EventDetailScreen from './EventDetailScreen';
import CreateEventScreen from './CreateEventScreen';
import DDsListScreen from './DDsListScreen';
import AdminDashboardScreen from './AdminDashboardScreen';
import ProfileScreen from './ProfileScreen';
import SEPReactionScreen from './onboarding/SEPReactionScreen';
import SEPPhraseScreen from './onboarding/SEPPhraseScreen';
import SEPSelfieScreen from './onboarding/SEPSelfieScreen';
import SEPResultScreen from './onboarding/SEPResultScreen';
import DDActiveSessionScreen from './DDActiveSessionScreen';

const Tab = createBottomTabNavigator();
const EventsStack = createStackNavigator();
const DDsStack = createStackNavigator();
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
    </DDsStack.Navigator>
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
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
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
          tabBarLabel: 'DDs',
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
    shield: '🛡️',
    person: '👤',
  };

  return (
    <Text style={{ fontSize: 24, color }}>
      {icons[name] || '•'}
    </Text>
  );
}
