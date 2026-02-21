import crypto from 'node:crypto';

const Hasher = {
    encode: (string: string): string => {
        const salt = crypto.randomBytes(16).toString('hex');
        const derivedKey = crypto.scryptSync(string, salt, 64);
        return salt + ':' + derivedKey.toString('hex');
    },
    matches: (input: string, against: string): boolean => {
        const [salt, key] = against.split(':');
        const derivedKey = crypto.scryptSync(input, salt, 64);
        return derivedKey.toString('hex') === key;
    }
};

export default Hasher;