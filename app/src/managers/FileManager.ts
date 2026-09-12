import { makeAutoObservable } from 'mobx';

import { getFileSize } from '@/lib/utils';

import api from '@/lib/eden';

import type { TreeNode } from '@/types';

export interface UploadTask {
    id: string;
    label: string;
    progress: number;
    status: 'queued' | 'uploading' | 'done' | 'error';
    error?: string;
    shownAt: number;
}

const MAX_CONCURRENT_UPLOADS = 3;
const MAX_VISIBLE_UPLOADS = 3;
const MIN_SHOWN_MS = 2000;

class FileManager {
    tree: TreeNode = { name: '/', fullPath: '/', type: 'folder', children: [] };
    fileHistory: string[] = [];
    size: string = '0 bytes';

    numFiles: number = 0;
    maxSizeMB: number = 100;

    currentFilePath: string = '';
    currentFileContent: string = '';

    dragHoverPath: string | null = null;
    isDraggingExternal: boolean = false;

    internalDragPath: string | null = null;
    internalDragHoverPath: string | null = null;

    creatingType: 'file' | 'folder' | null = null;
    creatingPath: string | null = null;

    uploads: UploadTask[] = [];
    private activeUploads: number = 0;
    private uploadWaiters: (() => void)[] = [];

    constructor() {
        makeAutoObservable(this);
        setInterval(() => this.sweepUploads(), 500);
    }

    private sweepUploads() {
        const now = Date.now();
        while (this.uploads.length > MAX_VISIBLE_UPLOADS) {
            const idx = this.uploads.findIndex(t => (t.status === 'done' || t.status === 'error') && now - t.shownAt >= MIN_SHOWN_MS);
            if (idx === -1) break;
            this.uploads.splice(idx, 1);
        }
    }

    setCreating(type: 'file' | 'folder' | null, path?: string) {
        this.creatingType = type;
        this.creatingPath = path ?? null;
    }

    setInternalDragHover(path: string | null) {
        this.internalDragHoverPath = path;
    }

    async moveFile(draggedPath: string, targetFolderPath: string) {
        const fileName = draggedPath.split('/').pop()!;
        const newPath = targetFolderPath === '/' ? `/${fileName}` : `${targetFolderPath}/${fileName}`;
        if (newPath === draggedPath) return;

        await api.file.rename.post({ oldPath: draggedPath, newPath });
        await this.fetchTree();

        this.fileHistory = this.fileHistory.map(e => e === draggedPath ? newPath : e);
        if (this.currentFilePath === draggedPath) this.currentFilePath = newPath;
    }

    async renameFile(oldPath: string, newName: string) {
        const lastSlash = oldPath.lastIndexOf('/');
        const newPath = lastSlash > 0 ? oldPath.slice(0, lastSlash + 1) + newName : newName;

        await api.file.rename.post({ oldPath, newPath });
        await this.fetchTree();

        this.fileHistory = this.fileHistory.map(e => e === oldPath ? newPath : e);
        if (this.currentFilePath === oldPath) this.currentFilePath = newPath;
    }

    async uploadFiles(files: FileList | File[], targetPath: string, useRelativePath = false) {
        const fileArray = Array.from(files);
        if (!fileArray.length) return;

        const formData = new FormData();
        formData.append('files', new File([], '_forceArray.txt'));
        formData.append('paths', '');

        for (const file of fileArray) {
            const relativePath = useRelativePath && (file as any).webkitRelativePath
                ? (file as any).webkitRelativePath
                : file.name;
            formData.append('files', file);
            formData.append('paths', targetPath === '/' ? `/${relativePath}` : `${targetPath}/${relativePath}`);
        }

        this.uploads.push({
            id: crypto.randomUUID(),
            label: fileArray.length === 1 ? fileArray[0].name : `${fileArray.length} files`,
            progress: 0,
            status: 'queued',
            shownAt: Date.now()
        });
        const task = this.uploads[this.uploads.length - 1];

        if (this.activeUploads >= MAX_CONCURRENT_UPLOADS) await new Promise<void>(resolve => this.uploadWaiters.push(resolve));

        this.activeUploads++;
        task.status = 'uploading';

        await new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/file/upload');

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) task.progress = Math.round((e.loaded / e.total) * 100);
            };

            xhr.onload = () => {
                task.progress = 100;
                task.shownAt = Date.now();

                if (xhr.status >= 200 && xhr.status < 300) {
                    task.status = 'done';
                } else {
                    task.status = 'error';
                    try {
                        task.error = JSON.parse(xhr.responseText)?.error || 'upload failed';
                    } catch {
                        task.error = 'upload failed';
                    }
                }

                resolve();
            };

            xhr.onerror = () => {
                task.status = 'error';
                task.error = 'network error';
                task.shownAt = Date.now();
                resolve();
            };

            xhr.send(formData);
        });

        this.activeUploads--;
        this.uploadWaiters.shift()?.();

        await this.fetchTree();
    }

    async fetchTree() {
        const tree = await api.file.tree.get();
        if (tree.data) {
            this.tree = tree.data.node;
            this.numFiles = this.countFiles(this.tree);
            this.size = getFileSize(tree.data.size);
        }
    }

    countFiles(node: TreeNode): number {
        if (node.type === 'file') return 1;
        if (!node.children) return 0;
        return node.children.reduce((sum, child) => sum + this.countFiles(child), 0);
    }

    select(file: string) {
        if (file === '') {
            this.currentFilePath = '';
            this.currentFileContent = '';
            return;
        }

        this.currentFilePath = file;
        this.currentFileContent = '';

        this.fileHistory.push(file);
    }
}

const fileManager = new FileManager();
export default fileManager;