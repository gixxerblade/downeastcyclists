import 'fake-indexeddb/auto';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  getTrailOutbox,
  openTrailOutbox,
  saveTrailReport,
  submitQueuedTrailReport,
  updateTrailOutbox,
} from '@/src/lib/trail-maintenance/outbox';

const input = {
  issueType: 'trail_obstruction',
  observedAt: '2026-10-11T12:00:00Z',
  trailSystemSlug: 'big-branch-bike-park',
  trailSegmentSlug: 'phase-1-green-ricochet',
  locationSource: 'manual',
  locationNotes: 'At the bridge',
};
const photo = () => new File(['image bytes'], 'branch.jpg', {type: 'image/jpeg'});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

beforeEach(async () => {
  const {reports} = await getTrailOutbox();
  await reports.utils.clearObjectStore();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('durable trail report queue', () => {
  it('restores report and photo bytes from IndexedDB after closing a collection', async () => {
    const name = `trail-test-${crypto.randomUUID()}`;
    const first = await openTrailOutbox(name);
    const id = crypto.randomUUID();
    await first.reports.insert({
      id,
      input,
      photos: [photo()],
      filenames: ['branch.jpg'],
      turnstileToken: '',
      status: 'queued',
      message: 'Saved',
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: 1,
    }).isPersisted.promise;
    await first.close();
    const restored = await openTrailOutbox(name);
    expect(restored.reports.get(id)?.input).toEqual(input);
    expect(await restored.reports.get(id)?.photos[0]?.text()).toBe('image bytes');
    await restored.close();
  });
  it('does not claim a local save if persistence fails', async () => {
    const {reports} = await getTrailOutbox();
    vi.spyOn(reports, 'insert').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    await expect(saveTrailReport(input, [photo()], '')).rejects.toThrow('Quota exceeded');
    expect(reports.size).toBe(0);
  });
  it('keeps all bytes and authorization when a photo transfer fails', async () => {
    const id = await saveTrailReport(input, [photo()], 'bot-token');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          uploadToken: 'signed-token',
          publicId: 'ABC123ABC123',
          uploads: [
            {uploadUrl: 'https://uploads.example/photo', contentType: 'image/jpeg', sortOrder: 0},
          ],
        }),
      )
      .mockRejectedValueOnce(new TypeError('Network lost'));
    vi.stubGlobal('fetch', fetch);
    const {reports} = await getTrailOutbox();
    const report = reports.get(id);
    if (!report) throw new Error('Missing fixture');
    await submitQueuedTrailReport(report);
    expect(reports.get(id)).toMatchObject({
      status: 'queued',
      uploadToken: 'signed-token',
      attempts: 1,
    });
    expect(await reports.get(id)?.photos[0]?.text()).toBe('image bytes');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('uses a receipt to recover a lost success response without uploading or creating again', async () => {
    const id = await saveTrailReport(input, [photo()], '');
    await updateTrailOutbox(id, {uploadToken: 'signed-token'});
    const fetch = vi.fn().mockResolvedValue(json({submitted: true, publicId: 'ABC123ABC123'}));
    vi.stubGlobal('fetch', fetch);
    const {reports} = await getTrailOutbox();
    const report = reports.get(id);
    if (!report) throw new Error('Missing fixture');
    await submitQueuedTrailReport(report);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reports.get(id)).toMatchObject({
      status: 'submitted',
      photos: [],
      turnstileToken: '',
      publicId: 'ABC123ABC123',
    });
    expect(reports.get(id)?.uploadToken).toBeUndefined();
  });
  it('pauses for a fresh bot check instead of retrying authorization failures indefinitely', async () => {
    const id = await saveTrailReport(input, [photo()], 'expired-bot-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({error: 'Bot check expired'}, 403)));
    const {reports} = await getTrailOutbox();
    const report = reports.get(id);
    if (!report) throw new Error('Missing fixture');
    await submitQueuedTrailReport(report);
    expect(reports.get(id)?.status).toBe('needs-check');
    expect(reports.get(id)?.photos).toHaveLength(1);
  });
  it('only clears photos after report finalization succeeds', async () => {
    const id = await saveTrailReport(input, [photo()], 'bot-token');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          uploadToken: 'signed-token',
          publicId: 'ABC123ABC123',
          uploads: [
            {uploadUrl: 'https://uploads.example/photo', contentType: 'image/jpeg', sortOrder: 0},
          ],
        }),
      )
      .mockResolvedValueOnce(new Response(null, {status: 200}))
      .mockResolvedValueOnce(json({publicId: 'ABC123ABC123'}, 201));
    vi.stubGlobal('fetch', fetch);
    const {reports} = await getTrailOutbox();
    const report = reports.get(id);
    if (!report) throw new Error('Missing fixture');
    await submitQueuedTrailReport(report);
    expect(reports.get(id)).toMatchObject({
      status: 'submitted',
      photos: [],
      filenames: ['branch.jpg'],
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
