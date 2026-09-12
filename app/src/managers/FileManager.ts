import { makeAutoObservable } from 'mobx';

import { getFileSize } from '@/lib/utils';

import api from '@/lib/eden';

import type { TreeNode } from '@/types';

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

    constructor() {
        makeAutoObservable(this);
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
        const formData = new FormData();
        formData.append('files', new File([], '_forceArray.txt'));
        formData.append('paths', '');

        for (const file of files) {
            const relativePath = useRelativePath && (file as any).webkitRelativePath
                ? (file as any).webkitRelativePath
                : file.name;
            formData.append('files', file);
            formData.append('paths', targetPath === '/' ? `/${relativePath}` : `${targetPath}/${relativePath}`);
        }

        await fetch('/api/file/upload', { method: 'POST', body: formData });
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