import BasicDB from '../BasicDB';

import { DBPasskey } from '../../../../shared/types';

export class PasskeyDB extends BasicDB<{ [id: string]: DBPasskey }> {
    constructor() {
        super('passkeys.db', 1);
    }

    initializeData() {
        this.db = {};
    }

    get(passkeyId: string) {
        return this.db[passkeyId];
    }

    add(passkey: DBPasskey) {
        this.db[passkey.id] = passkey;
        this.updateDB();
    }

    delete(passkeyId: string) {
        delete this.db[passkeyId];
        this.updateDB();
    }

    keys() {
        return Object.keys(this.db);
    }

    values() {
        return Object.values(this.db);
    }

    update(passkeyId: string, updatedFields: Partial<DBPasskey>) {
        const existing = this.db[passkeyId];
        if (!existing) return;

        this.db[passkeyId] = { ...existing, ...updatedFields };
        this.updateDB();
    }
}

const passkeyDB = new PasskeyDB();
export default passkeyDB;