import { Elysia, t } from 'elysia';

import fs from 'node:fs';
import path from 'node:path';

import mime from 'mime/lite';

import admin from './endpoints/admin';
import auth from './endpoints/auth';
import files from './endpoints/files';

import { getExt, getNameExt } from '../../shared/pathUtil';

const serve = new Elysia({ name: 'serve' });

const distDir = path.resolve(import.meta.dirname, '../../app/dist');
const cachedIndex = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

const assetDir = path.join(distDir, 'a');
const assets = fs.readdirSync(assetDir);

for (const a of assets) serve.get(`/a/${a}`, () => new Response(
    fs.createReadStream(path.join(assetDir, a)),
    { headers: { 'content-type': mime.getType(a) || 'application/octet-stream' } }
));

const fileDir = path.join(import.meta.dirname, '..', 'files');
if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir);

const scanForSymlinks = (dir: string, baseDir: string = dir) => {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isSymbolicLink()) {
                console.warn(`symlink removed (this is BAD): ${path.relative(baseDir, fullPath)}`);
                fs.unlinkSync(fullPath);
            } else if (entry.isDirectory()) scanForSymlinks(fullPath, baseDir);
        }
    } catch (error) {
        console.warn(`Failed to scan directory ${dir}:`, error);
    }
};

scanForSymlinks(fileDir);

const serveAsTxt = ['diff'];

const app = new Elysia()
    .get('/', () => new Response(cachedIndex, { headers: { 'Content-Type': 'text/html' } }))
    .get('/&', () => new Response(cachedIndex, { headers: { 'Content-Type': 'text/html' } }))
    .get('/&/*', () => new Response(cachedIndex, { headers: { 'Content-Type': 'text/html' } }))
    .all('/*', ({ path: p, cookie: { cp }, query: { d, x }, headers: { accept } }) => {
        const requestedPath = path.join(fileDir, decodeURIComponent(p));
        if (requestedPath.endsWith('.auth') || requestedPath.endsWith('.DS_Store')) return new Response(null, { status: 404 });

        if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
            const authPath = requestedPath + '.auth';

            if (fs.existsSync(authPath)) {
                const password = fs.readFileSync(authPath, 'utf8');

                if (!x) {
                    cp.value = 'a';
                    cp.expires = new Date(Date.now() + 5 * 60 * 1000);
                    cp.path = '/';
                    cp.httpOnly = false;
                    return new Response(cachedIndex, { status: 401 });
                }

                try {
                    if (atob(x) !== password) throw 'haha!';
                } catch {
                    cp.value = 'i';
                    cp.expires = new Date(Date.now() + 5 * 60 * 1000);
                    cp.path = '/';
                    cp.httpOnly = false;
                    return new Response(cachedIndex, { status: 401 });
                }
            }

            return new Response(fs.createReadStream(requestedPath), {
                headers: {
                    'content-type': serveAsTxt.includes(getExt(requestedPath)) ? 'text/plain' : (mime.getType(requestedPath) || 'application/octet-stream'),
                    'content-disposition': typeof d === 'string' ? `attachment; filename="${getNameExt(requestedPath)}` : 'inline'
                }
            });
        }

        if (accept?.includes('text/html')) return new Response(
            fs.createReadStream(path.join(import.meta.dirname, '../../app/dist/404.html')),
            { status: 404, headers: { 'Content-Type': 'text/html' } }
        );

        return new Response(null, { status: 404 });
    }, { query: t.Object({ x: t.Optional(t.String()), d: t.Optional(t.String()) }), cookie: t.Object({ cp: t.Optional(t.String()) }) })
    .get('/favicon.ico', ({ set }) => {
        set.headers['Cache-Control'] = 'public, max-age=31536000, immutable, no-transform';
        set.headers['Content-Type'] = 'image/x-icon';
        return new Response(fs.createReadStream(path.join(import.meta.dirname, '../../app/dist/favicon.ico')), { headers: { 'Content-Type': 'image/x-icon' } });
    })
    .use(serve)
    .use(admin)
    .use(auth)
    .use(files)
    .listen(4456, () => console.log('in the clquds... http://localhost:4456'));

export type App = typeof app;