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
const CHUNK_SIZE = 80 * 1024 * 1024;

class FileManager {
    tree: TreeNode = { name: '/', fullPath: '/', type: 'folder', children: [] };
    fileHistory: string[] = [];
    size: string = '0 bytes';

    numFiles: number = 0;
    maxSizeMB: number = 100;

    currentFilePath: string = '';

    dragHoverPath: string | null = null;
    isDraggingExternal: boolean = false;

    internalDragPath: string | null = null;
    internalDragHoverPath: string | null = null;

    creatingType: 'file' | 'folder' | null = null;
    creatingPath: string | null = null;

    sidebarOpen: boolean = typeof window !== 'undefined' && window.innerWidth < 768;

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

    private sendChunk(uploadId: string, path: string, chunkIndex: number, totalChunks: number, chunk: Blob, onProgress: (loaded: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('uploadId', uploadId);
            formData.append('path', path);
            formData.append('chunkIndex', String(chunkIndex));
            formData.append('totalChunks', String(totalChunks));
            formData.append('chunk', chunk);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/file/upload/chunk');

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(e.loaded);
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else {
                    try {
                        reject(new Error(JSON.parse(xhr.responseText)?.error || 'upload failed'));
                    } catch {
                        reject(new Error('upload failed'));
                    }
                }
            };

            xhr.onerror = () => reject(new Error('network error'));

            xhr.send(formData);
        });
    }

    async uploadFiles(files: FileList | File[], targetPath: string, useRelativePath = false) {
        const fileArray = Array.from(files);
        if (!fileArray.length) return;

        const entries = fileArray.map(file => {
            const relativePath = useRelativePath && (file as any).webkitRelativePath
                ? (file as any).webkitRelativePath
                : file.name;
            return { file, path: targetPath === '/' ? `/${relativePath}` : `${targetPath}/${relativePath}` };
        });

        const totalBytes = entries.reduce((sum, e) => sum + e.file.size, 0) || 1;

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

        let doneBytes = 0;

        try {
            for (const entry of entries) {
                const uploadId = crypto.randomUUID();
                const totalChunks = Math.max(1, Math.ceil(entry.file.size / CHUNK_SIZE));
                let fileLoaded = 0;

                for (let i = 0; i < totalChunks; i++) {
                    const chunk = entry.file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, entry.file.size));
                    await this.sendChunk(uploadId, entry.path, i, totalChunks, chunk, (loaded) => {
                        task.progress = Math.round(((doneBytes + fileLoaded + loaded) / totalBytes) * 100);
                    });
                    fileLoaded += chunk.size;
                }

                doneBytes += entry.file.size;
            }

            task.progress = 100;
            task.status = 'done';
        } catch (err) {
            task.status = 'error';
            task.error = err instanceof Error ? err.message : 'upload failed';
        }

        task.shownAt = Date.now();

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
            return;
        }

        this.currentFilePath = file;

        this.fileHistory.push(file);
    }
}

const fileManager = new FileManager();
export default fileManager;