import { Elysia, status, t } from 'elysia';

import term from 'node:child_process';
import path from 'node:path';

import configDB from '../db/impl/ConfigDB';
import sessionDB from '../db/impl/SessionDB';

import Hasher from '../util/hasher';

const rootDir = path.join(import.meta.dirname, '..', '..', '..');

const localChanges = term.execSync('git status --porcelain', { encoding: 'utf8', cwd: rootDir }).trim().length > 0;
const isUsingSystemd = !!process.env['INVOCATION_ID']

const admin = new Elysia({ name: 'admin' })
    .get('/api/admin/instance', async ({ cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        return { localChanges, isUsingSystemd };
    }, { cookie: t.Cookie({ session: t.String() }) })

    .post('/api/admin/instance/password', async ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        const password = Hasher.encode(body.password);
        configDB.updateConfig({ password });
        sessionDB.clear();

        return {};
    }, { body: t.Object({ password: t.String() }), cookie: t.Cookie({ session: t.String() }) })

    .post('/api/admin/instance/maxSize', async ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        configDB.updateConfig({ maxSizeMB: body.maxSizeMB });

        return {};
    }, { body: t.Object({ maxSizeMB: t.Number() }), cookie: t.Cookie({ session: t.String() }) })

    .post('/api/admin/instance/lock', async ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        configDB.updateConfig({ locked: body.locked });

        return {};
    }, { body: t.Object({ locked: t.Boolean() }), cookie: t.Cookie({ session: t.String() }) })

    .post('/api/admin/instance/lockMobile', async ({ body }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });

        const isValidPassword = Hasher.matches(body.password, configDB.db.password);
        if (!isValidPassword) return status(401, { error: 'incorrect password' });

        configDB.updateConfig({ locked: true });

        return {};
    }, { body: t.Object({ password: t.String() }) })

    .post('/api/admin/instance/unlock', async ({ body }) => {
        if (!configDB.db.locked) return status(400, { error: 'instance is not locked' });

        const isValidPassword = Hasher.matches(body.password, configDB.db.password);
        if (!isValidPassword) return status(401, { error: 'incorrect password' });

        configDB.updateConfig({ locked: false });

        return {};
    }, { body: t.Object({ password: t.String() }) })

    .post('/api/admin/gitPull', async ({ cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        const out = term.execSync('git pull', { encoding: 'utf8', cwd: rootDir }).toString();
        return { out };
    }, { cookie: t.Cookie({ session: t.String() }) })

    .post('/api/admin/systemdRestart', async ({ cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        if (!isUsingSystemd) return status(400, { error: 'not using systemd' });

        term.exec('systemctl restart clqud.service');

        return {};
    }, { cookie: t.Cookie({ session: t.String() }) })

export default admin;