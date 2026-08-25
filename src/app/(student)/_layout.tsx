import { Redirect, Slot, usePathname } from 'expo-router';

import { RouteLoadingScreen } from '@/components/strathfind';
import { useAppState } from '@/state';

export default function StudentLayout() {
  const { loading, role } = useAppState();
  const pathname = usePathname();

  if (loading) return <RouteLoadingScreen />;
  if (role === 'admin') return <Redirect href="/admin" />;
  if (!role) {
    return <Redirect href={{ pathname: '/auth', params: { returnTo: pathname } }} />;
  }

  return <Slot />;
}
