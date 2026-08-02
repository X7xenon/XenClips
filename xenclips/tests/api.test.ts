import { describe, it, expect, vi } from 'vitest';
import { api } from '../src/lib/api';

// Mock fetch
global.fetch = vi.fn();

describe('api.ts', () => {
  it('submits a job correctly and formats payload', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ job_id: '123' })
    });

    const result = await api.process({
      url: 'https://youtube.com/watch?v=123',
      layouts: ['full_vertical'],
      templates: ['mrbeast'],
      position: 'bottom',
      num_clips: 3,
      clip_vibe: 'funny',
      hook_vibe: 'funny'
    });

    expect(result.job_id).toBe('123');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/process', expect.any(Object));
    
    // Check if body is valid JSON
    const fetchArgs = (global.fetch as any).mock.calls[0];
    const requestInit = fetchArgs[1];
    const bodyObj = JSON.parse(requestInit.body);
    expect(bodyObj.url).toBe('https://youtube.com/watch?v=123');
    expect(bodyObj.clip_vibe).toBe('funny');
  });
});
