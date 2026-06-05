import crypto from 'node:crypto';

import { Elysia, status, t } from 'elysia';

import configDB from '../db/impl/ConfigDB';
import sessionDB from '../db/impl/SessionDB';

const auth = new Elysia({ name: 'auth' })
    .get('/api/auth/instance', async ({ cookie: { session }, request }) => {
        const origin = new URL(request.url).origin;

        const loggedIn = typeof session.value === 'string' && sessionDB.db.includes(session.value);
        return {
            loggedIn,
            isLocked: configDB.db.locked,
            maxFileSize: loggedIn ? configDB.db.maxSizeMB : 0,
            redirect: `${process.env.VOAUTH_HOST}/oauth/v1?client_id=${process.env.VOAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${origin}/api/auth/ACTION/complete`)}`
        }
    })

    .get('/api/auth/login/complete', async ({ query: { code }, cookie: { session } }) => {
        try {
            if (!code) return status(400, { error: 'missing code' });

            const userReq = await fetch(`${process.env.VOAUTH_HOST}/api/v1/oauth/validate`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ appId: process.env.VOAUTH_CLIENT_ID, appSecret: process.env.VOAUTH_CLIENT_SECRET, code })
            });

            const userRes = await userReq.json() as { error: string } | { user: { id: number, username: string } };
            if (!('user' in userRes)) return status(401, { error: userRes.error || 'invalid code' });

            if (userRes.user.id.toString() !== process.env.VOAUTH_USER_ID) return status(401, { error: 'your voauth account is not authorized to access this instance' });

            const newSession = crypto.randomBytes(32).toString('hex');
            sessionDB.add(newSession);

            session.value = newSession;
            session.httpOnly = true;
            session.path = '/';
            session.sameSite = 'lax';
            session.secure = true;

            return new Response(null, { status: 302, headers: { Location: '/' } });
        } catch (error) {
            console.error(error);
            return status(502, {});
        }
    }, { query: t.Object({ code: t.Optional(t.String()) }) })

    .get('/api/auth/lock/complete', async ({ query: { code } }) => {
        try {
            if (!code) return status(400, { error: 'missing code' });

            const userReq = await fetch(`${process.env.VOAUTH_HOST}/api/v1/oauth/validate`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ appId: process.env.VOAUTH_CLIENT_ID, appSecret: process.env.VOAUTH_CLIENT_SECRET, code })
            });

            const userRes = await userReq.json() as { error: string } | { user: { id: number, username: string } };
            if (!('user' in userRes)) return status(401, { error: userRes.error || 'invalid code' });

            if (userRes.user.id.toString() !== process.env.VOAUTH_USER_ID) return status(401, { error: 'your voauth account is not authorized to access this instance' });

            configDB.updateConfig({ locked: true });

            return new Response(null, { status: 302, headers: { Location: '/' } });
        } catch (error) {
            console.error(error);
            return status(502, {});
        }
    }, { query: t.Object({ code: t.Optional(t.String()) }) })

    .get('/api/auth/unlock/complete', async ({ query: { code } }) => {
        try {
            if (!code) return status(400, { error: 'missing code' });

            const userReq = await fetch(`${process.env.VOAUTH_HOST}/api/v1/oauth/validate`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ appId: process.env.VOAUTH_CLIENT_ID, appSecret: process.env.VOAUTH_CLIENT_SECRET, code })
            });

            const userRes = await userReq.json() as { error: string } | { user: { id: number, username: string } };
            if (!('user' in userRes)) return status(401, { error: userRes.error || 'invalid code' });

            if (userRes.user.id.toString() !== process.env.VOAUTH_USER_ID) return status(401, { error: 'your voauth account is not authorized to access this instance' });

            configDB.updateConfig({ locked: false });

            return new Response(null, { status: 302, headers: { Location: '/' } });
        } catch (error) {
            console.error(error);
            return status(502, {});
        }
    }, { query: t.Object({ code: t.Optional(t.String()) }) })

    .post('/api/auth/logout', async ({ cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return {};

        sessionDB.remove(session.value);

        session.value = '';
        session.httpOnly = true;
        session.path = '/';
        session.sameSite = 'strict';
        session.maxAge = 0;
        session.secure = true;

        return {};
    }, { cookie: t.Cookie({ session: t.String() }) })

export default auth;