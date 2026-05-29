import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import ChevronRight from 'lucide-react/icons/chevron-right';
import ChevronDown from 'lucide-react/icons/chevron-down';
import FileLock from 'lucide-react/icons/file-lock';
import Folder from 'lucide-react/icons/folder';

import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import fileManager from '@/managers/FileManager';

import { getExt, getName } from '@/shared/pathUtil';
import { codeExtensions, getFileIcon } from '@/lib/utils';

import api, { errorFrom } from '@/lib/eden';
import { shadd } from '@/lib/shadd';

import type { TreeNode } from '@/types';

let globalExpandTimer: ReturnType<typeof setTimeout> | null = null;

function setInternalDragHover(path: string | null, expandFn?: () => void) {
    if (fileManager.internalDragHoverPath === path) return;

    if (globalExpandTimer) {
        clearTimeout(globalExpandTimer);
        globalExpandTimer = null;
    }

    fileManager.setInternalDragHover(path);

    if (path && expandFn) globalExpandTimer = setTimeout(() => {
        expandFn();
        globalExpandTimer = null;
    }, 1000);
}

interface FileTreeItemProps {
    node: TreeNode
    level: number
}

const validateName = (input: string, nodeType: 'folder' | 'file'): boolean => {
    const parts = input.split('/');

    if (!input.trim()) return false;
    else if (input.includes(' ')) return false;
    else if (parts[parts.length - 1].startsWith('.')) return false;
    else if (input.endsWith('.auth') || input.endsWith('.')) return false;
    else if (nodeType === 'folder' && input.includes('.')) return false;
    else if (nodeType === 'file' && input.includes('..')) return false;
    return true;
}

const FileTreeItem = observer(function FileTreeItem({ node, level }: FileTreeItemProps) {
    const navigate = useNavigate();

    const [isExpanded, setIsExpanded] = useState(level === 0);
    const [isRenaming, setIsRenaming] = useState(false);
    const [nameValid, setNameValid] = useState(true);
    const [renamedName, setRenamedName] = useState('');
    const [createdName, setCreatedName] = useState('');

    const [modifyingPassword, setModifyingPassword] = useState<'adding' | 'changing' | ''>('');
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const passwordButtonRef = useRef<HTMLButtonElement>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const isCreatingInThisFolder = fileManager.creatingType && fileManager.creatingPath === node.fullPath;
    const inferredExtension = getExt(node.name);

    const isExternalDropTarget = fileManager.isDraggingExternal && node.type === 'folder' && fileManager.dragHoverPath === node.fullPath;
    const isInternalDropTarget = node.type === 'folder' && fileManager.internalDragHoverPath === node.fullPath && fileManager.internalDragPath !== node.fullPath;
    const isDropTarget = isExternalDropTarget || isInternalDropTarget;

    const handleDragStart = (e: React.DragEvent) => {
        fileManager.internalDragPath = node.fullPath;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.fullPath);
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent, targetPath: string) => {
        if (fileManager.isDraggingExternal) {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            e.stopPropagation();
            fileManager.uploadFiles(e.dataTransfer.files, targetPath).then(() => {
                fileManager.isDraggingExternal = false;
                fileManager.dragHoverPath = null;
            });
            setIsExpanded(true);
            return;
        }

        const draggedPath = fileManager.internalDragPath ?? e.dataTransfer.getData('text/plain');
        if (!draggedPath) return;
        if (draggedPath === targetPath) return;
        if (targetPath.startsWith(draggedPath + '/')) return;

        e.preventDefault();
        e.stopPropagation();

        fileManager.moveFile(draggedPath, targetPath);
        setIsExpanded(true);
        setInternalDragHover(null);
        fileManager.internalDragPath = null;
    };

    const handleCreateFile = async () => {
        if (!createdName.trim()) return fileManager.setCreating(null);

        const fullPath = node.fullPath === '/'
            ? `/${createdName}`
            : `${node.fullPath}/${createdName}`;

        api.file.create.post({ path: fullPath, type: fileManager.creatingType || 'file' }).then(() => {
            fileManager.fetchTree();
            fileManager.setCreating(null);
        }).catch(() => alert(`failed to create ${fileManager.creatingType === 'folder' ? 'folder' : 'file'}`));

        setCreatedName('');
        fileManager.setCreating(null);
    };

    const handleRename = () => {
        if (!renamedName.trim()) {
            setIsRenaming(false);
            return;
        }

        setIsRenaming(false);
        fileManager.renameFile(node.fullPath, renamedName.trim());
    };

    const startRenaming = () => {
        setRenamedName(node.name);
        setIsRenaming(true);

        setTimeout(() => {
            if (renameInputRef.current) {
                renameInputRef.current.focus();
                renameInputRef.current.setSelectionRange(0, getName(node.name).length);
            }
        }, 0);
    };

    if (isRenaming) return (
        <div
            className={'flex w-full items-center gap-1 py-1.5 px-3 text-md rounded-md transition-colors text-left bg-accent'}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
        >
            <span className='min-w-4' />
            {node.type === 'folder' ? <Folder className='h-4 w-4 shrink-0 text-muted-foreground' /> : getFileIcon(inferredExtension)}
            <Input
                ref={renameInputRef}
                value={renamedName}
                onChange={(e) => {
                    setRenamedName(e.target.value);
                    setNameValid(validateName(e.target.value, node.type));
                }}
                onKeyUp={(e) => {
                    if (e.key === 'Enter' && nameValid) handleRename();
                    else if (e.key === 'Escape') setIsRenaming(false);
                }}
                onBlur={handleRename}
                placeholder={node.type === 'folder' ? 'folder name' : 'file name'}
                className={`h-6 text-md border-0 ring-0 focus-visible:ring-0 p-0 bg-transparent flex-1 ${!nameValid ? 'text-red-500' : ''}`}
            />
        </div>
    );

    return (<>
        <div style={isDropTarget ? { outline: '2px solid var(--primary)', outlineOffset: '-2px', borderRadius: '6px' } : {}}>
            <ContextMenu>
                <ContextMenuTrigger>
                    <button
                        draggable={level > 0}
                        onClick={() => node.type === 'folder' ? setIsExpanded(!isExpanded) : (fileManager.select(node.fullPath), navigate('/&/file'))}
                        onDragStart={level > 0 ? handleDragStart : undefined}
                        onDragEnd={level > 0 ? () => (fileManager.internalDragPath = null, setInternalDragHover(null)) : undefined}
                        onDragEnter={(e) => {
                            if (node.type !== 'folder') return;

                            if (fileManager.isDraggingExternal) {
                                e.preventDefault();
                                e.stopPropagation();
                                fileManager.dragHoverPath = node.fullPath;
                                if (globalExpandTimer) clearTimeout(globalExpandTimer);
                                globalExpandTimer = setTimeout(() => { setIsExpanded(true); globalExpandTimer = null; }, 1000);
                                return;
                            }

                            if (fileManager.internalDragPath && fileManager.internalDragPath !== node.fullPath && !node.fullPath.startsWith(fileManager.internalDragPath + '/')) {
                                e.preventDefault();
                                e.stopPropagation();
                                setInternalDragHover(node.fullPath, () => setIsExpanded(true));
                            }
                        }}
                        onDragLeave={(e) => {
                            if (e.currentTarget.contains(e.relatedTarget as Node)) return;

                            if (fileManager.isDraggingExternal && fileManager.dragHoverPath === node.fullPath) {
                                fileManager.dragHoverPath = null;
                                if (globalExpandTimer) { clearTimeout(globalExpandTimer); globalExpandTimer = null; }
                                return;
                            }

                            if (fileManager.internalDragHoverPath === node.fullPath)
                                setInternalDragHover(null);
                        }}
                        onDragOver={(e) => {
                            if (node.type !== 'folder') return;

                            if (fileManager.isDraggingExternal) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'copy';
                                return;
                            }

                            if (
                                fileManager.internalDragPath &&
                                fileManager.internalDragPath !== node.fullPath &&
                                !node.fullPath.startsWith(fileManager.internalDragPath + '/')
                            ) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'move';
                            }
                        }}
                        onDrop={(e) => node.type === 'folder' && handleDrop(e, node.fullPath)}
                        className='flex w-full items-center py-1.5 px-3 text-md hover:bg-accent hover:text-accent-foreground rounded-md transition-colors text-left justify-between'
                        style={{ paddingLeft: `${level * 16 + 12}px` }}
                    >
                        <span className='flex items-center gap-2 w-full'>
                            {node.type === 'folder' ? (<>
                                {isExpanded ? <ChevronDown className='h-4 w-4 shrink-0 text-muted-foreground' /> : <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground' />}
                                <Folder className='h-4 w-4 shrink-0 text-muted-foreground' />
                            </>) : (<>
                                <span className='min-w-4' />
                                <span className='min-w-4'>{getFileIcon(inferredExtension)}</span>
                            </>)}
                            <span className='text-ellipsis whitespace-nowrap'>{node.name}</span>
                        </span>

                        {node.type === 'file' && node.locked && <FileLock className='min-w-4 max-w-4' />}
                    </button>
                </ContextMenuTrigger>

                {node.type === 'folder' ? <ContextMenuContent className='p-2'>
                    <ContextMenuItem onClick={() => { fileManager.setCreating('folder', node.fullPath); setIsExpanded(true); }}>New Folder</ContextMenuItem>
                    <ContextMenuItem onClick={() => { fileManager.setCreating('file', node.fullPath); setIsExpanded(true); }}>New File</ContextMenuItem>
                    <ContextMenuItem onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.onchange = () => {
                            if (!input.files) return;
                            setIsExpanded(true);
                            fileManager.uploadFiles(input.files, node.fullPath);
                        };
                        input.click();
                    }}>Upload File(s)</ContextMenuItem>
                    <ContextMenuItem onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.webkitdirectory = true;
                        input.onchange = () => {
                            if (!input.files) return;
                            setIsExpanded(true);
                            fileManager.uploadFiles(input.files, node.fullPath, true);
                        };
                        input.click();
                    }}>Upload Folder</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(node.fullPath + '/')}>Copy Path</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => startRenaming()}>Rename</ContextMenuItem>
                    <ContextMenuItem className='text-red-500' onClick={() => {
                        shadd.confirm('delete folder', 'are you sure you want to delete this directory and EVERYTHING INSIDE? this CANNOT be undone!', () => {
                            api.file.delete.post({ path: node.fullPath }).then(() => {
                                fileManager.fetchTree();
                                fileManager.fileBar = fileManager.fileBar.filter(e => e !== node.fullPath);
                                fileManager.fileHistory = fileManager.fileHistory.filter(e => e !== node.fullPath);
                            })
                        });
                    }}>Delete</ContextMenuItem>
                </ContextMenuContent> : <ContextMenuContent className='p-2'>
                    <ContextMenuItem onClick={() => window.open(location.origin + node.fullPath)}>Open in New Tab</ContextMenuItem>
                    <ContextMenuItem onClick={() => window.open(location.origin + node.fullPath + '?d')}>Download</ContextMenuItem>
                    {codeExtensions.includes(inferredExtension) && <ContextMenuItem onClick={async () => {
                        fetch('/api/file/pull/contents', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: fileManager.currentFilePath })
                        }).then(res => res.text()).then(text => navigator.clipboard.writeText(text)).catch(() => alert('failed to load file content'));
                    }}>Copy Contents</ContextMenuItem>}
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(node.fullPath)}>Copy Path</ContextMenuItem>
                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(location.origin + node.fullPath)}>Copy URL</ContextMenuItem>
                    <ContextMenuSeparator />
                    {node.locked ? <>
                        <ContextMenuItem onClick={() => setModifyingPassword('changing')}>Change Password</ContextMenuItem>
                        <ContextMenuItem onClick={() => api.file.password.remove.post({ path: node.fullPath }).then(() => fileManager.fetchTree())}>Remove Password</ContextMenuItem>
                    </> : <ContextMenuItem onClick={() => setModifyingPassword('adding')}>Add Password</ContextMenuItem>}
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => startRenaming()}>Rename</ContextMenuItem>
                    <ContextMenuItem className='text-red-500' onClick={() => {
                        shadd.confirm('delete file?', 'are you sure you want to delete this file? this CANNOT be undone!', () => {
                            api.file.delete.post({ path: node.fullPath }).then(() => {
                                fileManager.fetchTree();
                                fileManager.fileBar = fileManager.fileBar.filter(e => e !== node.fullPath);
                                fileManager.fileHistory = fileManager.fileHistory.filter(e => e !== node.fullPath);
                                if (fileManager.currentFilePath === node.fullPath) { fileManager.select(''); navigate('/&'); }
                            })
                        });
                    }}>Delete</ContextMenuItem>
                </ContextMenuContent>}
            </ContextMenu>

            {node.type === 'folder' && isExpanded && node.children && <div
                onDragEnter={(e) => {
                    if (fileManager.isDraggingExternal) {
                        e.preventDefault();
                        e.stopPropagation();
                        fileManager.dragHoverPath = node.fullPath;
                        return;
                    }
                    if (fileManager.internalDragPath && fileManager.internalDragPath !== node.fullPath && !node.fullPath.startsWith(fileManager.internalDragPath + '/')) {
                        e.stopPropagation();
                        setInternalDragHover(node.fullPath, () => setIsExpanded(true));
                    }
                }}
                onDragOver={(e) => {
                    if (fileManager.isDraggingExternal) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'copy';
                        return;
                    }
                    if (fileManager.internalDragPath && fileManager.internalDragPath !== node.fullPath && !node.fullPath.startsWith(fileManager.internalDragPath + '/')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                    }
                }}
                onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (fileManager.isDraggingExternal && fileManager.dragHoverPath === node.fullPath) { fileManager.dragHoverPath = null; return; }
                    if (fileManager.internalDragHoverPath === node.fullPath) setInternalDragHover(null);
                }}
                onDrop={(e) => handleDrop(e, node.fullPath)}
            >
                {isCreatingInThisFolder && (
                    <div
                        className={'flex w-full items-center gap-2 py-1.5 px-3 text-md rounded-md transition-colors text-left bg-accent'}
                        style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}
                    >
                        <span className='w-4' />
                        <Input
                            ref={inputRef}
                            autoFocus
                            value={createdName}
                            onChange={(e) => {
                                setCreatedName(e.target.value);
                                setNameValid(validateName(e.target.value, fileManager.creatingType!));
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && nameValid) handleCreateFile();
                                else if (e.key === 'Escape') { setCreatedName(''); fileManager.setCreating(null); }
                            }}
                            onBlur={handleCreateFile}
                            placeholder={fileManager.creatingType === 'folder' ? 'folder name' : 'file name'}
                            className={`h-6 text-md border-0 ring-0 focus-visible:ring-0 p-0 bg-transparent flex-1 ${!nameValid ? 'text-red-500' : ''}`}
                        />
                    </div>
                )}

                {[...node.children].sort((a, b) => {
                    if (a.type === 'folder' && b.type !== 'folder') return -1;
                    if (a.type !== 'folder' && b.type === 'folder') return 1;
                    return a.name.localeCompare(b.name);
                }).map(child => (
                    <FileTreeItem key={child.fullPath} node={child} level={level + 1} />
                ))}
            </div>}
        </div>

        <Dialog open={!!modifyingPassword} onOpenChange={(isOpen) => !isOpen && setModifyingPassword('')}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{modifyingPassword === 'adding' ? 'add' : 'change'} file password</DialogTitle>
                    <DialogDescription>{modifyingPassword === 'adding' ? 'add a password required to view this file.' : 'change the password required to view this file.'}</DialogDescription>
                </DialogHeader>
                <Input placeholder='password' className='w-full mb-4' maxLength={64} minLength={2} ref={passwordInputRef} onKeyUp={(e) => e.key === 'Enter' && passwordButtonRef.current!.click()} />
                <Button className='w-3/4' ref={passwordButtonRef} onClick={async () => {
                    const options = await api.file.password.set.post({ path: node.fullPath, password: passwordInputRef.current!.value });
                    if (options.data) { if (modifyingPassword === 'adding') fileManager.fetchTree(); setModifyingPassword(''); }
                    else alert(errorFrom(options));
                }}>submit</Button>
            </DialogContent>
        </Dialog>
    </>);
});

const SideBar = observer(function SideBar() {
    const navigate = useNavigate();

    return (
        <div className='border-neutral-200 min-w-88 max-w-88 h-full hidden md:flex flex-col px-6 py-6 left-0 top-0 bottom-0 z-20'>
            <div className='flex justify-center cursor-pointer items-center w-full mb-4 select-none' onClick={() => navigate('/')}>
                <h1 className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</h1>
            </div>

            <div className='h-full w-full overflow-y-scroll custom-scrollbar pr-2'>
                <FileTreeItem node={fileManager.tree} level={0} />
            </div>
        </div>
    );
});

export default SideBar;