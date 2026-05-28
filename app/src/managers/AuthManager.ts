import { configure, makeAutoObservable } from 'mobx';

import api from '@/lib/eden';

import fileManager from './FileManager';

configure({ enforceActions: 'never' });

class AuthManager {
    hasInit = false;
    loggedIn = false;

    locked = false;
    redirect = '';

    constructor() {
        makeAutoObservable(this);
    }

    async checkAuth() {
        try {
            const res = await api.auth.instance.get();
            this.hasInit = true;

            if (!res.data) return;

            this.locked = res.data.isLocked;
            this.redirect = res.data.redirect;
            this.loggedIn = res.data.loggedIn;

            if (res.data.loggedIn) {
                fileManager.maxSizeMB = res.data.maxFileSize;
                fileManager.fetchTree();
            }
        } catch (error) {
            console.error('auth error', error);
            alert('error checking authentication, try reloading?');
        }
    }
}

const authManager = new AuthManager();
export default authManager;