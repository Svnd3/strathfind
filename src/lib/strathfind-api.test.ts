import type { SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import type { CampusUser } from './types';
import {
  fetchCampusUserIfExists,
  fetchRecentReturnedItems,
  signedPhotoUrls,
  updateRemoteProfilePhoto,
} from './strathfind-api';

describe('StrathFind API mapping', () => {
  it('maps the server-owned reunion timestamp', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        id: 'returned-item',
        kind: 'found',
        title: 'Blue bottle',
        category: 'bottles',
        color: 'Blue',
        description: 'Returned safely.',
        location: 'Student Centre',
        observed_at: '2026-08-28T08:00:00.000Z',
        returned_at: '2026-08-30T10:00:00.000Z',
        status: 'returned',
        created_at: '2026-08-28T08:00:00.000Z',
      }],
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient;

    const [item] = await fetchRecentReturnedItems(client, 12);

    expect(rpc).toHaveBeenCalledWith('get_recent_returned_item_cards', { p_limit: 12 });
    expect(item.status).toBe('returned');
    expect(item.returnedAt).toBe('2026-08-30T10:00:00.000Z');
  });

  it('maps a private avatar path to its signed URL', async () => {
    const profile = {
      id: 'user-1',
      university_id: 'university-1',
      display_name: 'Amina Kamau',
      role: 'student',
      student_number: '12345',
      avatar_path: 'user-1/photo.jpg',
    };
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { name: 'Strathmore University' }, error: null })
      .mockResolvedValueOnce({ data: { phone_e164: '+254700000000' }, error: null });
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: [profile], error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://example.test/signed-avatar' },
            error: null,
          }),
        }),
      },
    } as unknown as SupabaseClient;
    const authUser = {
      id: 'user-1',
      email: 'amina@example.test',
      user_metadata: {},
    } as User;

    const user = await fetchCampusUserIfExists(client, authUser);

    expect(user?.avatarPath).toBe(profile.avatar_path);
    expect(user?.avatarUrl).toBe('https://example.test/signed-avatar');
  });

  it('does not sign returned photos for anyone except their reporter', async () => {
    const createSignedUrls = vi.fn().mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `signed:${path}` })),
      error: null,
    }));
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({ createSignedUrls }),
      },
    } as unknown as SupabaseClient;

    const urls = await signedPhotoUrls(client, [
      { cover_photo_path: 'active.jpg', status: 'listed', is_mine: false },
      {
        cover_photo_path: 'mine.jpg',
        status: 'returned',
        is_mine: true,
        returned_at: '2026-08-29T12:00:00.000Z',
      },
      {
        cover_photo_path: 'recent-return.jpg',
        status: 'returned',
        is_mine: false,
        returned_at: '2026-08-29T12:00:30.000Z',
      },
      {
        cover_photo_path: 'at-boundary.jpg',
        status: 'returned',
        is_mine: false,
        returned_at: '2026-08-29T12:00:00.000Z',
      },
    ]);

    expect(createSignedUrls).toHaveBeenCalledWith(['active.jpg', 'mine.jpg'], 3600);
    expect(urls.has('recent-return.jpg')).toBe(false);
    expect(urls.has('at-boundary.jpg')).toBe(false);
  });

  it('restores the avatar reference when Storage cannot remove the photo', async () => {
    const update = vi.fn();
    const single = vi
      .fn()
      .mockResolvedValueOnce({ data: { avatar_path: null }, error: null })
      .mockResolvedValueOnce({ data: { avatar_path: 'user-1/photo.jpg' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    update.mockReturnValue({ eq });
    const remove = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Storage delete failed' },
    });
    const client = {
      from: vi.fn().mockReturnValue({ update }),
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    } as unknown as SupabaseClient;
    const user: CampusUser = {
      id: 'user-1',
      name: 'Amina Kamau',
      email: 'amina@example.test',
      phone: '+254700000000',
      role: 'student',
      university: 'Strathmore University',
      universityId: 'university-1',
      campusId: '12345',
      avatarPath: 'user-1/photo.jpg',
    };

    await expect(updateRemoteProfilePhoto(client, user, null)).rejects.toThrow(
      'Storage delete failed',
    );

    expect(update).toHaveBeenNthCalledWith(1, { avatar_path: null });
    expect(update).toHaveBeenNthCalledWith(2, { avatar_path: user.avatarPath });
    expect(remove).toHaveBeenCalledWith([user.avatarPath]);
  });
});
