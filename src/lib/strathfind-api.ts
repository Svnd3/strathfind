import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';

import type {
  CampusUser,
  Claim,
  ItemCategory,
  ItemStatus,
  LostFoundItem,
  ReportDraft,
} from '@/lib/types';

const PHOTO_BUCKET = 'found-item-photos';

const categories = new Set<ItemCategory>([
  'electronics',
  'identity',
  'keys',
  'bags',
  'clothing',
  'books',
  'bottles',
  'other',
]);

export type RemoteItem = LostFoundItem & { maskedPhone: string };

export interface RemoteNotification {
  id: string;
  kind: string;
  itemId?: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export type RemoteFlagReason =
  | 'spam'
  | 'duplicate'
  | 'incorrect'
  | 'unsafe'
  | 'inappropriate'
  | 'other';

export type RemoteFlagStatus = 'open' | 'dismissed' | 'actioned';
export type RemoteFlagReviewStatus = Exclude<RemoteFlagStatus, 'open'>;

export interface RemoteItemFlag {
  id: string;
  itemId: string;
  reason: RemoteFlagReason;
  details: string;
  status: RemoteFlagStatus;
  submittedBy?: string;
  reviewedAt?: string;
  resolutionNote?: string;
  createdAt: string;
}

export interface RemoteSnapshot {
  items: RemoteItem[];
  claims: Claim[];
  notifications: RemoteNotification[];
  flags: RemoteItemFlag[];
  flaggedItemIds: string[];
}

export interface PublicFeedFilters {
  kind?: LostFoundItem['kind'];
  category?: ItemCategory;
  search?: string;
  limit?: number;
}

type UnknownRow = Record<string, unknown>;

function firstRow(value: unknown): UnknownRow | null {
  if (Array.isArray(value)) return (value[0] as UnknownRow | undefined) ?? null;
  return value && typeof value === 'object' ? (value as UnknownRow) : null;
}

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function optionalText(value: unknown) {
  const valueAsText = textValue(value).trim();
  return valueAsText || undefined;
}

function remoteFlagReason(value: unknown): RemoteFlagReason {
  switch (value) {
    case 'spam':
    case 'duplicate':
    case 'incorrect':
    case 'unsafe':
    case 'inappropriate':
      return value;
    default:
      return 'other';
  }
}

function remoteFlagStatus(value: unknown): RemoteFlagStatus {
  switch (value) {
    case 'dismissed':
    case 'actioned':
      return value;
    default:
      return 'open';
  }
}

function itemCategory(value: unknown): ItemCategory {
  const candidate = textValue(value) as ItemCategory;
  return categories.has(candidate) ? candidate : 'other';
}

export function appItemStatus(value: unknown): ItemStatus {
  switch (value) {
    case 'claim_pending':
      return 'claim_pending';
    case 'return_arranged':
      return 'pickup_agreed';
    case 'handoff_due':
      return 'handoff_due';
    case 'in_admin_custody':
      return 'at_office';
    case 'returned':
    case 'archived':
      return 'returned';
    default:
      return 'published';
  }
}

function appClaimStatus(value: unknown): Claim['status'] {
  switch (value) {
    case 'approved':
    case 'completed':
      return 'accepted';
    case 'rejected':
    case 'cancelled':
      return 'declined';
    default:
      return 'pending';
  }
}

function ensureNoError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

export async function fetchCampusUser(
  client: SupabaseClient,
  authUser: SupabaseUser,
): Promise<CampusUser> {
  const profileResult = await client.rpc('get_my_profile');
  ensureNoError(profileResult.error, 'Your campus profile could not be loaded.');
  const profile = firstRow(profileResult.data);
  if (!profile) throw new Error('Your campus profile is not available. Contact campus support.');

  const universityId = textValue(profile.university_id);
  const [universityResult, contactResult] = await Promise.all([
    client.from('universities').select('name').eq('id', universityId).maybeSingle(),
    client.from('profile_contacts').select('phone_e164').eq('profile_id', authUser.id).maybeSingle(),
  ]);
  ensureNoError(universityResult.error, 'Your university could not be loaded.');
  ensureNoError(contactResult.error, 'Your contact profile could not be loaded.');

  const metadata = authUser.user_metadata ?? {};
  return {
    id: authUser.id,
    name: textValue(profile.display_name, textValue(metadata.display_name, 'Student')),
    email: authUser.email ?? '',
    phone: textValue(contactResult.data?.phone_e164, textValue(metadata.phone_e164, authUser.phone ?? '')),
    role: profile.role === 'admin' ? 'admin' : 'student',
    university: textValue(universityResult.data?.name, 'University'),
    universityId,
    campusId: textValue(profile.student_number),
  };
}

async function signedPhotoUrls(client: SupabaseClient, rows: UnknownRow[]) {
  const paths = [...new Set(rows.map((row) => textValue(row.cover_photo_path)).filter(Boolean))];
  const urls = new Map<string, string>();
  if (!paths.length) return urls;

  const result = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  if (result.error) return urls;
  result.data.forEach((entry) => {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  });
  return urls;
}

async function verificationQuestions(client: SupabaseClient, rows: UnknownRow[]) {
  const entries = await Promise.all(rows.map(async (row) => {
    const id = textValue(row.id);
    const result = await client.rpc('get_item_verification_question', { p_item_id: id });
    return [id, result.error ? undefined : optionalText(result.data)] as const;
  }));
  return new Map(entries);
}

function remoteItem(
  row: UnknownRow,
  currentUserId: string,
  questions: Map<string, string | undefined>,
  photos: Map<string, string>,
): RemoteItem {
  const id = textValue(row.id);
  const kind = row.kind === 'lost' ? 'lost' : 'found';
  const mine = row.is_mine === true;
  const photoPath = textValue(row.cover_photo_path);
  return {
    id,
    kind,
    title: textValue(row.title, 'Campus item'),
    category: itemCategory(row.category),
    color: textValue(row.color, 'Not specified'),
    description: textValue(row.description),
    location: textValue(row.location, textValue(row.location_found)),
    foundAt: textValue(row.observed_at, textValue(row.found_at, new Date().toISOString())),
    handoffDueAt: optionalText(row.handoff_due_at),
    status: appItemStatus(row.status),
    holderName: textValue(row.contact_name, 'Verified campus contact'),
    holderPhone: '',
    maskedPhone: textValue(row.masked_phone, 'Contact protected'),
    ownerId: mine && kind === 'lost' ? currentUserId : undefined,
    finderId: mine && kind === 'found' ? currentUserId : undefined,
    imageUri: photos.get(photoPath),
    privateClue: questions.get(id),
    handoffPoint: optionalText(row.handoff_point),
    createdAt: textValue(row.created_at, new Date().toISOString()),
  };
}

function publicRemoteItem(row: UnknownRow): RemoteItem {
  return {
    id: textValue(row.id),
    kind: row.kind === 'lost' ? 'lost' : 'found',
    title: textValue(row.title, 'Campus item'),
    category: itemCategory(row.category),
    color: textValue(row.color),
    description: textValue(row.description),
    location: textValue(row.location),
    foundAt: textValue(row.observed_at, new Date().toISOString()),
    handoffDueAt: optionalText(row.handoff_due_at),
    status: appItemStatus(row.status),
    holderName: 'Contact protected',
    holderPhone: '',
    maskedPhone: 'Sign in to continue',
    handoffPoint: optionalText(row.handoff_point),
    createdAt: textValue(row.created_at, new Date().toISOString()),
  };
}

/**
 * Loads the deliberately minimal, anonymous Strathmore feed. The backing RPC
 * owns the campus/status boundary and omits identity, contact, verification,
 * claim, photo-path, and audit fields.
 */
export async function fetchPublicItemFeed(
  client: SupabaseClient,
  filters: PublicFeedFilters = {},
): Promise<RemoteItem[]> {
  const limit = Math.min(Math.max(Math.trunc(filters.limit ?? 48), 1), 100);
  const result = await client.rpc('get_public_item_cards', {
    p_kind: filters.kind ?? null,
    p_category: filters.category ?? null,
    p_search: filters.search?.trim() || null,
    p_limit: limit,
  });
  ensureNoError(result.error, 'Public campus reports could not be loaded.');

  return ((result.data ?? []) as UnknownRow[])
    .filter((row) => Boolean(textValue(row.id)))
    .map(publicRemoteItem);
}

function remoteClaim(row: UnknownRow, currentUserId: string): Claim {
  const id = textValue(row.id);
  const claimantId = optionalText(row.claimant_id)
    ?? (row.is_mine === true ? currentUserId : `private:${id}`);
  return {
    id,
    itemId: textValue(row.item_id),
    claimantId,
    claimantName: optionalText(row.claimant_label),
    status: appClaimStatus(row.status),
    note: textValue(row.proof_description, textValue(row.message)),
    reviewNote: optionalText(row.review_note),
    createdAt: textValue(row.created_at, new Date().toISOString()),
  };
}

function remoteItemFlag(row: UnknownRow): RemoteItemFlag {
  return {
    id: textValue(row.id),
    itemId: textValue(row.item_id),
    reason: remoteFlagReason(row.reason),
    details: textValue(row.details),
    status: remoteFlagStatus(row.status),
    submittedBy: optionalText(row.submitted_by),
    reviewedAt: optionalText(row.reviewed_at),
    resolutionNote: optionalText(row.resolution_note),
    createdAt: textValue(row.created_at, new Date().toISOString()),
  };
}

function rowIdentifier(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : 'unknown';
}

async function fetchPossibleMatches(client: SupabaseClient, rows: UnknownRow[]) {
  const mine = rows.filter((row) => row.is_mine === true && !['returned', 'archived'].includes(textValue(row.status)));
  const results = await Promise.all(mine.map(async (source) => {
    const sourceId = textValue(source.id);
    const result = await client.rpc('possible_item_matches', { p_item_id: sourceId, p_limit: 3 });
    if (result.error) return [];
    return ((result.data ?? []) as UnknownRow[]).map<RemoteNotification>((match) => {
      const score = typeof match.match_score === 'number' ? match.match_score : 0;
      return {
        id: `match:${sourceId}:${textValue(match.item_id)}`,
        kind: 'match_available',
        itemId: textValue(match.item_id),
        title: 'Possible match',
        message: `${textValue(match.title, 'A campus report')} shares key details${score ? ` (${score}% match)` : ''}.`,
        createdAt: textValue(match.observed_at, new Date().toISOString()),
        read: true,
      };
    });
  }));
  return results.flat();
}

async function fetchAdminAudit(client: SupabaseClient, rows: UnknownRow[]) {
  const [contacts, custody, statuses] = await Promise.all([
    client
      .from('contact_reveal_audit')
      .select('id,item_id,revealed_at')
      .order('revealed_at', { ascending: false })
      .limit(100),
    client
      .from('custody_events')
      .select('id,item_id,kind,note,created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    client
      .from('item_status_history')
      .select('id,item_id,old_status,new_status,changed_at')
      .order('changed_at', { ascending: false })
      .limit(100),
  ]);
  ensureNoError(contacts.error, 'Contact audit could not be loaded.');
  ensureNoError(custody.error, 'Custody audit could not be loaded.');
  ensureNoError(statuses.error, 'Status audit could not be loaded.');

  const titles = new Map(rows.map((row) => [textValue(row.id), textValue(row.title, 'Campus item')]));
  const contactEntries = ((contacts.data ?? []) as UnknownRow[]).map<RemoteNotification>((row) => {
    const itemId = textValue(row.item_id);
    return {
      id: `audit-contact:${rowIdentifier(row.id)}`,
      kind: 'audit_contact',
      itemId,
      title: 'Contact access recorded',
      message: `Protected contact was opened for ${titles.get(itemId) ?? 'a campus item'}.`,
      createdAt: textValue(row.revealed_at, new Date().toISOString()),
      read: true,
    };
  });
  const custodyEntries = ((custody.data ?? []) as UnknownRow[]).map<RemoteNotification>((row) => {
    const itemId = textValue(row.item_id);
    return {
      id: `audit-custody:${rowIdentifier(row.id)}`,
      kind: 'audit_handoff',
      itemId,
      title: 'Custody event',
      message: `${titles.get(itemId) ?? 'Campus item'}: ${textValue(row.kind, 'updated').replaceAll('_', ' ')}.`,
      createdAt: textValue(row.created_at, new Date().toISOString()),
      read: true,
    };
  });
  const statusEntries = ((statuses.data ?? []) as UnknownRow[]).map<RemoteNotification>((row) => {
    const itemId = textValue(row.item_id);
    return {
      id: `audit-status:${rowIdentifier(row.id)}`,
      kind: 'audit_status',
      itemId,
      title: 'Status changed',
      message: `${titles.get(itemId) ?? 'Campus item'} is now ${textValue(row.new_status, 'updated').replaceAll('_', ' ')}.`,
      createdAt: textValue(row.changed_at, new Date().toISOString()),
      read: true,
    };
  });
  return [...contactEntries, ...custodyEntries, ...statusEntries]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function fetchRemoteSnapshot(
  client: SupabaseClient,
  currentUserId: string,
  isAdmin = false,
): Promise<RemoteSnapshot> {
  const [cardsResult, claimsResult, notificationsResult, flagsResult] = await Promise.all([
    client.from('found_item_cards').select('*').order('created_at', { ascending: false }),
    client.rpc('list_visible_claims', { p_item_id: null }),
    client
      .from('notifications')
      .select('id,kind,item_id,title,body,read_at,created_at')
      .order('created_at', { ascending: false }),
    client.rpc('list_visible_item_flags', { p_item_id: null }),
  ]);

  ensureNoError(cardsResult.error, 'Campus reports could not be loaded.');
  ensureNoError(claimsResult.error, 'Claims could not be loaded.');
  ensureNoError(notificationsResult.error, 'Notifications could not be loaded.');
  ensureNoError(flagsResult.error, 'Listing reports could not be loaded.');

  const cardRows = (cardsResult.data ?? []) as UnknownRow[];
  const [photos, questions] = await Promise.all([
    signedPhotoUrls(client, cardRows),
    verificationQuestions(client, cardRows),
  ]);
  const [matches, audit] = await Promise.all([
    fetchPossibleMatches(client, cardRows),
    isAdmin ? fetchAdminAudit(client, cardRows) : Promise.resolve([]),
  ]);
  const flags = ((flagsResult.data ?? []) as UnknownRow[])
    .filter((row) => Boolean(textValue(row.id) && textValue(row.item_id)))
    .map(remoteItemFlag);

  return {
    items: cardRows.map((row) => remoteItem(row, currentUserId, questions, photos)),
    claims: ((claimsResult.data ?? []) as UnknownRow[]).map((row) => remoteClaim(row, currentUserId)),
    notifications: [
      ...((notificationsResult.data ?? []) as UnknownRow[]).map((row) => ({
        id: textValue(row.id),
        kind: textValue(row.kind),
        itemId: optionalText(row.item_id),
        title: textValue(row.title),
        message: textValue(row.body),
        createdAt: textValue(row.created_at, new Date().toISOString()),
        read: Boolean(row.read_at),
      })),
      ...matches,
      ...audit,
    ],
    flags,
    flaggedItemIds: [...new Set(
      flags
        .filter((flag) => flag.status === 'open' && flag.submittedBy === currentUserId)
        .map((flag) => flag.itemId),
    )],
  };
}

function imageMimeType(uri: string, header: string | null) {
  const normalizedHeader = header?.split(';')[0]?.toLowerCase();
  if (normalizedHeader && ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(normalizedHeader)) {
    return normalizedHeader;
  }
  const cleanUri = uri.toLowerCase().split('?')[0];
  if (cleanUri.endsWith('.png')) return 'image/png';
  if (cleanUri.endsWith('.webp')) return 'image/webp';
  if (cleanUri.endsWith('.heic') || cleanUri.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function imageExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

async function uploadReportPhoto(
  client: SupabaseClient,
  user: CampusUser,
  itemId: string,
  uri: string,
) {
  if (!user.universityId) throw new Error('Your university profile is missing.');
  const response = await fetch(uri);
  if (!response.ok) throw new Error('The selected photo could not be read.');
  const mimeType = imageMimeType(uri, response.headers.get('content-type'));
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${imageExtension(mimeType)}`;
  // Keep storage keys opaque with respect to the uploader. Authorization is
  // derived from the item and authenticated profile in database policies.
  const path = `${user.universityId}/items/${itemId}/${filename}`;
  const upload = await client.storage.from(PHOTO_BUCKET).upload(path, await response.arrayBuffer(), {
    cacheControl: '3600',
    contentType: mimeType,
    upsert: false,
  });
  ensureNoError(upload.error, 'The photo could not be uploaded.');

  const metadata = await client.from('found_item_photos').insert({
    item_id: itemId,
    storage_path: path,
    mime_type: mimeType,
    sort_order: 0,
  });
  if (metadata.error) {
    await client.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error(metadata.error.message || 'The photo could not be attached.');
  }
}

export async function createRemoteReport(
  client: SupabaseClient,
  user: CampusUser,
  draft: ReportDraft,
) {
  const result = await client.rpc('create_item_report', {
    p_kind: draft.kind,
    p_title: draft.title.trim(),
    p_description: draft.description.trim(),
    p_category: draft.category,
    p_color: draft.color.trim(),
    p_location: draft.location.trim(),
    p_observed_at: draft.foundAt.toISOString(),
    p_ownership_question: draft.privateClue.trim(),
    p_handoff_point: draft.kind === 'found' ? draft.handoffPoint.trim() || null : null,
  });
  ensureNoError(result.error, 'The report could not be published.');
  const itemId = textValue(result.data);
  if (!itemId) throw new Error('The report was created without an item ID.');

  let photoWarning: string | undefined;
  if (draft.imageUri) {
    try {
      await uploadReportPhoto(client, user, itemId, draft.imageUri);
    } catch {
      photoWarning = 'The report is live, but its photo could not be uploaded.';
    }
  }
  return { itemId, photoWarning };
}

export async function createRemoteClaim(client: SupabaseClient, itemId: string, proof: string) {
  const result = await client.rpc('create_item_claim', {
    p_item_id: itemId,
    p_message: 'Ownership verification submitted in StrathFind.',
    p_proof_description: proof.trim(),
  });
  ensureNoError(result.error, 'The claim could not be submitted.');
  const claimId = textValue(result.data);
  if (!claimId) throw new Error('The claim was created without an ID.');
  return claimId;
}

export async function reviewRemoteClaim(
  client: SupabaseClient,
  claimId: string,
  approve: boolean,
  note?: string,
) {
  const result = await client.rpc('review_claim', {
    p_claim_id: claimId,
    p_approve: approve,
    p_review_note: note?.trim() || null,
  });
  ensureNoError(result.error, 'The claim could not be reviewed.');
}

export async function revealRemoteContact(client: SupabaseClient, itemId: string) {
  const result = await client.rpc('reveal_item_contact', { p_item_id: itemId });
  ensureNoError(result.error, 'Contact details could not be opened.');
  const contact = firstRow(result.data);
  const phone = textValue(contact?.phone_e164);
  if (!phone) throw new Error('Contact details are unavailable.');
  return phone;
}

export async function flagRemoteItem(client: SupabaseClient, itemId: string, details: string) {
  const result = await client.rpc('submit_item_flag', {
    p_item_id: itemId,
    p_reason: 'other',
    p_details: details.trim().length >= 10 ? details.trim() : 'Safety review requested.',
  });
  ensureNoError(result.error, 'The listing could not be sent for review.');
}

export async function reviewRemoteFlag(
  client: SupabaseClient,
  flagId: string,
  status: RemoteFlagReviewStatus,
  note: string,
) {
  const result = await client.rpc('review_item_flag', {
    p_flag_id: flagId,
    p_status: status,
    p_resolution_note: note.trim(),
  });
  ensureNoError(result.error, 'The listing report could not be reviewed.');
}

export async function issueRemoteHandoffCode(client: SupabaseClient, itemId: string) {
  const result = await client.rpc('issue_item_handoff_code', { p_item_id: itemId });
  ensureNoError(result.error, 'A handoff code could not be created.');
  const code = textValue(result.data);
  if (!/^\d{6}$/.test(code)) throw new Error('The handoff code was not returned.');
  return code;
}

export async function acceptRemoteCustody(
  client: SupabaseClient,
  itemId: string,
  storageReference: string,
  code: string,
) {
  const result = await client.rpc('accept_item_into_custody', {
    p_item_id: itemId,
    p_storage_reference: storageReference,
    p_handoff_code: code,
    p_note: 'Physical intake confirmed in StrathFind.',
  });
  ensureNoError(result.error, 'Custody could not be recorded.');
  if (result.data !== true) throw new Error('That handoff code is invalid, expired, or locked.');
}

export async function completeRemoteReturn(client: SupabaseClient, claimId: string) {
  const result = await client.rpc('complete_item_return', { p_claim_id: claimId });
  ensureNoError(result.error, 'The return could not be completed.');
}

export async function markRemoteNotificationRead(client: SupabaseClient, notificationId: string) {
  const result = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  ensureNoError(result.error, 'The notification could not be updated.');
}

export async function createRemoteUniversityCode(client: SupabaseClient) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();
  const result = await client.rpc('create_university_join_code', {
    p_label: 'Student signup',
    p_expires_at: expiresAt,
    p_max_uses: 100,
  });
  ensureNoError(result.error, 'A university code could not be created.');
  const row = firstRow(result.data);
  const code = textValue(row?.join_code);
  if (!code) throw new Error('The university code was not returned.');
  return code;
}
