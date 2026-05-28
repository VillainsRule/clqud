export interface DBConfig {
    locked: boolean;
    maxSizeMB: number;
}

export interface DBSession {
    id: string;
    session: string;
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