export type UserRole = 'student' | 'admin';
export type ItemKind = 'found' | 'lost';
export type ItemStatus =
  | 'published'
  | 'claim_pending'
  | 'pickup_agreed'
  | 'handoff_due'
  | 'at_office'
  | 'returned';

export type ItemCategory =
  | 'electronics'
  | 'identity'
  | 'keys'
  | 'bags'
  | 'clothing'
  | 'books'
  | 'bottles'
  | 'other';

export interface CampusUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  university: string;
  universityId?: string;
  campusId: string;
  /** Short-lived URL used only on authenticated profile surfaces. */
  avatarUrl?: string;
  /** Private Storage key retained so a replacement can remove the old object. */
  avatarPath?: string;
}

export interface LostFoundItem {
  id: string;
  kind: ItemKind;
  title: string;
  category: ItemCategory;
  color: string;
  description: string;
  location: string;
  foundAt: string;
  handoffDueAt?: string;
  status: ItemStatus;
  holderName: string;
  holderPhone: string;
  ownerId?: string;
  finderId?: string;
  imageUri?: string;
  privateClue?: string;
  handoffPoint?: string;
  createdAt: string;
  returnedAt?: string;
  matchScore?: number;
}

export interface Claim {
  id: string;
  itemId: string;
  claimantId: string;
  claimantName?: string;
  status: 'pending' | 'accepted' | 'declined';
  note: string;
  reviewNote?: string;
  createdAt: string;
}

export interface ReportDraft {
  kind: ItemKind;
  title: string;
  category: ItemCategory;
  color: string;
  description: string;
  location: string;
  foundAt: Date;
  imageUri?: string;
  privateClue: string;
  handoffPoint: string;
}
