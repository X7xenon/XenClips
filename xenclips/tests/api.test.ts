import { describe, it, expect, vi } from 'vitest';
import { submitJob } from '../src/lib/api';

// Mock fetch
global.fetch = vi.fn();

describe('api.ts', () => {
  it('submits a job correctly and formats payload', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job_id: '123' })
    });

    const result = await submitJob({
      url: 'https://youtube.com/watch?v=123',
      num_clips: 3,
      clipVibe: 'funny',
      hookVibe: 'funny'
    });

    expect(result.job_id).toBe('123');
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:8000/process', expect.any(Object));
    
    // Check if body is FormData
    const fetchArgs = (global.fetch as any).mock.calls[0];
    const requestInit = fetchArgs[1];
    expect(requestInit.body).toBeInstanceOf(FormData);
    expect((requestInit.body as FormData).get('url')).toBe('https://youtube.com/watch?v=123');
    expect((requestInit.body as FormData).get('clip_vibe')).toBe('funny');
  });
});
