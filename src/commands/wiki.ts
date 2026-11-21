import fs from 'fs';
import path from 'path';
import axios from 'axios';
import MarkdownIt from 'markdown-it';
import { FogBugzApi } from '../api';
import { R2Staging, UPLOAD_TTL_SECONDS } from '../staging';

const md = new MarkdownIt({ html: true, linkify: true });
// FogBugz's wiki CSS draws no table borders, so bare markdown tables render as unruled text.
md.renderer.rules.table_open = () => '<table border="1" cellpadding="4" cellspacing="0" style="margin-bottom:1em">\n';

type BodyFormat = 'markdown' | 'html';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
};

const fail = (error: any) => JSON.stringify({ error: error?.message ?? String(error) });

export function parsePageId(input: unknown): number {
  if (typeof input === 'number' && Number.isInteger(input) && input > 0) return input;
  const s = String(input ?? '').trim();
  const m = /^\d+$/.test(s) ? [s, s] : s.match(/[?&/]W(\d+)\b/i) || s.match(/^W(\d+)$/i);
  if (!m) throw new Error(`Unrecognized wiki page id "${s}". Use 184, "W184", or the page URL.`);
  return Number(m[1]);
}

function normalizeTags(tags: unknown): string | undefined {
  if (tags === undefined || tags === null) return undefined;
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  return list.map((t) => String(t).trim()).filter(Boolean).join(',');
}

/**
 * Renders the body to HTML. For markdown, a leading `# H1` is lifted out as the title
 * (FogBugz already shows the headline above the body, so keeping it would duplicate it).
 */
export function prepareBody(
  body: string,
  format: BodyFormat = 'markdown',
  title?: string,
): { html: string; title?: string } {
  if (format === 'html') return { html: body, title };
  if (format !== 'markdown') throw new Error(`format must be "markdown" or "html", got "${format}"`);

  const h1 = body.match(/^\s*#\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  let source = body;
  let resolvedTitle = title;
  if (h1 && (!title || h1[1].trim() === title.trim())) {
    resolvedTitle = title || h1[1].trim();
    source = body.slice(h1[0].length);
  }
  return { html: md.render(source).trim(), title: resolvedTitle };
}

export async function listWikis(api: FogBugzApi, args: any): Promise<string> {
  try {
    const wikis = await api.listWikis();
    const visible = args?.includeDeleted ? wikis : wikis.filter((w) => !w.fDeleted);
    return JSON.stringify({
      count: visible.length,
      wikis: visible.map((w) => ({
        id: w.ixWiki,
        title: w.sWiki,
        tagline: w.sTagLineHTML || undefined,
        rootPageId: w.ixWikiPageRoot,
        deleted: w.fDeleted || undefined,
        link: api.getWikiPageLink(w.ixWikiPageRoot),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function listWikiArticles(api: FogBugzApi, args: any): Promise<string> {
  const { wikiId, titleContains } = args || {};
  try {
    const wikis = (await api.listWikis()).filter((w) => !w.fDeleted);
    const targets = wikiId !== undefined ? wikis.filter((w) => w.ixWiki === Number(wikiId)) : wikis;
    if (wikiId !== undefined && targets.length === 0) {
      return JSON.stringify({ error: `Wiki ${wikiId} not found`, available: wikis.map((w) => ({ id: w.ixWiki, title: w.sWiki })) });
    }

    const needle = titleContains ? String(titleContains).toLowerCase() : undefined;
    const perWiki = await Promise.all(
      targets.map(async (w) =>
        (await api.listArticles(w.ixWiki)).map((a) => ({
          wikiId: w.ixWiki,
          wikiTitle: w.sWiki,
          id: a.ixWikiPage,
          title: a.sHeadline,
          link: api.getWikiPageLink(a.ixWikiPage),
        })),
      ),
    );
    const articles = perWiki.flat().filter((a) => !needle || a.title.toLowerCase().includes(needle));
    return JSON.stringify({ count: articles.length, articles });
  } catch (error) {
    return fail(error);
  }
}

export async function getWikiArticle(api: FogBugzApi, args: any): Promise<string> {
  try {
    const id = parsePageId(args?.pageId);
    const a = await api.viewArticle(id, args?.revision);
    return JSON.stringify({
      id,
      title: a.sHeadline,
      revision: a.nRevision,
      tags: (a.tags || []).map((t) => t.sTag),
      link: api.getWikiPageLink(id),
      bodyHtml: a.sBody,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function createWikiArticle(api: FogBugzApi, args: any): Promise<string> {
  const { wikiId, title, body, format, tags } = args || {};
  try {
    if (!wikiId) throw new Error('wikiId is required (see fogbugz_list_wikis).');
    if (typeof body !== 'string') throw new Error('body is required.');
    const prepared = prepareBody(body, format, title);
    if (!prepared.title) throw new Error('Provide a title, or start a markdown body with "# Title".');

    const created = await api.newArticle({
      ixWiki: Number(wikiId),
      sHeadline: prepared.title,
      sBody: prepared.html,
      sTags: normalizeTags(tags),
    });
    return JSON.stringify({
      id: created.ixWikiPage,
      title: prepared.title,
      link: api.getWikiPageLink(created.ixWikiPage),
      message: `Created wiki page W${created.ixWikiPage}: "${prepared.title}".`,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function editWikiArticle(api: FogBugzApi, args: any): Promise<string> {
  const { title, body, format, comment, tags, expectedRevision } = args || {};
  try {
    const id = parsePageId(args?.pageId);
    if (title === undefined && body === undefined && tags === undefined) {
      throw new Error('Nothing to change: pass at least one of title, body, tags.');
    }

    const current = await api.viewArticle(id);
    if (expectedRevision !== undefined && current.nRevision !== Number(expectedRevision)) {
      return JSON.stringify({
        error: `W${id} is at revision ${current.nRevision}, not ${expectedRevision}; someone else edited it. Re-read it before overwriting.`,
        currentRevision: current.nRevision,
      });
    }

    const prepared = typeof body === 'string' ? prepareBody(body, format, title) : undefined;
    await api.editArticle({
      ixWikiPage: id,
      sHeadline: prepared?.title ?? title ?? current.sHeadline,
      sBody: prepared?.html ?? current.sBody,
      sComment: comment,
      sTags: normalizeTags(tags),
    });

    const after = await api.viewArticle(id);
    return JSON.stringify({
      id,
      title: after.sHeadline,
      previousRevision: current.nRevision,
      revision: after.nRevision,
      link: api.getWikiPageLink(id),
      message: `Updated W${id} to revision ${after.nRevision}.`,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function listWikiRevisions(api: FogBugzApi, args: any): Promise<string> {
  try {
    const id = parsePageId(args?.pageId);
    const revisions = await api.listRevisions(id);
    return JSON.stringify({
      id,
      count: revisions.length,
      revisions: revisions.map((r) => ({
        revision: r.nRevision,
        personId: r.ixPerson,
        title: r.sTitle,
        comment: r.sComment || undefined,
        dt: r.dt,
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function createWiki(api: FogBugzApi, args: any): Promise<string> {
  const { title, tagline } = args || {};
  try {
    if (!title) throw new Error('title is required.');
    const created = await api.newWiki(title, tagline);
    const wiki = (await api.listWikis()).find((w) => w.ixWiki === created.ixWiki);
    return JSON.stringify({
      id: created.ixWiki,
      rootPageId: wiki?.ixWikiPageRoot,
      link: wiki ? api.getWikiPageLink(wiki.ixWikiPageRoot) : undefined,
      message: `Created wiki ${created.ixWiki}: "${title}".`,
    });
  } catch (error) {
    return fail(error);
  }
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export async function startWikiUpload(_api: FogBugzApi, args: any, staging?: R2Staging): Promise<string> {
  try {
    if (!staging) throw new Error('Upload staging is not configured on this server (R2_* env vars missing).');
    if (!args?.fileName) throw new Error('fileName is required, e.g. "diagram.png".');
    const fileName = path.basename(String(args.fileName));
    const contentType = args.contentType || MIME_BY_EXT[path.extname(fileName).toLowerCase()] || 'application/octet-stream';

    const uploadId = staging.newKey(fileName);
    const uploadUrl = await staging.presignPut(uploadId);
    return JSON.stringify({
      uploadId,
      uploadUrl,
      expiresInSeconds: UPLOAD_TTL_SECONDS,
      command: `curl -fsS -T <path-to-${fileName}> -H ${shellQuote(`Content-Type: ${contentType}`)} ${shellQuote(uploadUrl)}`,
      message:
        'Run `command` on the machine that has the file (replace the <path-...> placeholder), then call fogbugz_upload_wiki_file with this uploadId.',
    });
  } catch (error) {
    return fail(error);
  }
}

type LoadedFile = { data: Buffer; fileName: string; contentType?: string; stagedKey?: string };

async function loadFile(args: any, staging?: R2Staging): Promise<LoadedFile> {
  const { base64, url, filePath, uploadId } = args;
  const sources = [base64, url, filePath, uploadId].filter((v) => v !== undefined && v !== '');
  if (sources.length !== 1) throw new Error('Provide exactly one of uploadId, url, filePath, base64.');

  if (uploadId) {
    if (!staging) throw new Error('Upload staging is not configured on this server (R2_* env vars missing).');
    staging.assertStagingKey(uploadId);
    const staged = await staging.get(uploadId);
    return { ...staged, fileName: args.fileName || path.basename(uploadId), stagedKey: uploadId };
  }
  if (base64) {
    if (!args.fileName) throw new Error('fileName is required with base64.');
    return { data: Buffer.from(String(base64).replace(/^data:[^,]*,/, ''), 'base64'), fileName: args.fileName };
  }
  if (filePath) {
    return { data: await fs.promises.readFile(filePath), fileName: args.fileName || path.basename(filePath) };
  }
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const fromUrl = path.basename(new URL(url).pathname) || 'upload';
  return {
    data: Buffer.from(response.data),
    fileName: args.fileName || fromUrl,
    contentType: String(response.headers?.['content-type'] || '') || undefined,
  };
}

export async function uploadWikiFile(api: FogBugzApi, args: any, staging?: R2Staging): Promise<string> {
  try {
    if (!args?.wikiId) throw new Error('wikiId is required (see fogbugz_list_wikis).');
    const file = await loadFile(args, staging);
    // R2 and many hosts serve uploads as octet-stream, which FogBugz would then serve back to browsers.
    const fetchedType = file.contentType && !/octet-stream/i.test(file.contentType) ? file.contentType : undefined;
    const contentType =
      args.contentType || fetchedType || MIME_BY_EXT[path.extname(file.fileName).toLowerCase()];

    const { ixAttachment } = await api.uploadWikiFile(Number(args.wikiId), file.fileName, file.data, contentType);
    // Best-effort: the bucket's 1-day expiry rule catches anything this misses.
    if (file.stagedKey && staging) await staging.delete(file.stagedKey).catch(() => undefined);

    const url = api.getWikiAttachmentUrl(ixAttachment, file.fileName);
    const isImage = /^image\//.test(contentType || '');
    return JSON.stringify({
      attachmentId: ixAttachment,
      fileName: file.fileName,
      bytes: file.data.length,
      url,
      markdown: isImage ? `![${file.fileName}](${url})` : `[${file.fileName}](${url})`,
      message: `Uploaded ${file.fileName}. Embed the markdown snippet in a page body.`,
    });
  } catch (error) {
    return fail(error);
  }
}
