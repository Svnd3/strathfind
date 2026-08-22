import { Redirect, Tabs } from 'expo-router';
import { BellRing, CircleUserRound, Plus, Search } from 'lucide-react-native';
import { Platform } from 'react-native';

import { palette, radius } from '@/constants/design';
import { RouteLoadingScreen } from '@/components/strathfind';
import { haptics } from '@/lib/haptics';
import { useAppState } from '@/state';

const icons = {
  find: Search,
  report: Plus,
  activity: BellRing,
  profile: CircleUserRound,
};

export default function StudentLayout() {
  const { loading, role } = useAppState();

  if (loading) return <RouteLoadingScreen />;
  if (role === 'admin') return <Redirect href="/admin" />;
  if (!role) return <Redirect href="/auth" />;

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          void haptics.select();
        },
      }}
      screenOptions={({ route }) => {
        const Icon = icons[route.name as keyof typeof icons] ?? Search;
        return {
          headerShown: false,
          tabBarActiveTintColor: palette.wine,
          tabBarInactiveTintColor: palette.muted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
          tabBarStyle: {
            height: Platform.OS === 'web' ? 72 : 82,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'web' ? 8 : 16,
            backgroundColor: palette.surfaceStrong,
            borderTopColor: palette.lineSoft,
            borderTopWidth: 1,
          },
          tabBarItemStyle: { borderRadius: radius.md },
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ color, focused }) => (
            <Icon color={color} fill={focused && route.name === 'report' ? color : 'none'} size={22} />
          ),
        };
      }}
    >
      <Tabs.Screen name="find" options={{ title: 'Find' }} />
      <Tabs.Screen name="report" options={{ title: 'Report' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
