import BasicDB from '../BasicDB';

export class SessionDB extends BasicDB<string[]> {
    constructor() {
        super('sessions.db', 1);
    }

    initializeData(): void {
        this.db = [];
    }

    add(sessionId: string) {
        this.db.push(sessionId);
        this.updateDB();
    }

    has(sessionId: string) {
        return this.db.includes(sessionId);
    }

    remove(sessionId: string) {
        this.db = this.db.filter(s => s !== sessionId);
        this.updateDB();
    }

    clear() {
        this.db = [];
        this.updateDB();
    }
}

const sessionDB = new SessionDB();
export default sessionDB;