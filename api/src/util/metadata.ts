const BYTES = [
    { name: 'passwordLength', type: 'uint8' as const }, // 0-255
    { name: 'password', type: 'string' as const, lengthField: 'passwordLength' }
] as const;

type ByteFieldName = typeof BYTES[number]['name'];

type ByteFieldType = {
    [K in typeof BYTES[number]as K['name']]: K['type'] extends 'uint8' ? number :
    K['type'] extends 'string' ? string :
    any;
};

class Metadata {
    private data: Map<ByteFieldName, any>;

    constructor(initialData?: Buffer) {
        this.data = new Map();

        if (initialData) this.fromBytes(initialData);
    }

    set<K extends ByteFieldName>(key: K, value: ByteFieldType[K]): void {
        this.data.set(key, value);
    }

    get<K extends ByteFieldName>(key: K): ByteFieldType[K] | undefined {
        return this.data.get(key);
    }

    setPasswordLength(length: number): void {
        this.data.set('passwordLength', length);
    }

    getPasswordLength(): number | undefined {
        return this.data.get('passwordLength');
    }

    setPassword(password: string): void {
        this.data.set('password', password);
        this.data.set('passwordLength', password.length);
    }

    getPassword(): string | undefined {
        return this.data.get('password');
    }

    toBytes(): Buffer {
        const buffers: Buffer[] = [];

        for (const field of BYTES) {
            const value = this.data.get(field.name);

            if (field.type === 'uint8') {
                const buf = Buffer.alloc(1);
                buf.writeUInt8(value || 0, 0);
                buffers.push(buf);
            } else if (field.type === 'string') {
                const lengthField = (field as any).lengthField;
                const length = lengthField ? this.data.get(lengthField) || 0 : 0;
                if (length > 0 && value) {
                    buffers.push(Buffer.from(value, 'utf8'));
                }
            }
        }

        return Buffer.concat(buffers);
    }

    fromBytes(buffer: Buffer): any {
        let offset = 0;

        for (const field of BYTES) {
            if (field.type === 'uint8') {
                const value = buffer.readUInt8(offset);
                this.set(field.name, value);
                offset += 1;
            } else if (field.type === 'string') {
                const lengthField = (field as any).lengthField;
                const length = lengthField ? this.get(lengthField) || 0 : 0;
                if (length > 0) {
                    const value = buffer.subarray(offset, offset + length).toString('utf8');
                    this.set(field.name, value);
                    offset += length;
                }
            }
        }
    }
}

export { Metadata, BYTES };