import fs from 'node:fs';
import path from 'node:path';

const dbRootPath = path.join(import.meta.dirname, '..', '..', 'db');

class BasicDB<DBType> {
    path: string;
    db: DBType;

    constructor(filename: string, version: number = 1) {
        this.path = path.join(dbRootPath, `v${version}`, filename);

        let alreadyExisted = false;

        if (!fs.existsSync(this.path)) {
            fs.mkdirSync(path.dirname(this.path), { recursive: true });
            Bun.write(this.path, '');
            this.initializeData();
            this.updateDB();
        } else alreadyExisted = true;

        this.getDB();

        if (alreadyExisted) this.runDBMigrations();

        setInterval(() => this.updateDB(), 60_000);
        process.on('exit', () => this.updateDB());
    }

    initializeData() { }
    runDBMigrations() { }

    getDB() {
        let file = fs.readFileSync(this.path, 'utf-8');
        const parsedData = JSON.parse(file);
        this.db = parsedData;
    }

    updateDB() {
        Bun.write(this.path, JSON.stringify(this.db));
    }
}

export default BasicDB;