import fs from 'node:fs';
import path from 'node:path';

import { Elysia, status, t } from 'elysia';

import configDB from '../db/impl/ConfigDB';
import sessionDB from '../db/impl/SessionDB';

import { FolderNode, TreeNode } from '../../../shared/types';
import { getNameExt } from '../../../shared/pathUtil';

const fileDir = path.join(import.meta.dirname, '..', '..', 'files');
const glob = new Bun.Glob('**/*');

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

        const stats = fs.statSync(fileDir);
        if (!stats.isDirectory()) {
            console.error('file directory is not a directory:', fileDir);
            return status(500);
        }

        const files = new Set(glob.scanSync({ cwd: fileDir, followSymlinks: false, dot: true }));
        const fileTree: TreeNode = { name: '/', type: 'folder', fullPath: '', children: [] };

        files.forEach(e => {
            if (e.endsWith('.auth') || e.endsWith('/')) return;

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
        });

        return { node: fileTree, size: stats.size };
    }, { cookie: t.Object({ session: t.String() }) })

    .post('/api/file/pull/url', ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const filePath = path.join(fileDir, body.path);
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });
        if (!fs.existsSync(filePath)) return status(400, { error: 'file does not exist' });

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
        if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
        if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });
        if (!fs.existsSync(filePath)) return status(400, { error: 'file does not exist' });

        const fileContents = fs.readFileSync(filePath, 'utf-8');
        return fileContents;
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

    .post('/api/file/upload', async ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401);

        const files = body.files.slice(1, body.files.length);
        const paths = body.paths.slice(1, body.paths.length);

        if (files.length !== paths.length) return status(400, { error: 'files and paths length mismatch' });

        for (let i = 0; i < files.length; i++) {
            const fileData = await files[i].arrayBuffer();
            if (fileData.byteLength > configDB.db.maxSizeMB * 1024 * 1024)
                return status(400, { error: `file ${paths[i]} size exceeds ${configDB.db.maxSizeMB}mb limit` });

            const filePath = path.join(fileDir, paths[i]);
            if (!filePath.startsWith(fileDir + path.sep)) return status(400, { error: 'invalid file path' });
            if (filePath.endsWith('.auth') || filePath.includes('.DS_Store')) return status(400, { error: 'invalid file path' });

            const ne = getNameExt(filePath);
            if (!validatePath(ne, paths[i].includes('.') ? 'file' : 'folder')) return status(400, { error: 'invalid file path' });

            const dirPath = path.dirname(filePath);
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

            fs.writeFileSync(filePath, Buffer.from(fileData));
        }

        return {};
    }, { parse: 'formdata', body: t.Object({ files: t.Array(t.File()), paths: t.Array(t.String()) }), cookie: t.Object({ session: t.String() }) })

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