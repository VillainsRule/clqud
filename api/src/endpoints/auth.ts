import crypto from 'node:crypto';

import { Elysia, status, t } from 'elysia';

import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
    type AuthenticationResponseJSON,
    type RegistrationResponseJSON,
    type VerifiedAuthenticationResponse,
    type VerifiedRegistrationResponse
} from '@simplewebauthn/server';

import configDB from '../db/impl/ConfigDB';
import sessionDB from '../db/impl/SessionDB';
import passkeyDB from '../db/impl/PasskeyDB';

import Hasher from '../util/hasher';

const currentRegistrations: Record<string, { name: string, value: string, expiry: number }> = {};

const isDev = Bun.env.DEV === '1';
const isWebAuthnConfigured = typeof Bun.env.RP_ID === 'string';

const auth = new Elysia({ name: 'auth' })
    .get('/api/auth/instance', async ({ cookie: { session } }) => {
        const loggedIn = typeof session.value === 'string' && sessionDB.db.includes(session.value);
        if (loggedIn) return { loggedIn, isLocked: configDB.db.locked, isWebAuthnConfigured, isDev, maxFileSize: configDB.db.maxSizeMB };
        else return { loggedIn, isLocked: configDB.db.locked, isWebAuthnConfigured, isDev: false };
    })

    .post('/api/auth/account', async ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        try {
            const isValidPassword = Hasher.matches(body.password, configDB.db.password);
            if (!isValidPassword) return status(401, { error: 'incorrect password' });

            const newSession = crypto.randomBytes(32).toString('hex');
            sessionDB.add(newSession);

            session.value = newSession;
            session.httpOnly = true;
            session.path = '/';
            session.sameSite = 'strict';
            session.secure = true;

            return { loggedIn: true };
        } catch (error) {
            console.error(error);
            return status(502, {});
        }
    }, { body: t.Object({ password: t.String() }) })

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

    .get('/api/auth/passkeys', async ({ cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        const passkeys = passkeyDB.values().map((pk) => {
            return {
                id: pk.id,
                name: pk.name,
                transports: pk.transports,
                lastUsed: pk.lastUsed
            }
        });

        return { passkeys };
    }, { cookie: t.Cookie({ session: t.String() }) })

    .post('/api/auth/passkeys/delete', async ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        passkeyDB.delete(body.id);

        return {};
    }, { body: t.Object({ id: t.String() }), cookie: t.Cookie({ session: t.String() }) })

    .post('/api/auth/webauthn/register/options', async ({ body, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!isWebAuthnConfigured) return status(404);

        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        if (body.name.length > 24) return status(413, { error: 'name too long' });

        if (currentRegistrations[session.value] && currentRegistrations[session.value].expiry > Date.now())
            return status(400, { error: 'you have an ongoing registration, please complete or wait for it to expire' });

        const existingPasskeys = passkeyDB.values();
        if (existingPasskeys.some((pk) => pk && pk.name === body.name))
            return status(400, { error: 'you already have a passkey with that name' });

        const opts = await generateRegistrationOptions({
            rpName: 'Drain',
            rpID: Bun.env.RP_ID!,
            userName: 'admin',
            attestationType: 'none',
            excludeCredentials: passkeyDB.keys().map(e => ({ id: e })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred'
            }
        });

        currentRegistrations[session.value] = {
            name: body.name,
            value: opts.challenge,
            expiry: Date.now() + (2 * 60 * 1000)
        };

        return opts;
    }, { body: t.Object({ name: t.String() }), cookie: t.Cookie({ session: t.String() }) })

    .post('/api/auth/webauthn/register/verify', async ({ body, headers: { origin }, cookie: { session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!isWebAuthnConfigured) return status(404);
        if (!origin) return status(404);

        if (!sessionDB.has(session.value)) return status(401, { error: 'not logged in' });

        const currentChallenge = currentRegistrations[session.value];
        if (!currentChallenge || currentChallenge.expiry < Date.now())
            return status(400, { error: 'challenge has expired, please try registering again' });

        const passableBody = { ...body } as { name?: string } & RegistrationResponseJSON;
        delete passableBody.name;

        let verification: VerifiedRegistrationResponse;

        try {
            verification = await verifyRegistrationResponse({
                response: passableBody,
                expectedChallenge: currentChallenge.value,
                expectedOrigin: origin,
                expectedRPID: Bun.env.RP_ID!
            });
        } catch (error) {
            console.error(error);
            return status(400, { error: (error as Error).message });
        }

        if (!verification.verified || !verification.registrationInfo) {
            return status(400, { error: 'could not verify registration' });
        }

        passkeyDB.add({
            id: verification.registrationInfo.credential.id,
            publicKey: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64'),
            counter: verification.registrationInfo.credential.counter,
            transports: verification.registrationInfo.credential.transports || [],
            deviceType: verification.registrationInfo.credentialDeviceType || 'unknown',
            backedUp: verification.registrationInfo.credentialBackedUp || false,
            lastUsed: 0,
            name: currentChallenge.name
        });

        delete currentRegistrations[session.value];

        return { verified: true };
    }, {
        body: t.Object({
            id: t.String(),
            rawId: t.String(),
            response: t.Object({
                clientDataJSON: t.String(),
                attestationObject: t.String(),
                authenticatorData: t.Optional(t.String()),
                transports: t.Optional(
                    t.Array(
                        t.Union([
                            t.Literal('ble'),
                            t.Literal('cable'),
                            t.Literal('hybrid'),
                            t.Literal('internal'),
                            t.Literal('nfc'),
                            t.Literal('smart-card'),
                            t.Literal('usb')
                        ])
                    )
                ),
                publicKeyAlgorithm: t.Optional(t.Number()),
                publicKey: t.Optional(t.String())
            }),
            authenticatorAttachment: t.Optional(t.String()),
            clientExtensionResults: t.Object({
                appid: t.Optional(t.Boolean()),
                hmacCreateSecret: t.Optional(t.Boolean()),
                credProps: t.Optional(t.Object({ rk: t.Optional(t.Boolean()) }))
            }),
            type: t.Literal('public-key')
        }),
        headers: t.Object({ origin: t.Optional(t.String()) }),
        cookie: t.Cookie({ session: t.String() })
    })

    .post('/api/auth/webauthn/login/options', async ({ cookie: { webauthn } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!isWebAuthnConfigured) return status(404);

        const options = await generateAuthenticationOptions({
            rpID: Bun.env.RP_ID!,
            userVerification: 'preferred'
        });

        webauthn.value = options.challenge;
        webauthn.httpOnly = true;
        webauthn.path = '/';
        webauthn.sameSite = 'strict';
        webauthn.secure = true;

        return options;
    })

    .post('/api/auth/webauthn/login/verify', async ({ body, headers: { origin }, cookie: { webauthn, session } }) => {
        if (configDB.db.locked) return status(423, { error: 'instance is locked' });
        if (!isWebAuthnConfigured) return status(404);
        if (!origin) return status(404);

        const passableBody = body as AuthenticationResponseJSON;

        const passkey = passkeyDB.get(body.id);
        if (!passkey) return status(401, { error: 'could not find passkey' });

        let verification: VerifiedAuthenticationResponse;

        try {
            verification = await verifyAuthenticationResponse({
                response: passableBody,
                expectedChallenge: webauthn.value,
                expectedOrigin: origin,
                expectedRPID: Bun.env.RP_ID!,
                credential: {
                    id: passkey.id,
                    publicKey: Buffer.from(passkey.publicKey, 'base64'),
                    counter: passkey.counter,
                    transports: passkey.transports
                }
            });
        } catch (error) {
            console.error(error);
            return status(400, { error: (error as Error).message });
        }

        if (!verification.verified) return status(400, { error: 'could not verify authentication' });

        passkeyDB.update(verification.authenticationInfo.credentialID, {
            counter: verification.authenticationInfo.newCounter,
            lastUsed: Date.now()
        });

        const newSession = crypto.randomBytes(32).toString('hex');
        sessionDB.add(newSession);

        session.value = newSession;
        session.httpOnly = true;
        session.path = '/';
        session.sameSite = 'strict';
        session.secure = true;

        webauthn.value = '';
        webauthn.httpOnly = true;
        webauthn.path = '/';
        webauthn.sameSite = 'strict';
        webauthn.maxAge = 0;
        webauthn.secure = true;

        return { loggedIn: true };
    }, {
        body: t.Object({
            id: t.String(),
            rawId: t.String(),
            response: t.Object({
                clientDataJSON: t.String(),
                authenticatorData: t.String(),
                signature: t.String(),
                userHandle: t.Optional(t.String())
            }),
            type: t.Literal('public-key')
        }),
        headers: t.Object({ origin: t.Optional(t.String()) }),
        cookie: t.Cookie({ webauthn: t.String() })
    })

export default auth;