const mockCreateSignedUrl = jest.fn();

// Mock the supabase client so we test getDisplayUrl's URL handling without the
// native client (and so importing storage.ts doesn't pull in the RN chain).
jest.mock('../../lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
  },
}));

import { getDisplayUrl } from '../storage';

const PUBLIC_FORMAT = (bucket: string, path: string) =>
  `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}`;

beforeEach(() => {
  mockCreateSignedUrl.mockReset();
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://signed.example/token' },
    error: null,
  });
});

describe('getDisplayUrl', () => {
  it('returns null for empty input', async () => {
    expect(await getDisplayUrl(null)).toBeNull();
    expect(await getDisplayUrl(undefined)).toBeNull();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('passes through a non-storage URL unchanged', async () => {
    const url = 'https://cdn.example.com/avatar.png';
    expect(await getDisplayUrl(url)).toBe(url);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('signs a private-bucket URL and extracts the object path', async () => {
    const url = PUBLIC_FORMAT('profile-photos', 'user-a/profile.jpg');
    const result = await getDisplayUrl(url);
    expect(result).toBe('https://signed.example/token');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('user-a/profile.jpg', 3600);
  });

  it('leaves a URL from a non-private bucket untouched', async () => {
    const url = PUBLIC_FORMAT('public-assets', 'logo.png');
    expect(await getDisplayUrl(url)).toBe(url);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('caches the signed URL so repeated renders sign only once', async () => {
    const url = PUBLIC_FORMAT('license-photos', 'user-cache/license.jpg');
    const first = await getDisplayUrl(url);
    const second = await getDisplayUrl(url);
    expect(first).toBe(second);
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('returns null if signing fails', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    const url = PUBLIC_FORMAT('sep-selfies', 'user-err/selfie.jpg');
    expect(await getDisplayUrl(url)).toBeNull();
  });
});
