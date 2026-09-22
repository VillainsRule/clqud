import fs from 'node:fs';
import path from 'node:path';

import { Elysia, status, t } from 'elysia';

import configDB from '../db/impl/ConfigDB';
import sessionDB from '../db/impl/SessionDB';

import { FolderNode, TreeNode } from '../../../shared/types';
import { getNameExt } from '../../../shared/pathUtil';

const fileDir = path.join(import.meta.dirname, '..', '..', 'files');

const scanTree = (): Set<string> => {
    if (typeof Bun !== 'undefined') {
        const result = new Bun.Glob('**/*').scanSync({ cwd: fileDir, followSymlinks: false, dot: true });
        return new Set(result);
    } else {
        const results: string[] = [];
        const walk = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                const rel = full.slice(fileDir.length + 1);
                if (entry.isSymbolicLink()) continue;
                results.push(rel);
                if (entry.isDirectory()) walk(full);
            }
        };
        walk(fileDir);
        return new Set(results);
    }
}

const validatePath = (input: string, nodeType: 'folder' | 'file') => {
    const ne = getNameExt(input);

    if (!input.trim()) return false;
    else if (input.includes(' ')) return false;
    else if (ne.startsWith('.') || input.startsWith('.')) return false;
    else if (input.endsWith('.auth') || input.endsWith('.')) return false;
    else if (nodeType === 'folder' && input.includes('.')) return false;
    else if (nodeType === 'file' && input.includes('..')) return false;
    else return true;
}

const files = new Elysia({ name: 'files' })
    .get('/api/file/tree', async ({ cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const files = scanTree();
        const fileTree: TreeNode = { name: '/', type: 'folder', fullPath: '', children: [] };

        let size = 0;

        files.forEach(e => {
            if (e.endsWith('.auth') || e.endsWith('/')) return;
            if (e === '.tmp-uploads' || e.startsWith('.tmp-uploads/')) return;

            const parts = e.split('/');

            let treeSegment: FolderNode = fileTree;

            while (parts.length > 1) {
                const part = parts.shift()!;
                let seg = treeSegment.children.find((c) => c.name === part && c.type === 'folder') as FolderNode | undefined;
                if (!seg) {
                    seg = { name: part, type: 'folder', fullPath: treeSegment.fullPath + '/' + part, children: [] };
                    treeSegment.children.push(seg);
                }
                treeSegment = seg;
            }

            if (e.endsWith('.DS_Store')) return;

            const fullPath = treeSegment.fullPath + '/' + parts[0];
            treeSegment.children.push({ type: 'file', name: parts[0], fullPath, locked: files.has((fullPath + '.auth').slice(1)) });

            const sizeData = fs.statSync(path.join(fileDir, e));
            size += sizeData.size;
        });

        return { node: fileTree, size };
    }, { cookie: t.Object({ session: t.String() }) })

    .post('/api/file/pull/url', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const filePath = path.join(fileDir, body.path);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, 'invalid file path');
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, 'invalid file path');
        if (!fs.existsSync(filePath)) return status(400, 'file does not exist');

        const passwordPath = filePath + '.auth';
        if (fs.existsSync(passwordPath)) {
            const password = fs.readFileSync(passwordPath, 'utf8');
            return { url: `${body.path}?x=${btoa(password)}` };
        } else return { url: body.path };
    }, { body: t.Object({ path: t.String() }), cookie: t.Object({ session: t.String() }) })

    .post('/api/file/pull/contents', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const filePath = path.join(fileDir, body.path);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, 'invalid file path');
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, 'invalid file path');
        if (!fs.existsSync(filePath)) return status(400, 'file does not exist');

        const fileContents = fs.readFileSync(filePath, 'utf-8');
        return new Response(fileContents, { headers: { 'content-type': 'text/plain' } });
    }, { body: t.Object({ path: t.String() }), cookie: t.Object({ session: t.String() }) })

    .post('/api/file/edit', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const filePath = path.join(fileDir, body.path);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });
        if (!fs.existsSync(filePath)) return status(400, { error: 'file does not exist' });

        if (Buffer.byteLength(body.contents, 'utf-8') > configDB.db.maxSizeMB * 1024 * 1024)
            return status(400, { error: 'file size exceeds 100mb limit' });

        fs.writeFileSync(filePath, body.contents);

        return {};
    }, { body: t.Object({ path: t.String(), contents: t.String() }), cookie: t.Object({ session: t.String() }) })

    .post('/api/file/rename', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const oldPath = path.join(fileDir, body.oldPath);
        const newPath = path.join(fileDir, body.newPath);

        if (!oldPath.startsWith(fileDir + path.sep) || !newPath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (oldPath.endsWith('.auth') || newPath.endsWith('.auth')) return status(400, { error: 'invalid file path' });
        if (oldPath.includes('.DS_Store') || newPath.includes('DS_Store')) return status(400, { error: 'invalid file path' });

        const ne = getNameExt(newPath);
        if (!validatePath(ne, body.newPath.includes('.') ? 'file' : 'folder')) return status(400, { error: 'invalid file path' });

        if (!fs.existsSync(oldPath)) return status(400, { error: 'file does not exist' });
        if (fs.existsSync(newPath)) return status(400, { error: 'new file already exists' });

        fs.renameSync(oldPath, newPath);

        return {};
    }, { body: t.Object({ oldPath: t.String(), newPath: t.String() }), cookie: t.Object({ session: t.String() }) })

    .post('/api/file/create', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const filePath = path.join(fileDir, body.path);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });

        if (!validatePath(filePath, body.type)) return status(400, { error: 'invalid file path' });
        if (fs.existsSync(filePath)) return status(400, { error: 'file already exists' });

        if (body.type === 'folder') {
            fs.mkdirSync(filePath);
            fs.writeFileSync(path.join(filePath, '.DS_Store'), '');
        } else fs.writeFileSync(filePath, '');

        return {};
    }, { body: t.Object({ path: t.String(), type: t.Union([t.Literal('file'), t.Literal('folder')]) }), cookie: t.Object({ session: t.String() }) })

    .post('/api/file/delete', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const filePath = path.join(fileDir, body.path);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });
        if (!fs.existsSync(filePath)) return status(400, { error: 'file does not exist' });

        const ne = getNameExt(filePath);
        if (!validatePath(ne, body.path.includes('.') ? 'file' : 'folder')) return status(400, { error: 'invalid file path' });

        if (fs.statSync(filePath).isDirectory()) fs.rmSync(filePath, { recursive: true });
        else fs.unlinkSync(filePath);

        return {};
    }, { body: t.Object({ path: t.String() }), cookie: t.Object({ session: t.String() }) })

    .post('/api/file/size', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const filePath = path.join(fileDir, body.path);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });

        const ne = getNameExt(filePath);
        if (!validatePath(ne, body.path.includes('.') ? 'file' : 'folder')) return status(400, { error: 'invalid file path' });

        if (!fs.existsSync(filePath)) return status(400, { error: 'file does not exist' });

        const size = fs.statSync(filePath).size;
        return { size };
    }, { body: t.Object({ path: t.String() }), cookie: t.Object({ session: t.String() }) })

    .post('/api/file/upload/chunk', async ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const { uploadId, path: relPath, chunkIndex, totalChunks, chunk } = body;

        if (!/^[a-zA-Z0-9-]+$/.test(uploadId)) return status(400, { error: 'invalid upload id' });

        const filePath = path.join(fileDir, relPath);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });

        const ne = getNameExt(filePath);
        if (!validatePath(ne, relPath.includes('.') ? 'file' : 'folder')) return status(400, { error: 'invalid file path' });

        if (chunkIndex === 0 && fs.existsSync(filePath) && fs.statSync(filePath).isFile())
            return status(400, { error: `file ${relPath} already exists` });

        const tmpDir = path.join(fileDir, '.tmp-uploads');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const tmpFile = path.join(tmpDir, `${uploadId}.tmp`);
        const chunkData = Buffer.from(await chunk.arrayBuffer());

        const currentSize = fs.existsSync(tmpFile) ? fs.statSync(tmpFile).size : 0;
        if (currentSize + chunkData.byteLength > configDB.db.maxSizeMB * 1024 * 1024) {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            return status(400, { error: `file ${relPath} size exceeds ${configDB.db.maxSizeMB}mb limit` });
        }

        fs.appendFileSync(tmpFile, chunkData);

        if (chunkIndex === totalChunks - 1) {
            const dirPath = path.dirname(filePath);
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
            fs.renameSync(tmpFile, filePath);
        }

        return {};
    }, {
        parse: 'formdata',
        body: t.Object({
            uploadId: t.String(),
            path: t.String(),
            chunkIndex: t.Numeric(),
            totalChunks: t.Numeric(),
            chunk: t.File()
        }),
        cookie: t.Object({ session: t.String() })
    })

    .post('/api/file/password/set', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        if (body.password.length > 64) return status(413, { error: 'password is too long' });
        if (body.password.length < 2) return status(403, { error: 'password is too short' });

        const filePath = path.join(fileDir, body.path);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });

        const ne = getNameExt(filePath);
        if (!validatePath(ne, body.path.includes('.') ? 'file' : 'folder')) return status(400, { error: 'invalid file path' });

        if (!fs.existsSync(filePath)) return status(400, { error: 'file does not exist' });

        const passwordPath = filePath + '.auth';
        fs.writeFileSync(passwordPath, body.password);

        return {};
    }, { body: t.Object({ path: t.String(), password: t.String() }), cookie: t.Object({ session: t.String() }) })

    .post('/api/file/password/remove', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const filePath = path.join(fileDir, body.path);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });

        const ne = getNameExt(filePath);
        if (!validatePath(ne, body.path.includes('.') ? 'file' : 'folder')) return status(400, { error: 'invalid file path' });

        if (!fs.existsSync(filePath)) return status(400, { error: 'file does not exist' });

        const passwordPath = filePath + '.auth';
        if (fs.existsSync(passwordPath)) fs.unlinkSync(passwordPath);

        return {};
    }, { body: t.Object({ path: t.String() }), cookie: t.Object({ session: t.String() }) });

export default files;