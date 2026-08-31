import { Redirect } from 'expo-router';

/** Keep legacy profile links working while Account remains the single profile surface. */
export default function ProfileRedirect() {
  return <Redirect href="/account" />;
}
