import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

export type DBId = string | number;

export interface DBPasskey {
    name: string;
    lastUsed: number;

    id: string; // from step 2
    publicKey: string; // from step 2
    counter: number; // from step 2
    transports: AuthenticatorTransportFuture[]; // from step 2
    deviceType: string; // from step 2
    backedUp: boolean; // from step 2
}

export interface PublicPasskey {
    id: string;
    name: string;
    lastUsed: string;
    transports: string[];
}

export interface DBConfig {
    password: string;
    locked: boolean;
    maxSizeMB: number;
}

export interface DBSession {
    id: string;
    session: string;
}

export interface PublicConfig {
    localChanges: boolean;
    isUsingSystemd: boolean;
}

export interface FolderNode {
    name: string;
    fullPath: string;
    type: 'folder';
    children: TreeNode[];
}

export interface FileNode {
    name: string;
    type: 'file';
    fullPath: string;
    locked?: boolean;
}

export type TreeNode = FolderNode | FileNode;