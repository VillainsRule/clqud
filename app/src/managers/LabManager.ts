import { makeAutoObservable } from 'mobx';

class LabManager {
    experiments: Record<string, string> = {};
    treatments: Record<string, string[]> = {};

    constructor() {
        const allExperiments = Object.keys(localStorage).filter(e => e.startsWith('labs_'));
        allExperiments.forEach((e) => {
            const key = e.replace('labs_', '');
            this.experiments[key] = localStorage.getItem(e)!;
        });

        this.initExperiment('darkMode', '0');

        makeAutoObservable(this);
    }

    initExperiment(name: string, defaultValue: string, treatments?: string[]) {
        if (!this.experiments[name]) this.experiments[name] = defaultValue;
        if (treatments) this.treatments[name] = treatments;
    }

    get(name: string) {
        const value = this.experiments[name];
        if (value === '1') return true;
        else if (value === '0') return false;
        else return value;
    }

    set(name: string, value: string | boolean) {
        const v = typeof value === 'string' ? value : (+value).toString();
        this.experiments[name] = v;
        localStorage.setItem(`labs_${name}`, v);
    }
}

const labManager = new LabManager();
export default labManager;