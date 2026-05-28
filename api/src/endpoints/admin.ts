import { Elysia, status, t } from 'elysia';

import configDB from '../db/impl/ConfigDB';
import sessionDB from '../db/impl/SessionDB';

const admin = new Elysia({ name: 'admin' })
    .get('/api/admin/instance', async ({ cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        return {};
    }, { cookie: t.Cookie({ session: t.String() }) })

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

export default admin;