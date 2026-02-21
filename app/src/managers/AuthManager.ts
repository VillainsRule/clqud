import { configure, makeAutoObservable } from 'mobx';

import api from '@/lib/eden';
import { getRelativeTime } from '@/lib/utils';

import type { PublicPasskey } from '@/types';
import fileManager from './FileManager';

configure({ enforceActions: 'never' });

class AuthManager {
    hasInit = false;
    loggedIn = false;

    passkeys: PublicPasskey[] = [];

    locked = false;
    webAuthnEnabled = false;
    isDev = false;

    constructor() {
        makeAutoObservable(this);
    }

    setAuth() {
        this.loggedIn = true;

        if (localStorage.getItem('resavePasskeys')) {
            this.fetchPasskeys();
            localStorage.removeItem('resavePasskeys');
        }

        fileManager.fetchTree();
    }

    async checkAuth() {
        try {
            const res = await api.auth.instance.get();
            this.hasInit = true;

            if (!res.data) return;
            if (res.data.isLocked) return this.locked = true;

            this.webAuthnEnabled = res.data.isWebAuthnConfigured;
            this.isDev = res.data.isDev;

            if (res.data.loggedIn) {
                fileManager.maxSizeMB = res.data.maxFileSize;
                this.setAuth();
            }
        } catch (error) {
            console.error('auth error', error);
            alert('error checking authentication, try reloading?');
        }
    }

    async fetchPasskeys() {
        const { data } = await api.auth.passkeys.get();
        if (!data) return;

        const passkeys = data.passkeys.map((pk: any) => {
            pk.lastUsed = getRelativeTime(pk.lastUsed);
            return pk;
        }) as PublicPasskey[];

        this.passkeys = passkeys;
        localStorage.setItem('passkeys', JSON.stringify(passkeys.map(e => ({ type: 'public-key', id: e.id, transports: e.transports }))));
    }

    async logout() {
        await api.auth.logout.post();
        location.reload();
    }
}

const authManager = new AuthManager();
export default authManager;