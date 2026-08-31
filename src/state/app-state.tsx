import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { authorizeSignInPortal, type AuthPortal } from '@/lib/auth-access';
import { haptics } from '@/lib/haptics';
import { createHandoffDeadline, maskPhone } from '@/lib/item-utils';
import {
  CURRENT_PRIVACY_NOTICE_VERSION,
  CURRENT_TERMS_VERSION,
} from '@/lib/legal';
import {
  acceptRemoteCustody,
  completeRemoteReturn,
  createRemoteClaim,
  createRemoteReport,
  createRemoteUniversityCode,
  completeRemoteGoogleStudentOnboarding,
  fetchCampusUser,
  fetchCampusUserIfExists,
  fetchPublicItemFeed,
  fetchRemoteSnapshot,
  flagRemoteItem,
  issueRemoteHandoffCode,
  markRemoteNotificationRead,
  revealRemoteContact,
  reviewRemoteClaim,
  reviewRemoteFlag,
  type RemoteFlagReviewStatus,
  type RemoteItemFlag,
  type RemoteNotification,
} from '@/lib/strathfind-api';
import {
  buildOAuthCallbackUrl,
  consumeOAuthIntent,
  OAUTH_INTENT_STORAGE_KEY,
  persistOAuthIntent,
  type OAuthIntent,
} from '@/lib/oauth-navigation';
import { normalizeKenyanMobile } from '@/lib/phone-number';
import { isSupabaseConfigured, supabase, supabaseAuthStorage } from '@/lib/supabase';
import type {
  CampusUser,
  Claim,
  ItemStatus,
  LostFoundItem,
  ReportDraft,
  UserRole,
} from '@/lib/types';

export type PublicItem = Omit<LostFoundItem, 'holderPhone'> & {
  maskedPhone: string;
};

type StateItem = LostFoundItem & { maskedPhone?: string };

export type ActivityKind = 'report' | 'claim' | 'contact' | 'handoff' | 'status' | 'match';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  title: string;
  message: string;
  itemId?: string;
  createdAt: string;
  read: boolean;
  audienceIds: string[];
}

export interface ToastMessage {
  id: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

export interface SignInInput {
  email: string;
  password: string;
  portal: AuthPortal;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  campusId: string;
  universityCode: string;
  acceptedTerms: boolean;
}

export interface GoogleSignInInput {
  portal: AuthPortal;
  returnTo?: string | null;
}

export interface GoogleOnboardingInput {
  name: string;
  phone: string;
  campusId: string;
  universityCode: string;
  acceptedTerms: boolean;
}

export type GoogleAuthOutcome =
  | { status: 'ready'; user: CampusUser; returnTo: string | null }
  | {
      status: 'needs-onboarding';
      email: string;
      suggestedName: string;
      returnTo: string | null;
    };

export interface FinishOAuthInput {
  code?: string;
  flowId?: string;
  callbackError?: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface AppStateValue {
  mode: 'setup' | 'supabase';
  user: CampusUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loading: boolean;
  toast: ToastMessage | null;
  items: PublicItem[];
  claims: Claim[];
  activity: ActivityEntry[];
  notifications: ActivityEntry[];
  currentUserItems: PublicItem[];
  currentUserActivity: ActivityEntry[];
  revealedContactIds: string[];
  flags: RemoteItemFlag[];
  flaggedItemIds: string[];
  signIn: (input: SignInInput) => Promise<ActionResult<CampusUser>>;
  signUp: (input: SignUpInput) => Promise<ActionResult<CampusUser | null>>;
  signInWithGoogle: (input: GoogleSignInInput) => Promise<ActionResult<GoogleAuthOutcome | null>>;
  finishOAuthSignIn: (input: FinishOAuthInput) => Promise<ActionResult<GoogleAuthOutcome>>;
  completeGoogleOnboarding: (input: GoogleOnboardingInput) => Promise<ActionResult<CampusUser>>;
  signOut: () => Promise<void>;
  createReport: (draft: ReportDraft) => Promise<ActionResult<PublicItem>>;
  claimItem: (itemId: string, proof: string) => Promise<ActionResult<Claim>>;
  reviewClaim: (claimId: string, approve: boolean, note?: string) => Promise<ActionResult<Claim>>;
  revealContact: (itemId: string) => Promise<ActionResult<string>>;
  flagItem: (itemId: string, reason?: string) => Promise<ActionResult>;
  reviewFlag: (
    flagId: string,
    status: RemoteFlagReviewStatus,
    note: string,
  ) => Promise<ActionResult<RemoteItemFlag>>;
  getHandoffCode: (itemId: string) => Promise<ActionResult<string>>;
  createUniversityCode: () => Promise<ActionResult<string>>;
  updateItemStatus: (itemId: string, status: ItemStatus) => Promise<ActionResult<PublicItem>>;
  recordCustodyHandoff: (itemId: string, handoffPoint?: string, code?: string) => Promise<ActionResult<PublicItem>>;
  markNotificationRead: (activityId: string) => void;
  dismissToast: () => void;
  getItem: (itemId: string) => PublicItem | undefined;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function actionError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isGoogleAuthUser(authUser: SupabaseUser) {
  const provider = authUser.app_metadata?.provider;
  const providers = authUser.app_metadata?.providers;
  return provider === 'google' || (Array.isArray(providers) && providers.includes('google'));
}

function googleDisplayName(authUser: SupabaseUser) {
  const metadata = authUser.user_metadata ?? {};
  for (const key of ['full_name', 'name', 'display_name']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function oauthCallbackUrl() {
  if (Platform.OS === 'web') {
    const origin = globalThis.location?.origin;
    if (!origin) throw new Error('This browser origin cannot receive sign-in callbacks.');
    return buildOAuthCallbackUrl({ platform: 'web', origin });
  }
  return buildOAuthCallbackUrl({ platform: 'native', scheme: 'strathfind' });
}

function callbackValue(url: string, key: string) {
  try {
    return new URL(url).searchParams.get(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function handoffCodeFor(itemId: string) {
  const value = [...itemId].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) % 900000, 0);
  return String(100000 + value).slice(-6);
}

function toPublicItem(item: StateItem): PublicItem {
  const { holderPhone, maskedPhone, ...safeItem } = item;
  return { ...safeItem, maskedPhone: maskedPhone ?? maskPhone(holderPhone) };
}

function notificationKind(notification: RemoteNotification): ActivityKind {
  if (notification.kind.startsWith('claim_')) return 'claim';
  if (notification.kind === 'contact_revealed' || notification.kind === 'audit_contact') return 'contact';
  if (notification.kind.startsWith('handoff_') || ['admin_custody', 'audit_handoff'].includes(notification.kind)) return 'handoff';
  if (notification.kind === 'item_returned' || notification.kind === 'audit_status') return 'status';
  return 'match';
}

async function sessionMatchesUser(client: SupabaseClient, expectedUserId: string) {
  try {
    const { data, error } = await client.auth.getSession();
    return !error && data.session?.user.id === expectedUserId;
  } catch {
    return false;
  }
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<CampusUser | null>(null);
  const [rawItems, setRawItems] = useState<StateItem[]>([]);
  const [rawClaims, setRawClaims] = useState<Claim[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [revealedContactIds, setRevealedContactIds] = useState<string[]>([]);
  const [rawFlags, setRawFlags] = useState<RemoteItemFlag[]>([]);
  const [flaggedItemIds, setFlaggedItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, tone: ToastMessage['tone'] = 'info') => {
    setToast({ id: uniqueId('toast'), message, tone });
  }, []);

  const clearRemoteState = useCallback(() => {
    setUser(null);
    setRawItems([]);
    setRawClaims([]);
    setActivity([]);
    setRawFlags([]);
    setFlaggedItemIds([]);
    setRevealedContactIds([]);
  }, []);

  const loadPublicState = useCallback(async () => {
    const publicClient = supabase;
    if (!publicClient) return null;

    const publicItems = await fetchPublicItemFeed(publicClient, { limit: 100 });
    const { data, error } = await publicClient.auth.getSession();
    // Do not let an anonymous request that finishes late replace a newly
    // authenticated snapshot.
    if (error || data.session) return null;

    setUser(null);
    setRawItems(publicItems);
    setRawClaims([]);
    setActivity([]);
    setRawFlags([]);
    setFlaggedItemIds([]);
    setRevealedContactIds([]);
    return publicItems;
  }, []);

  const discardRemoteSession = useCallback(async (expectedUserId: string) => {
    if (!supabase || !(await sessionMatchesUser(supabase, expectedUserId))) return;
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // State is still cleared below so a rejected session cannot authorize this client.
    } finally {
      clearRemoteState();
    }
  }, [clearRemoteState]);

  const loadRemoteState = useCallback(async (currentUser: CampusUser) => {
    if (!supabase) return null;
    const snapshot = await fetchRemoteSnapshot(supabase, currentUser.id, currentUser.role === 'admin');
    if (!(await sessionMatchesUser(supabase, currentUser.id))) return null;
    setRawItems(snapshot.items);
    setRawClaims(snapshot.claims);
    setRawFlags(snapshot.flags);
    setFlaggedItemIds(snapshot.flaggedItemIds);
    setActivity(snapshot.notifications.map((notification) => ({
      id: notification.id,
      kind: notificationKind(notification),
      title: notification.title,
      message: notification.message,
      itemId: notification.itemId,
      createdAt: notification.createdAt,
      read: notification.read,
      audienceIds: [currentUser.id],
    })));
    return snapshot;
  }, []);

  const finalizeAuthenticatedUser = useCallback(async (
    authUser: SupabaseUser,
    intent: OAuthIntent | null,
  ): Promise<GoogleAuthOutcome> => {
    if (!supabase) throw new Error('Authentication is not configured for this build.');

    const campusUser = await fetchCampusUserIfExists(supabase, authUser);
    if (!campusUser) {
      if (!isGoogleAuthUser(authUser)) {
        await discardRemoteSession(authUser.id);
        throw new Error('Your campus profile is not available. Contact campus support.');
      }
      if (intent?.portal === 'admin') {
        await discardRemoteSession(authUser.id);
        throw new Error('This Google account is not provisioned as an administrator. Use Student sign in.');
      }

      clearRemoteState();
      return {
        status: 'needs-onboarding',
        email: authUser.email ?? '',
        suggestedName: googleDisplayName(authUser),
        returnTo: intent?.returnTo ?? null,
      };
    }

    if (intent) {
      const portalAccess = authorizeSignInPortal(campusUser.role, intent.portal);
      if (!portalAccess.ok) {
        await discardRemoteSession(campusUser.id);
        throw new Error(portalAccess.error);
      }
    }

    const snapshot = await loadRemoteState(campusUser);
    if (!snapshot || !(await sessionMatchesUser(supabase, campusUser.id))) {
      throw new Error('The authenticated session changed before sign in completed.');
    }
    setUser(campusUser);
    return { status: 'ready', user: campusUser, returnTo: intent?.returnTo ?? null };
  }, [clearRemoteState, discardRemoteSession, loadRemoteState]);

  useEffect(() => {
    let active = true;
    const remoteClient = supabase;

    async function hydrateSession() {
      let expectedUserId: string | undefined;
      try {
        if (remoteClient) {
          const { data } = await remoteClient.auth.getSession();
          if (data.session?.user) {
            expectedUserId = data.session.user.id;
            if (!(await sessionMatchesUser(remoteClient, expectedUserId))) return;
            const resolvedUser = await fetchCampusUserIfExists(remoteClient, data.session.user);
            if (!active || !(await sessionMatchesUser(remoteClient, expectedUserId))) return;
            if (!resolvedUser) {
              clearRemoteState();
              return;
            }
            const snapshot = await loadRemoteState(resolvedUser);
            if (
              snapshot
              && active
              && await sessionMatchesUser(remoteClient, expectedUserId)
            ) {
              setUser(resolvedUser);
            }
          } else if (active) {
            const { data: latest } = await remoteClient.auth.getSession();
            if (active && !latest.session) {
              clearRemoteState();
              await loadPublicState();
            }
          }
        } else if (active) clearRemoteState();
      } catch {
        if (
          active
          && remoteClient
          && expectedUserId
          && await sessionMatchesUser(remoteClient, expectedUserId)
        ) {
          clearRemoteState();
        } else if (active) {
          if (!remoteClient) setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void hydrateSession();
    const subscription = remoteClient?.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        clearRemoteState();
        // Supabase advises deferring client queries until this callback has
        // returned. The public RPC is safe to retry if hydration also ran it.
        setTimeout(() => {
          void loadPublicState().catch(() => {
            // Keep an empty signed-out state while the public feed recovers.
          });
        }, 0);
        return;
      }
      const expectedUserId = session.user.id;
      setUser((current) => (current?.id === expectedUserId ? current : null));
      setRevealedContactIds([]);
      // Supabase recommends deferring client queries until the auth callback has returned.
      setTimeout(() => {
        void sessionMatchesUser(remoteClient, expectedUserId)
          .then((matches) => {
            if (!matches) return null;
            return fetchCampusUserIfExists(remoteClient, session.user);
          })
          .then(async (resolved) => {
            if (!resolved || !active || !(await sessionMatchesUser(remoteClient, expectedUserId))) return;
            const snapshot = await loadRemoteState(resolved);
            if (
              snapshot
              && active
              && await sessionMatchesUser(remoteClient, expectedUserId)
            ) {
              setUser(resolved);
            }
          })
          .catch(async () => {
            if (active && await sessionMatchesUser(remoteClient, expectedUserId)) setUser(null);
          });
      }, 0);
    });

    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [clearRemoteState, loadPublicState, loadRemoteState]);

  useEffect(() => {
    if (!supabase) return;
    const interval = setInterval(() => {
      const refresh = user ? loadRemoteState(user) : loadPublicState();
      void refresh.catch(() => {
        // Keep the last safe snapshot while the connection recovers.
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadPublicState, loadRemoteState, user]);

  const signIn = useCallback(
    async ({ email, password, portal }: SignInInput): Promise<ActionResult<CampusUser>> => {
      if (!supabase) {
        const error = 'Accounts are unavailable until Supabase is connected.';
        showToast(error, 'warning');
        return { ok: false, error };
      }
      let establishedSessionUserId: string | null = null;
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        const error = 'Enter your email and password.';
        showToast(error, 'error');
        return { ok: false, error };
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        establishedSessionUserId = data.session?.user.id ?? null;
        if (error || !data.user) {
          if (establishedSessionUserId) await discardRemoteSession(establishedSessionUserId);
          const message = error?.message ?? 'Sign in could not be completed.';
          showToast(message, 'error');
          return { ok: false, error: message };
        }
        const signedInUser = await fetchCampusUser(supabase, data.user);
        const portalAccess = authorizeSignInPortal(signedInUser.role, portal);
        if (!portalAccess.ok) {
          await discardRemoteSession(signedInUser.id);
          const message = portalAccess.error;
          showToast(message, 'error');
          return { ok: false, error: message };
        }
        const snapshot = await loadRemoteState(signedInUser);
        if (!snapshot || !(await sessionMatchesUser(supabase, signedInUser.id))) {
          throw new Error('The authenticated session changed before sign in completed.');
        }
        setUser(signedInUser);
        await haptics.confirm();
        showToast('Welcome back.', 'success');
        return { ok: true, data: signedInUser };
      } catch {
        if (establishedSessionUserId) await discardRemoteSession(establishedSessionUserId);
        const error = 'Sign in is temporarily unavailable. Try again.';
        showToast(error, 'error');
        return { ok: false, error };
      } finally {
        setLoading(false);
      }
    },
    [discardRemoteSession, loadRemoteState, showToast],
  );

  const signUp = useCallback(
    async (input: SignUpInput): Promise<ActionResult<CampusUser | null>> => {
      if (!supabase) {
        const error = 'Accounts are unavailable until Supabase is connected.';
        showToast(error, 'warning');
        return { ok: false, error };
      }
      let establishedSessionUserId: string | null = null;
      const name = input.name.trim();
      const email = input.email.trim().toLowerCase();
      const universityCode = input.universityCode.trim().toUpperCase();
      const phoneE164 = normalizeKenyanMobile(input.phone);
      if (!input.acceptedTerms) {
        const error = 'Accept the Terms and acknowledge the Privacy Notice to continue.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (!name || !email || !input.phone.trim() || !input.campusId.trim()) {
        const error = 'Complete your student profile.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (!phoneE164) {
        const error = 'Use a Kenyan mobile number starting 01, 07, or +254.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (input.password.length < 8) {
        const error = 'Use at least 8 characters for your password.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (!universityCode) {
        const error = 'Enter your university code.';
        showToast(error, 'error');
        return { ok: false, error };
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: input.password,
          options: {
            emailRedirectTo: Linking.createURL('/auth-callback'),
            data: {
              display_name: name,
              phone_e164: phoneE164,
              student_number: input.campusId.trim(),
              university_code: universityCode,
              terms_accepted: true,
              terms_version: CURRENT_TERMS_VERSION,
              privacy_notice_acknowledged: true,
              privacy_notice_version: CURRENT_PRIVACY_NOTICE_VERSION,
            },
          },
        });
        establishedSessionUserId = data.session?.user.id ?? null;
        if (error) {
          if (establishedSessionUserId) await discardRemoteSession(establishedSessionUserId);
          showToast(error.message, 'error');
          return { ok: false, error: error.message };
        }
        const signedUpUser = data.user && data.session ? await fetchCampusUser(supabase, data.user) : null;
        if (signedUpUser) {
          if (signedUpUser.role !== 'student') {
            await discardRemoteSession(signedUpUser.id);
            const message = 'Public signup creates student accounts only.';
            showToast(message, 'error');
            return { ok: false, error: message };
          }
          const snapshot = await loadRemoteState(signedUpUser);
          if (!snapshot || !(await sessionMatchesUser(supabase, signedUpUser.id))) {
            throw new Error('The authenticated session changed before signup completed.');
          }
          setUser(signedUpUser);
        }
        await haptics.confirm();
        showToast(signedUpUser ? 'Account ready.' : 'Check your email to finish signup.', 'success');
        return { ok: true, data: signedUpUser };
      } catch {
        if (establishedSessionUserId) await discardRemoteSession(establishedSessionUserId);
        const error = 'Signup is temporarily unavailable. Try again.';
        showToast(error, 'error');
        return { ok: false, error };
      } finally {
        setLoading(false);
      }
    },
    [discardRemoteSession, loadRemoteState, showToast],
  );

  const finishOAuthSignIn = useCallback(
    async ({ code, flowId, callbackError }: FinishOAuthInput): Promise<ActionResult<GoogleAuthOutcome>> => {
      if (!supabase) {
        const error = 'Authentication is not configured for this build.';
        return { ok: false, error };
      }

      setLoading(true);
      try {
        const intent = await consumeOAuthIntent(supabaseAuthStorage);
        if (callbackError) {
          const error = 'Google sign in was not completed. Try again.';
          showToast(error, 'error');
          return { ok: false, error };
        }

        let authUser: SupabaseUser | undefined;
        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(
            code,
            flowId ? { flowId } : undefined,
          );
          if (result.error || !result.data.session) {
            const error = 'This sign-in link is invalid or has expired.';
            showToast(error, 'error');
            return { ok: false, error };
          }
          authUser = result.data.session.user;
        } else {
          const result = await supabase.auth.getSession();
          if (result.error || !result.data.session) {
            const error = 'This sign-in link is invalid or has expired.';
            showToast(error, 'error');
            return { ok: false, error };
          }
          authUser = result.data.session.user;
        }

        const outcome = await finalizeAuthenticatedUser(authUser, intent);
        await haptics.confirm();
        showToast(
          outcome.status === 'ready' ? 'Welcome back.' : 'Add your campus details to continue.',
          outcome.status === 'ready' ? 'success' : 'info',
        );
        return { ok: true, data: outcome };
      } catch (cause) {
        const error = actionError(cause, 'Google sign in is temporarily unavailable. Try again.');
        showToast(error, 'error');
        return { ok: false, error };
      } finally {
        setLoading(false);
      }
    },
    [finalizeAuthenticatedUser, showToast],
  );

  const signInWithGoogle = useCallback(
    async ({ portal, returnTo }: GoogleSignInInput): Promise<ActionResult<GoogleAuthOutcome | null>> => {
      if (!supabase) {
        const error = 'Accounts are unavailable until Supabase is connected.';
        showToast(error, 'warning');
        return { ok: false, error };
      }

      setLoading(true);
      try {
        const redirectTo = oauthCallbackUrl();
        await persistOAuthIntent(supabaseAuthStorage, portal, returnTo);
        const result = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
          },
        });
        if (result.error || !result.data.url) {
          await supabaseAuthStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);
          const error = result.error?.message ?? 'Google sign in could not be started.';
          showToast(error, 'error');
          return { ok: false, error };
        }

        if (Platform.OS === 'web') {
          await Linking.openURL(result.data.url);
          return { ok: true, data: null };
        }

        const browserResult = await WebBrowser.openAuthSessionAsync(result.data.url, redirectTo);
        if (browserResult.type !== 'success') {
          await supabaseAuthStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);
          const error = 'Google sign in was cancelled.';
          showToast(error, 'info');
          return { ok: false, error };
        }

        return finishOAuthSignIn({
          code: callbackValue(browserResult.url, 'code'),
          flowId: result.data.flowId ?? callbackValue(browserResult.url, 'sb_flow_id'),
          callbackError: callbackValue(browserResult.url, 'error_description')
            ?? callbackValue(browserResult.url, 'error'),
        });
      } catch (cause) {
        await supabaseAuthStorage.removeItem(OAUTH_INTENT_STORAGE_KEY).catch(() => undefined);
        const error = actionError(cause, 'Google sign in is temporarily unavailable. Try again.');
        showToast(error, 'error');
        return { ok: false, error };
      } finally {
        setLoading(false);
      }
    },
    [finishOAuthSignIn, showToast],
  );

  const completeGoogleOnboarding = useCallback(
    async (input: GoogleOnboardingInput): Promise<ActionResult<CampusUser>> => {
      if (!supabase) {
        const error = 'Accounts are unavailable until Supabase is connected.';
        return { ok: false, error };
      }

      const name = input.name.trim();
      const universityCode = input.universityCode.trim().toUpperCase();
      const campusId = input.campusId.trim().toUpperCase();
      const phone = normalizeKenyanMobile(input.phone);
      if (!input.acceptedTerms) {
        const error = 'Accept the Terms and acknowledge the Privacy Notice to continue.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (!name || !universityCode || !campusId || !input.phone.trim()) {
        const error = 'Complete your student profile.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (!phone) {
        const error = 'Use a Kenyan mobile number starting 01, 07, or +254.';
        showToast(error, 'error');
        return { ok: false, error };
      }

      setLoading(true);
      try {
        const sessionResult = await supabase.auth.getSession();
        const authUser = sessionResult.data.session?.user;
        if (sessionResult.error || !authUser) throw new Error('Sign in with Google again to continue.');
        if (!isGoogleAuthUser(authUser)) throw new Error('Google authentication is required.');

        await completeRemoteGoogleStudentOnboarding(supabase, {
          name,
          phone,
          campusId,
          universityCode,
          acceptedTerms: true,
          termsVersion: CURRENT_TERMS_VERSION,
          privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
        });
        const campusUser = await fetchCampusUser(supabase, authUser);
        if (campusUser.role !== 'student') {
          throw new Error('Public onboarding can create student accounts only.');
        }
        const snapshot = await loadRemoteState(campusUser);
        if (!snapshot || !(await sessionMatchesUser(supabase, campusUser.id))) {
          throw new Error('The authenticated session changed before setup completed.');
        }
        setUser(campusUser);
        await haptics.confirm();
        showToast('Student account ready.', 'success');
        return { ok: true, data: campusUser };
      } catch (cause) {
        const error = actionError(cause, 'Student setup is temporarily unavailable. Try again.');
        showToast(error, 'error');
        return { ok: false, error };
      } finally {
        setLoading(false);
      }
    },
    [loadRemoteState, showToast],
  );

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      if (supabase) await supabase.auth.signOut();
    } catch {
      // Clear local access even when the remote session cannot be reached.
    } finally {
      clearRemoteState();
      if (supabase) {
        try {
          await loadPublicState();
        } catch {
          // Signed-out state remains safe and empty until the next refresh.
        }
      }
      showToast('Signed out.', 'info');
      setLoading(false);
    }
  }, [clearRemoteState, loadPublicState, showToast]);

  const createReport = useCallback(
    async (draft: ReportDraft): Promise<ActionResult<PublicItem>> => {
      if (!user) {
        const error = 'Sign in before publishing a report.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (!draft.title.trim() || !draft.location.trim() || !draft.privateClue.trim()) {
        const error = 'Add a title, location, and private verification clue.';
        showToast(error, 'error');
        return { ok: false, error };
      }

      if (supabase) {
        try {
          const created = await createRemoteReport(supabase, user, draft);
          const snapshot = await loadRemoteState(user);
          const item = snapshot?.items.find((candidate) => candidate.id === created.itemId);
          if (!item) throw new Error('The report was published but could not be refreshed.');
          await haptics.confirm();
          showToast(created.photoWarning ?? 'Report published.', created.photoWarning ? 'warning' : 'success');
          return { ok: true, data: toPublicItem(item) };
        } catch (cause) {
          const error = actionError(cause, 'The report could not be published.');
          showToast(error, 'error');
          return { ok: false, error };
        }
      }

      const now = new Date().toISOString();
      const item: LostFoundItem = {
        id: uniqueId('item'),
        kind: draft.kind,
        title: draft.title.trim(),
        category: draft.category,
        color: draft.color.trim(),
        description: draft.description.trim(),
        location: draft.location.trim(),
        foundAt: draft.foundAt.toISOString(),
        handoffDueAt: draft.kind === 'found' ? createHandoffDeadline(draft.foundAt) : undefined,
        status: 'published',
        holderName: user.name,
        holderPhone: user.phone,
        ownerId: draft.kind === 'lost' ? user.id : undefined,
        finderId: draft.kind === 'found' ? user.id : undefined,
        imageUri: draft.imageUri,
        privateClue: draft.privateClue.trim(),
        handoffPoint: draft.kind === 'found' ? draft.handoffPoint.trim() : undefined,
        createdAt: now,
      };
      setRawItems((current) => [item, ...current]);
      setActivity((current) => [
        {
          id: uniqueId('activity'),
          kind: 'report',
          title: 'Report published',
          message: `${item.title} is now visible to verified students.`,
          itemId: item.id,
          createdAt: now,
          read: false,
          audienceIds: [user.id],
        },
        ...current,
      ]);
      await haptics.confirm();
      showToast('Report published.', 'success');
      return { ok: true, data: toPublicItem(item) };
    },
    [loadRemoteState, showToast, user],
  );

  const claimItem = useCallback(
    async (itemId: string, proof: string): Promise<ActionResult<Claim>> => {
      if (!user) {
        const error = 'Sign in to start a claim.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      const item = rawItems.find((candidate) => candidate.id === itemId);
      if (!item || item.status === 'returned') {
        const error = 'This item is no longer available to claim.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (proof.trim().length < 10) {
        const error = 'Add a specific detail only the owner would know.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      const existing = rawClaims.find(
        (claim) => claim.itemId === itemId && claim.claimantId === user.id && claim.status !== 'declined',
      );
      if (existing) return { ok: true, data: existing };

      if (supabase) {
        try {
          const createdId = await createRemoteClaim(supabase, itemId, proof);
          const snapshot = await loadRemoteState(user);
          const claim = snapshot?.claims.find((candidate) => candidate.id === createdId);
          if (!claim) throw new Error('The claim was sent but could not be refreshed.');
          await haptics.confirm();
          showToast('Claim sent securely.', 'success');
          return { ok: true, data: claim };
        } catch (cause) {
          const error = actionError(cause, 'The claim could not be submitted.');
          showToast(error, 'error');
          return { ok: false, error };
        }
      }

      const now = new Date().toISOString();
      const claim: Claim = {
        id: uniqueId('claim'),
        itemId,
        claimantId: user.id,
        claimantName: user.name,
        status: 'pending',
        note: proof.trim(),
        createdAt: now,
      };
      setRawClaims((current) => [claim, ...current]);
      setRawItems((current) =>
        current.map((candidate) =>
          candidate.id === itemId ? { ...candidate, status: 'claim_pending' } : candidate,
        ),
      );
      setActivity((current) => [
        {
          id: uniqueId('activity'),
          kind: 'claim',
          title: 'Claim sent',
          message: `Your verification for ${item.title} is ready for review.`,
          itemId,
          createdAt: now,
          read: false,
          audienceIds: [user.id, item.finderId, item.ownerId].filter(Boolean) as string[],
        },
        ...current,
      ]);
      await haptics.confirm();
      showToast('Claim sent securely.', 'success');
      return { ok: true, data: claim };
    },
    [loadRemoteState, rawClaims, rawItems, showToast, user],
  );

  const reviewClaim = useCallback(
    async (claimId: string, approve: boolean, note?: string): Promise<ActionResult<Claim>> => {
      if (!user) {
        const error = 'Sign in to review a claim.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      const claim = rawClaims.find((candidate) => candidate.id === claimId);
      const item = claim ? rawItems.find((candidate) => candidate.id === claim.itemId) : undefined;
      const canReview = Boolean(item && (user.role === 'admin' || item.finderId === user.id || item.ownerId === user.id));
      if (!claim || !item || !canReview) {
        const error = 'You do not have access to review this claim.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (claim.status !== 'pending') {
        const error = 'This claim has already been reviewed.';
        showToast(error, 'warning');
        return { ok: false, error };
      }

      if (supabase) {
        try {
          await reviewRemoteClaim(supabase, claimId, approve, note);
          const snapshot = await loadRemoteState(user);
          const reviewed = snapshot?.claims.find((candidate) => candidate.id === claimId);
          if (!reviewed) throw new Error('The reviewed claim could not be refreshed.');
          await (approve ? haptics.confirm() : haptics.warn());
          showToast(approve ? 'Claim approved.' : 'Claim declined.', approve ? 'success' : 'info');
          return { ok: true, data: reviewed };
        } catch (cause) {
          const error = actionError(cause, 'The claim could not be reviewed.');
          showToast(error, 'error');
          return { ok: false, error };
        }
      }

      const reviewed: Claim = {
        ...claim,
        status: approve ? 'accepted' : 'declined',
        reviewNote: note?.trim() || undefined,
      };
      setRawClaims((current) => current.map((candidate) => {
        if (candidate.id === claimId) return reviewed;
        if (approve && candidate.itemId === claim.itemId && candidate.status === 'pending') {
          return { ...candidate, status: 'declined', reviewNote: 'Another claim was accepted.' };
        }
        return candidate;
      }));
      const fallbackStatus: ItemStatus = item.handoffDueAt && new Date(item.handoffDueAt) <= new Date()
        ? 'handoff_due'
        : 'published';
      setRawItems((current) => current.map((candidate) => (
        candidate.id === item.id
          ? { ...candidate, status: approve ? 'pickup_agreed' : fallbackStatus }
          : candidate
      )));
      setActivity((current) => [{
        id: uniqueId('activity'),
        kind: 'claim',
        title: approve ? 'Claim approved' : 'Claim not verified',
        message: approve
          ? `Ownership details for ${item.title} were approved. Contact can now be revealed.`
          : `The claim for ${item.title} was not verified.`,
        itemId: item.id,
        createdAt: new Date().toISOString(),
        read: false,
        audienceIds: [claim.claimantId, item.finderId, item.ownerId].filter(Boolean) as string[],
      }, ...current]);
      await (approve ? haptics.confirm() : haptics.warn());
      showToast(approve ? 'Claim approved.' : 'Claim declined.', approve ? 'success' : 'info');
      return { ok: true, data: reviewed };
    },
    [loadRemoteState, rawClaims, rawItems, showToast, user],
  );

  const revealContact = useCallback(
    async (itemId: string): Promise<ActionResult<string>> => {
      if (!user) {
        const error = 'Sign in to view contact details.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      const item = rawItems.find((candidate) => candidate.id === itemId);
      if (!item) {
        const error = 'Item not found.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (supabase) {
        try {
          const phone = await revealRemoteContact(supabase, itemId);
          setRevealedContactIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
          await loadRemoteState(user);
          await haptics.press();
          return { ok: true, data: phone };
        } catch (cause) {
          const error = actionError(cause, 'Contact details could not be opened.');
          showToast(error, 'warning');
          await haptics.warn();
          return { ok: false, error };
        }
      }
      const ownsReport = item.ownerId === user.id || item.finderId === user.id;
      const hasClaim = rawClaims.some(
        (claim) => claim.itemId === itemId && claim.claimantId === user.id && claim.status === 'accepted',
      );
      if (!ownsReport && !hasClaim && user.role !== 'admin') {
        const error = 'Start a verified claim before viewing contact details.';
        showToast(error, 'warning');
        await haptics.warn();
        return { ok: false, error };
      }

      setRevealedContactIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
      setActivity((current) => [
        {
          id: uniqueId('activity'),
          kind: 'contact',
          title: 'Contact revealed',
          message: `Contact access for ${item.title} was recorded.`,
          itemId,
          createdAt: new Date().toISOString(),
          read: true,
          audienceIds: [user.id],
        },
        ...current,
      ]);
      await haptics.press();
      return { ok: true, data: item.holderPhone };
    },
    [loadRemoteState, rawClaims, rawItems, showToast, user],
  );

  const flagItem = useCallback(
    async (itemId: string, reason = 'Safety review requested'): Promise<ActionResult> => {
      if (!user) {
        const error = 'Sign in to report a listing.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      const item = rawItems.find((candidate) => candidate.id === itemId);
      if (!item) return { ok: false, error: 'Item not found.' };
      if (flaggedItemIds.includes(itemId)) return { ok: true, data: undefined };
      if (supabase) {
        try {
          await flagRemoteItem(supabase, itemId, reason);
          await loadRemoteState(user);
          showToast('Listing sent to campus staff.', 'success');
          await haptics.confirm();
          return { ok: true, data: undefined };
        } catch (cause) {
          const error = actionError(cause, 'The listing could not be sent for review.');
          showToast(error, 'error');
          return { ok: false, error };
        }
      }
      const details = reason.trim().length >= 10 ? reason.trim() : 'Safety review requested.';
      const now = new Date().toISOString();
      const flag: RemoteItemFlag = {
        id: uniqueId('flag'),
        itemId,
        reason: 'other',
        details,
        status: 'open',
        submittedBy: user.id,
        createdAt: now,
      };
      setRawFlags((current) => [flag, ...current]);
      setFlaggedItemIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
      setActivity((current) => [{
        id: uniqueId('activity'),
        kind: 'status',
        title: 'Listing sent for review',
        message: `${item.title}: ${details}`,
        itemId,
        createdAt: now,
        read: false,
        audienceIds: [user.id],
      }, ...current]);
      showToast('Listing sent to campus staff.', 'success');
      await haptics.confirm();
      return { ok: true, data: undefined };
    },
    [flaggedItemIds, loadRemoteState, rawItems, showToast, user],
  );

  const reviewFlag = useCallback(
    async (
      flagId: string,
      status: RemoteFlagReviewStatus,
      note: string,
    ): Promise<ActionResult<RemoteItemFlag>> => {
      if (!user || user.role !== 'admin') {
        const error = 'Admin access is required to review listing reports.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      const flag = rawFlags.find((candidate) => candidate.id === flagId);
      if (!flag) {
        const error = 'Listing report not found.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (flag.status !== 'open') {
        const error = 'This listing report has already been reviewed.';
        showToast(error, 'warning');
        return { ok: false, error };
      }
      if (status !== 'dismissed' && status !== 'actioned') {
        const error = 'Choose a valid moderation outcome.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      const resolutionNote = note.trim();
      if (resolutionNote.length < 3 || resolutionNote.length > 500) {
        const error = 'Add a resolution note between 3 and 500 characters.';
        showToast(error, 'error');
        return { ok: false, error };
      }

      if (supabase) {
        try {
          await reviewRemoteFlag(supabase, flagId, status, resolutionNote);
          const snapshot = await loadRemoteState(user);
          const reviewed = snapshot?.flags.find((candidate) => candidate.id === flagId);
          if (!reviewed) throw new Error('The reviewed listing report could not be refreshed.');
          await (status === 'actioned' ? haptics.confirm() : haptics.press());
          showToast(status === 'actioned' ? 'Listing report actioned.' : 'Listing report dismissed.', 'success');
          return { ok: true, data: reviewed };
        } catch (cause) {
          const error = actionError(cause, 'The listing report could not be reviewed.');
          showToast(error, 'error');
          return { ok: false, error };
        }
      }

      const now = new Date().toISOString();
      const reviewed: RemoteItemFlag = {
        ...flag,
        status,
        reviewedAt: now,
        resolutionNote,
      };
      setRawFlags((current) => current.map((candidate) => (
        candidate.id === flagId ? reviewed : candidate
      )));
      if (flag.submittedBy === user.id) {
        setFlaggedItemIds((current) => current.filter((itemId) => itemId !== flag.itemId));
      }
      setActivity((current) => [{
        id: uniqueId('activity'),
        kind: 'status',
        title: status === 'actioned' ? 'Listing report actioned' : 'Listing report dismissed',
        message: resolutionNote,
        itemId: flag.itemId,
        createdAt: now,
        read: true,
        audienceIds: [user.id, flag.submittedBy].filter(Boolean) as string[],
      }, ...current]);
      await (status === 'actioned' ? haptics.confirm() : haptics.press());
      showToast(status === 'actioned' ? 'Listing report actioned.' : 'Listing report dismissed.', 'success');
      return { ok: true, data: reviewed };
    },
    [loadRemoteState, rawFlags, showToast, user],
  );

  const getHandoffCode = useCallback(async (itemId: string): Promise<ActionResult<string>> => {
    const item = rawItems.find((candidate) => candidate.id === itemId);
    const canView = Boolean(user && item && item.finderId === user.id);
    if (!item || item.kind !== 'found' || !canView) {
      return { ok: false, error: 'Handoff codes are available only to the finder.' };
    }
    if (supabase) {
      try {
        return { ok: true, data: await issueRemoteHandoffCode(supabase, itemId) };
      } catch (cause) {
        const error = actionError(cause, 'A handoff code could not be created.');
        showToast(error, 'error');
        return { ok: false, error };
      }
    }
    return { ok: true, data: handoffCodeFor(itemId) };
  }, [rawItems, showToast, user]);

  const updateItemStatus = useCallback(
    async (itemId: string, status: ItemStatus): Promise<ActionResult<PublicItem>> => {
      const item = rawItems.find((candidate) => candidate.id === itemId);
      if (!item) return { ok: false, error: 'Item not found.' };
      const acceptedClaim = rawClaims.find(
        (claim) => claim.itemId === itemId && claim.status === 'accepted',
      );
      if (!user || status !== 'returned') {
        const error = 'Use the claim and custody workflows to change this status.';
        showToast(error, 'warning');
        return { ok: false, error };
      }
      if (!acceptedClaim) {
        const error = 'Approve an ownership claim before completing the return.';
        showToast(error, 'warning');
        return { ok: false, error };
      }
      const isReporter = item.finderId === user.id || item.ownerId === user.id;
      if (user.role !== 'admin' && (!isReporter || item.status === 'at_office')) {
        const error = item.status === 'at_office'
          ? 'Campus staff must confirm a return from Lost & Found.'
          : 'Only the report holder or campus staff can complete this return.';
        showToast(error, 'warning');
        return { ok: false, error };
      }
      if (supabase) {
        try {
          await completeRemoteReturn(supabase, acceptedClaim.id);
          const snapshot = await loadRemoteState(user);
          const updated = snapshot?.items.find((candidate) => candidate.id === itemId);
          if (!updated) throw new Error('The returned item could not be refreshed.');
          await haptics.confirm();
          showToast('Return completed.', 'success');
          return { ok: true, data: toPublicItem(updated) };
        } catch (cause) {
          const error = actionError(cause, 'The return could not be completed.');
          showToast(error, 'error');
          return { ok: false, error };
        }
      }
      const updated = { ...item, status };
      setRawItems((current) =>
        current.map((candidate) => (candidate.id === itemId ? updated : candidate)),
      );
      setActivity((current) => [
        {
          id: uniqueId('activity'),
          kind: 'status',
          title: 'Status updated',
          message: `${item.title} is now ${status.replaceAll('_', ' ')}.`,
          itemId,
          createdAt: new Date().toISOString(),
          read: false,
          audienceIds: [user.id, item.finderId, item.ownerId].filter(Boolean) as string[],
        },
        ...current,
      ]);
      await haptics.confirm();
      showToast('Status updated.', 'success');
      return { ok: true, data: toPublicItem(updated) };
    },
    [loadRemoteState, rawClaims, rawItems, showToast, user],
  );

  const recordCustodyHandoff = useCallback(
    async (itemId: string, handoffPoint?: string, code?: string): Promise<ActionResult<PublicItem>> => {
      if (!user || user.role !== 'admin') {
        const error = 'Campus staff must confirm physical intake.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      const item = rawItems.find((candidate) => candidate.id === itemId);
      if (!item || item.kind !== 'found') {
        const error = 'Only found items can be handed to lost and found.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      if (supabase) {
        try {
          await acceptRemoteCustody(
            supabase,
            itemId,
            handoffPoint?.trim() || item.handoffPoint || 'Lost and Found desk',
            code?.trim() ?? '',
          );
          const snapshot = await loadRemoteState(user);
          const updated = snapshot?.items.find((candidate) => candidate.id === itemId);
          if (!updated) throw new Error('The custody record could not be refreshed.');
          await haptics.confirm();
          showToast('Custody handoff recorded.', 'success');
          return { ok: true, data: toPublicItem(updated) };
        } catch (cause) {
          const error = actionError(cause, 'Custody could not be recorded.');
          showToast(error, 'error');
          return { ok: false, error };
        }
      }
      if (code?.trim() !== handoffCodeFor(itemId)) {
        const error = 'That handoff code does not match this item.';
        showToast(error, 'error');
        return { ok: false, error };
      }
      const updated: LostFoundItem = {
        ...item,
        status: 'at_office',
        handoffPoint: handoffPoint?.trim() || item.handoffPoint || 'Lost and found desk',
        holderName: user.name,
        holderPhone: user.phone,
      };
      setRawItems((current) =>
        current.map((candidate) => (candidate.id === itemId ? updated : candidate)),
      );
      setActivity((current) => [
        {
          id: uniqueId('activity'),
          kind: 'handoff',
          title: 'Handoff recorded',
          message: `${item.title} is now at ${updated.handoffPoint}.`,
          itemId,
          createdAt: new Date().toISOString(),
          read: false,
          audienceIds: [user.id, item.finderId, item.ownerId].filter(Boolean) as string[],
        },
        ...current,
      ]);
      await haptics.confirm();
      showToast('Custody handoff recorded.', 'success');
      return { ok: true, data: toPublicItem(updated) };
    },
    [loadRemoteState, rawItems, showToast, user],
  );

  const markNotificationRead = useCallback((activityId: string) => {
    setActivity((current) =>
      current.map((entry) => (entry.id === activityId ? { ...entry, read: true } : entry)),
    );
    if (supabase) {
      void markRemoteNotificationRead(supabase, activityId).catch(() => {
        // The local read state remains useful; the next refresh can retry from server state.
      });
    }
  }, []);

  const createUniversityCode = useCallback(async (): Promise<ActionResult<string>> => {
    if (!user || user.role !== 'admin') {
      const error = 'Admin access is required to issue university codes.';
      showToast(error, 'error');
      return { ok: false, error };
    }
    if (supabase) {
      try {
        const code = await createRemoteUniversityCode(supabase);
        await haptics.confirm();
        showToast('University code created.', 'success');
        return { ok: true, data: code };
      } catch (cause) {
        const error = actionError(cause, 'A university code could not be created.');
        showToast(error, 'error');
        return { ok: false, error };
      }
    }
    const error = 'University codes are unavailable until Supabase is connected.';
    showToast(error, 'warning');
    return { ok: false, error };
  }, [showToast, user]);

  const items = useMemo(() => rawItems.map(toPublicItem), [rawItems]);
  const currentUserItems = useMemo(
    () =>
      user
        ? items.filter((item) => item.ownerId === user.id || item.finderId === user.id)
        : [],
    [items, user],
  );
  const currentUserActivity = useMemo(
    () =>
      user
        ? user.role === 'admin'
          ? activity
          : activity.filter((entry) => entry.audienceIds.includes(user.id))
        : [],
    [activity, user],
  );
  const claims = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return rawClaims;
    const managedItemIds = new Set(
      rawItems
        .filter((item) => item.ownerId === user.id || item.finderId === user.id)
        .map((item) => item.id),
    );
    return rawClaims.filter(
      (claim) => claim.claimantId === user.id || managedItemIds.has(claim.itemId),
    );
  }, [rawClaims, rawItems, user]);
  const flags = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return rawFlags;
    const managedItemIds = new Set(
      rawItems
        .filter((item) => item.ownerId === user.id || item.finderId === user.id)
        .map((item) => item.id),
    );
    return rawFlags
      .filter((flag) => flag.submittedBy === user.id || managedItemIds.has(flag.itemId))
      .map((flag) => (
        flag.submittedBy === user.id ? flag : { ...flag, submittedBy: undefined }
      ));
  }, [rawFlags, rawItems, user]);
  const notifications = useMemo(
    () => currentUserActivity.filter((entry) => !entry.read),
    [currentUserActivity],
  );
  const getItem = useCallback(
    (itemId: string) => items.find((item) => item.id === itemId),
    [items],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      mode: isSupabaseConfigured ? 'supabase' : 'setup',
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      loading,
      toast,
      items,
      claims,
      activity: currentUserActivity,
      notifications,
      currentUserItems,
      currentUserActivity,
      revealedContactIds,
      flags,
      flaggedItemIds,
      signIn,
      signUp,
      signInWithGoogle,
      finishOAuthSignIn,
      completeGoogleOnboarding,
      signOut,
      createReport,
      claimItem,
      reviewClaim,
      revealContact,
      flagItem,
      reviewFlag,
      getHandoffCode,
      createUniversityCode,
      updateItemStatus,
      recordCustodyHandoff,
      markNotificationRead,
      dismissToast: () => setToast(null),
      getItem,
    }),
    [
      claimItem,
      claims,
      completeGoogleOnboarding,
      createUniversityCode,
      createReport,
      currentUserActivity,
      currentUserItems,
      flagItem,
      flags,
      flaggedItemIds,
      finishOAuthSignIn,
      getItem,
      getHandoffCode,
      items,
      loading,
      markNotificationRead,
      notifications,
      recordCustodyHandoff,
      reviewClaim,
      reviewFlag,
      revealContact,
      revealedContactIds,
      signIn,
      signInWithGoogle,
      signOut,
      signUp,
      toast,
      updateItemStatus,
      user,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider.');
  return context;
}
