import { Elysia, t } from 'elysia';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import admin from './endpoints/admin';
import auth from './endpoints/auth';
import files from './endpoints/files';

import { getExt, getNameExt } from '../../shared/pathUtil';

const serve = new Elysia({ name: 'serve' });

if (Bun.env.DEV === '1') serve.onRequest(({ set, request }) => {
    set.headers['access-control-allow-origin'] = request.headers.get('Origin') || '*';
    set.headers.vary = '*';

    if (request.method === 'OPTIONS') {
        set.headers['access-control-allow-methods'] = '*';
        set.headers['access-control-allow-headers'] = '*';
        return new Response(null, { status: 204 });
    }

    set.headers['access-control-allow-methods'] = request.method;

    return;
});

const distDir = path.resolve(import.meta.dirname, '../../app/dist');
const cachedIndex = Bun.file(path.join(distDir, 'index.html'));

const assetDir = path.join(distDir, 'a');
const assets = fs.readdirSync(assetDir);

for (const a of assets) serve.get(`/a/${a}`, () => {
    const f = Bun.file(path.join(assetDir, a));
    return new Response(f, { headers: { 'content-type': f.type } });
});

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

const certDir = path.join(import.meta.dirname, '..', 'cert');
const certExists = fs.existsSync(certDir);

const app = new Elysia()
    .get('/', () => new Response(cachedIndex))
    .get('/&/*', () => new Response(cachedIndex))
    .get('/*', ({ path: p, cookie: { cp }, query: { d, x } }) => {
        const requestedPath = path.join(fileDir, decodeURIComponent(p));
        if (requestedPath.endsWith('.auth')) return new Response(null, { status: 404 });

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

            const f = Bun.file(requestedPath);
            return new Response(f, {
                headers: {
                    'content-type': serveAsTxt.includes(getExt(requestedPath)) ? 'text/plain' : f.type,
                    'content-disposition': typeof d === 'string' ? `attachment; filename="${getNameExt(requestedPath)}` : 'inline'
                }
            });
        }

        return new Response(cachedIndex);
    }, { query: t.Object({ x: t.Optional(t.String()), d: t.Optional(t.String()) }), cookie: t.Object({ cp: t.Optional(t.String()) }) })
    .get('/favicon.ico', ({ set }) => {
        set.headers['Cache-Control'] = 'public, max-age=31536000, immutable, no-transform';
        set.headers['Content-Type'] = 'image/x-icon';
        return Bun.file(path.join(distDir, 'favicon.ico'));
    })
    .use(serve)
    .use(admin)
    .use(auth)
    .use(files)
    .listen(4456, () => console.log(`in the clquds... ${Bun.env.RP_ID !== 'localhost' ? `https://${Bun.env.RP_ID}` : 'http://localhost:4456'}`));

if (certExists) app.listen({
    port: 4457,
    tls: {
        cert: fs.readFileSync(path.join(certDir, 'cert.pem')),
        key: fs.readFileSync(path.join(certDir, 'cert-key.pem'))
    }
}, () => console.log(`your self-signed cert is on https://${os.hostname()}.local:4457`))

export type App = typeof app;