import BasicDB from '../BasicDB';

import { DBConfig } from '../../../../shared/types';

export class ConfigDB extends BasicDB<DBConfig> {
    constructor() {
        super('config.db', 1);
    }

    initializeData() {
        this.db = { locked: false, maxSizeMB: 100 };
    }

    updateConfig(newConfig: Partial<DBConfig>) {
        this.db = { ...this.db, ...newConfig };
        this.updateDB();
    }
}

const configDB = new ConfigDB();
export default configDB;