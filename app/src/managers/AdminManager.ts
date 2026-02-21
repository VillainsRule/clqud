import { makeAutoObservable } from 'mobx';

import api, { errorFrom } from '@/lib/eden';

import type { PublicConfig } from '@/types';

class AdminManager {
    instanceInformation: PublicConfig = {
        localChanges: true,
        isUsingSystemd: false
    };

    constructor() {
        makeAutoObservable(this);
    }

    async fetchInstanceInformation() {
        const req = await api.admin.instance.get();
        if (req.data) this.instanceInformation = req.data;
        else alert(errorFrom(req));
    }
}

const adminManager = new AdminManager();
export default adminManager;