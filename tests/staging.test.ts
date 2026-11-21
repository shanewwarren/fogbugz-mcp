import axios from 'axios';
import { FogBugzApi } from '../src/api';
import { R2Staging, r2ConfigFromEnv } from '../src/staging';
import { startWikiUpload, uploadWikiFile } from '../src/commands/wiki';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const config = { accountId: 'acct', bucket: 'transcribe-temp', accessKeyId: 'AK', secretAccessKey: 'SK' };

describe('R2Staging', () => {
  const staging = new R2Staging(config);

  it('builds keys under uploads/wiki/ that keep a safe file name', () => {
    expect(staging.newKey('My Diagram (v2).png')).toMatch(/^uploads\/wiki\/[0-9a-f-]{36}\/My-Diagram-v2-.png$/);
  });

  it('presigns a PUT scoped to the key with a 30-minute expiry', async () => {
    const url = new URL(await staging.presignPut('uploads/wiki/abc/a b.png'));
    expect(url.host).toBe('acct.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/transcribe-temp/uploads/wiki/abc/a%20b.png');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('1800');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each(['uploads/other.mp3', 'uploads/wiki/../secret', 'x'])('refuses non-staging key %p', (key) => {
    expect(() => staging.assertStagingKey(key)).toThrow(/uploadId/);
  });

  it('reports a missing object as "upload not run yet"', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 404, data: Buffer.from(''), headers: {} });
    await expect(staging.get('uploads/wiki/abc/a.png')).rejects.toThrow(/run the upload command first/);
  });

  it('reads and deletes through axios with query-signed URLs (so the egress proxy applies)', async () => {
    mockAxios.get.mockResolvedValueOnce({ status: 200, data: Buffer.from('png'), headers: { 'content-type': 'image/png' } });
    mockAxios.delete.mockResolvedValueOnce({ status: 204 });

    const got = await staging.get('uploads/wiki/abc/a.png');
    await staging.delete('uploads/wiki/abc/a.png');

    expect(got).toEqual({ data: Buffer.from('png'), contentType: 'image/png' });
    for (const call of [mockAxios.get.mock.calls[0][0], mockAxios.delete.mock.calls[0][0]]) {
      expect(new URL(call as string).searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('is disabled unless all four R2 env vars are set', () => {
    expect(r2ConfigFromEnv({ R2_ACCOUNT_ID: 'a', R2_BUCKET: 'b', R2_ACCESS_KEY_ID: 'c' })).toBeUndefined();
    expect(r2ConfigFromEnv({ R2_ACCOUNT_ID: 'a', R2_BUCKET: 'b', R2_ACCESS_KEY_ID: 'c', R2_SECRET_ACCESS_KEY: 'd' }))
      .toEqual({ accountId: 'a', bucket: 'b', accessKeyId: 'c', secretAccessKey: 'd' });
  });
});

describe('two-step wiki upload', () => {
  const api = new FogBugzApi({ baseUrl: 'https://x.fogbugz.com', apiKey: 'k' });
  let staging: R2Staging;

  beforeEach(() => {
    jest.resetAllMocks();
    staging = new R2Staging(config);
  });

  it('start returns an uploadId and a runnable curl command', async () => {
    const out = JSON.parse(await startWikiUpload(api, { fileName: 'arch.png' }, staging));

    expect(out.uploadId).toMatch(/^uploads\/wiki\/.+\/arch\.png$/);
    expect(out.command).toContain("-H 'Content-Type: image/png'");
    expect(out.command).toContain(`'${out.uploadUrl}'`);
    expect(out.command).toContain('<path-to-arch.png>');
  });

  it('start explains when staging is not configured', async () => {
    const out = JSON.parse(await startWikiUpload(api, { fileName: 'a.png' }));
    expect(out.error).toMatch(/not configured/);
  });

  it('attach by uploadId reads the staged file, uploads it, then deletes it', async () => {
    const get = jest.spyOn(staging, 'get').mockResolvedValue({ data: Buffer.from('png'), contentType: 'application/octet-stream' });
    const del = jest.spyOn(staging, 'delete').mockResolvedValue();
    mockAxios.post.mockResolvedValueOnce({ data: { data: { upfiles: { upfile: { ixAttachment: 42 } } }, errors: [] } });

    const out = JSON.parse(await uploadWikiFile(api, { wikiId: 12, uploadId: 'uploads/wiki/u1/arch.png' }, staging));

    expect(get).toHaveBeenCalledWith('uploads/wiki/u1/arch.png');
    expect(del).toHaveBeenCalledWith('uploads/wiki/u1/arch.png');
    expect(out).toMatchObject({ attachmentId: 42, fileName: 'arch.png' });
    expect(out.markdown).toMatch(/^!\[arch\.png\]/);
  });

  it('attach does not delete the staged file when FogBugz rejects it', async () => {
    jest.spyOn(staging, 'get').mockResolvedValue({ data: Buffer.from('png') });
    const del = jest.spyOn(staging, 'delete').mockResolvedValue();
    mockAxios.post.mockResolvedValueOnce({ data: { data: {}, errors: [{ message: 'nope' }] } });

    const out = JSON.parse(await uploadWikiFile(api, { wikiId: 12, uploadId: 'uploads/wiki/u1/a.png' }, staging));

    expect(out.error).toMatch(/nope/);
    expect(del).not.toHaveBeenCalled();
  });

  it('attach refuses uploadIds outside the staging prefix before touching R2', async () => {
    const get = jest.spyOn(staging, 'get');
    const out = JSON.parse(await uploadWikiFile(api, { wikiId: 12, uploadId: 'uploads/voice-memo.mp3' }, staging));
    expect(out.error).toMatch(/uploadId must come from/);
    expect(get).not.toHaveBeenCalled();
  });
});
