import axios from 'axios';
import FormData from 'form-data';
import { FogBugzApi } from '../src/api';
import {
  parsePageId,
  prepareBody,
  createWikiArticle,
  editWikiArticle,
  listWikiArticles,
  uploadWikiFile,
} from '../src/commands/wiki';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const ok = (data: any) => ({ data: { data, errors: [] } });
const sentCmds = () => mockAxios.post.mock.calls.map((c) => (c[1] as any).cmd);

describe('wiki tools', () => {
  const api = new FogBugzApi({ baseUrl: 'https://x.fogbugz.com/', apiKey: 'k' });

  beforeEach(() => jest.resetAllMocks());

  describe('parsePageId', () => {
    it.each([
      [184, 184],
      ['184', 184],
      ['W184', 184],
      ['https://x.fogbugz.com/f/page?W184', 184],
      ['https://x.fogbugz.com/default.asp?W77', 77],
    ])('%p -> %p', (input, expected) => expect(parsePageId(input)).toBe(expected));

    it('rejects junk', () => expect(() => parsePageId('page184x')).toThrow(/Unrecognized/));
  });

  describe('prepareBody', () => {
    it('lifts a leading H1 into the title', () => {
      const r = prepareBody('# Theory of Operation\n\nSome *text*.');
      expect(r.title).toBe('Theory of Operation');
      expect(r.html).toBe('<p>Some <em>text</em>.</p>');
    });

    it('keeps an H1 that differs from an explicit title', () => {
      const r = prepareBody('# Section\n\nx', 'markdown', 'Page');
      expect(r.title).toBe('Page');
      expect(r.html).toContain('<h1>Section</h1>');
    });

    it('renders bordered tables and escaped code', () => {
      const r = prepareBody('| a |\n|---|\n| 1 |\n\n```\nx<1\n```');
      expect(r.html).toContain('<table border="1" cellpadding="4" cellspacing="0" style="margin-bottom:1em">');
      expect(r.html).toContain('x&lt;1');
    });

    it('passes html through untouched', () => {
      expect(prepareBody('<h2>Hi</h2>', 'html').html).toBe('<h2>Hi</h2>');
    });
  });

  it('create sends rendered HTML with the derived title and tags', async () => {
    mockAxios.post
      .mockResolvedValueOnce(ok({ wikipage: '' }))
      .mockResolvedValueOnce(ok({ articles: [{ ixWikiPage: 499, sHeadline: 'Other' }, { ixWikiPage: 500, sHeadline: 'Doc' }] }));

    const out = JSON.parse(
      await createWikiArticle(api, { wikiId: 12, body: '# Doc\n\nHello', tags: ['portal', ' docs '] }),
    );

    expect(sentCmds()).toEqual(['newArticle', 'listArticles']);
    expect(mockAxios.post.mock.calls[0][1]).toMatchObject({
      cmd: 'newArticle',
      ixWiki: 12,
      sHeadline: 'Doc',
      sBody: '<p>Hello</p>',
      sTags: 'portal,docs',
    });
    expect(out).toMatchObject({ id: 500, link: 'https://x.fogbugz.com/f/page?W500' });
  });

  it('create without a title or H1 fails before calling FogBugz', async () => {
    const out = JSON.parse(await createWikiArticle(api, { wikiId: 12, body: 'no heading' }));
    expect(out.error).toMatch(/title/);
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it('edit refuses when the page moved past expectedRevision', async () => {
    mockAxios.post.mockResolvedValueOnce(ok({ wikipage: { sHeadline: 'T', sBody: '', nRevision: 4 } }));

    const out = JSON.parse(await editWikiArticle(api, { pageId: 'W184', body: 'new', expectedRevision: 3 }));

    expect(out).toMatchObject({ currentRevision: 4 });
    expect(sentCmds()).toEqual(['viewArticle']);
  });

  it('edit replaces the body and reports the new revision', async () => {
    mockAxios.post
      .mockResolvedValueOnce(ok({ wikipage: { sHeadline: 'T', sBody: '', nRevision: 3 } }))
      .mockResolvedValueOnce(ok({ wikipage: '' }))
      .mockResolvedValueOnce(ok({ wikipage: { sHeadline: 'T', sBody: '<p>new</p>', nRevision: 4 } }));

    const out = JSON.parse(
      await editWikiArticle(api, { pageId: 184, body: 'new', comment: 'via mcp', expectedRevision: 3 }),
    );

    expect(sentCmds()).toEqual(['viewArticle', 'editArticle', 'viewArticle']);
    expect(mockAxios.post.mock.calls[1][1]).toMatchObject({
      ixWikiPage: 184,
      sHeadline: 'T',
      sBody: '<p>new</p>',
      sComment: 'via mcp',
    });
    expect(out).toMatchObject({ previousRevision: 3, revision: 4 });
  });

  it('title-only edit resends the current body, since FogBugz needs both', async () => {
    mockAxios.post
      .mockResolvedValueOnce(ok({ wikipage: { sHeadline: 'Old', sBody: '<p>keep</p>', nRevision: 2 } }))
      .mockResolvedValueOnce(ok({ wikipage: '' }))
      .mockResolvedValueOnce(ok({ wikipage: { sHeadline: 'New', sBody: '<p>keep</p>', nRevision: 3 } }));

    await editWikiArticle(api, { pageId: 7, title: 'New' });

    expect(mockAxios.post.mock.calls[1][1]).toMatchObject({ sHeadline: 'New', sBody: '<p>keep</p>' });
  });

  it('list searches every wiki when wikiId is omitted', async () => {
    mockAxios.post
      .mockResolvedValueOnce(ok({ wikis: [
        { ixWiki: 1, sWiki: 'A', ixWikiPageRoot: 10 },
        { ixWiki: 2, sWiki: 'B', ixWikiPageRoot: 20, fDeleted: true },
        { ixWiki: 3, sWiki: 'C', ixWikiPageRoot: 30 },
      ] }))
      .mockResolvedValueOnce(ok({ articles: [{ ixWikiPage: 11, sHeadline: 'Portal notes' }] }))
      .mockResolvedValueOnce(ok({ articles: [{ ixWikiPage: 31, sHeadline: 'Other' }] }));

    const out = JSON.parse(await listWikiArticles(api, { titleContains: 'portal' }));

    expect(sentCmds()).toEqual(['listWikis', 'listArticles', 'listArticles']);
    expect(out.articles).toEqual([
      { wikiId: 1, wikiTitle: 'A', id: 11, title: 'Portal notes', link: 'https://x.fogbugz.com/f/page?W11' },
    ]);
  });

  describe('upload', () => {
    it('posts form fields and returns an absolute embeddable URL', async () => {
      mockAxios.post.mockResolvedValueOnce(ok({ upfiles: { upfile: { ixAttachment: 9 } } }));

      const out = JSON.parse(
        await uploadWikiFile(api, { wikiId: 12, fileName: 'shot.png', base64: Buffer.from('png').toString('base64') }),
      );

      const form = mockAxios.post.mock.calls[0][1] as FormData;
      const raw = form.getBuffer().toString();
      const json = JSON.parse(raw.match(/name="json"\r\n\r\n(.*)\r\n/)![1]);
      expect(json).toEqual({ cmd: 'wikiFileUpload', token: 'k', ixWiki: 12, nFileCount: 1 });
      expect(raw).toMatch(/name="File1"; filename="shot.png"\r\nContent-Type: image\/png/);
      const url = 'https://x.fogbugz.com/default.asp?pg=pgDownload&pgType=pgWikiAttachment&ixAttachment=9&sFileName=shot.png';
      expect(out).toMatchObject({ attachmentId: 9, url, markdown: `![shot.png](${url})` });
    });

    it('prefers the extension over an octet-stream type from a fetched url', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: Buffer.from('png'), headers: { 'content-type': 'binary/octet-stream' } });
      mockAxios.post.mockResolvedValueOnce(ok({ upfiles: { upfile: { ixAttachment: 10 } } }));

      const out = JSON.parse(
        await uploadWikiFile(api, { wikiId: 12, url: 'https://r2.example/uploads/abc.png?X-Amz-Signature=s', fileName: 'diagram.png' }),
      );

      const raw = (mockAxios.post.mock.calls[0][1] as FormData).getBuffer().toString();
      expect(raw).toMatch(/filename="diagram.png"\r\nContent-Type: image\/png/);
      expect(out.markdown).toBe(`![diagram.png](${out.url})`);
    });

    it('requires exactly one source', async () => {
      const out = JSON.parse(await uploadWikiFile(api, { wikiId: 12, base64: 'eA==', url: 'https://a/b.png' }));
      expect(out.error).toMatch(/exactly one/);
      expect(mockAxios.post).not.toHaveBeenCalled();
    });
  });
});
