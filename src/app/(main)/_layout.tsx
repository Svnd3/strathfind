import { Tabs } from 'expo-router';
import { CircleUserRound, House, PackageCheck, Search } from 'lucide-react-native';
import { Platform, useWindowDimensions } from 'react-native';

import { palette, radius, raisedShadow, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';

const icons = {
  index: House,
  lost: Search,
  found: PackageCheck,
  account: CircleUserRound,
};

export default function MainLayout() {
  const { width } = useWindowDimensions();
  const desktop = width >= 960;

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          void haptics.select();
        },
      }}
      screenOptions={({ route }) => {
        const Icon = icons[route.name as keyof typeof icons] ?? House;
        return {
          animation: 'fade',
          headerShown: false,
          sceneStyle: { backgroundColor: palette.canvas },
          tabBarActiveBackgroundColor: desktop ? palette.wineSoft : 'transparent',
          tabBarActiveTintColor: palette.wine,
          tabBarAllowFontScaling: true,
          tabBarHideOnKeyboard: true,
          tabBarInactiveTintColor: palette.muted,
          tabBarLabelPosition: desktop ? 'beside-icon' : 'below-icon',
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: desktop ? 0 : -0.1,
          },
          tabBarPosition: desktop ? 'left' : 'bottom',
          tabBarVariant: desktop ? 'material' : 'uikit',
          tabBarStyle: desktop
            ? {
                width: 224,
                minWidth: 224,
                maxWidth: 224,
                paddingHorizontal: spacing.sm,
                paddingTop: spacing.lg,
                paddingBottom: spacing.lg,
                backgroundColor: palette.surfaceStrong,
                borderRightColor: palette.lineSoft,
                borderRightWidth: 1,
              }
            : {
                height: Platform.OS === 'web' ? 76 : 86,
                paddingTop: spacing.xs,
                paddingBottom: Platform.OS === 'web' ? spacing.xs : spacing.md,
                backgroundColor: palette.surfaceStrong,
                borderTopColor: palette.lineSoft,
                borderTopWidth: 1,
                ...raisedShadow('sm'),
              },
          tabBarItemStyle: desktop
            ? {
                maxHeight: 58,
                marginBottom: spacing.xs,
                borderRadius: radius.md,
              }
            : { borderRadius: radius.md },
          tabBarIcon: ({ color, focused }) => (
            <Icon
              color={color}
              fill={focused && route.name === 'found' ? color : 'none'}
              size={22}
              strokeWidth={2.2}
            />
          ),
        };
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="lost" options={{ title: 'Lost' }} />
      <Tabs.Screen name="found" options={{ title: 'Found' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
