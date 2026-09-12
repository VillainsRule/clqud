import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';

import Copy from 'lucide-react/icons/copy';
import Link2 from 'lucide-react/icons/link-2';
import LogOut from 'lucide-react/icons/log-out';
import Pencil from 'lucide-react/icons/pencil';
import Trash2 from 'lucide-react/icons/trash-2';
import Wrench from 'lucide-react/icons/wrench';

import fileManager from '@/managers/FileManager';

import { getExt, getName } from '@/shared/pathUtil';
import { getFileIcon } from '@/lib/utils';

import api from '@/lib/eden';
import { shadd } from '@/lib/shadd';

const TopBar = observer(function TopBar() {
    const navigate = useNavigate();

    return (
        <div className='flex justify-between items-center'>
            <h1 className='font-semibold text-lg'>welcome, admin!</h1>

            <div className='flex items-center gap-6 min-h-full'>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Wrench className='w-6 h-6 cursor-pointer text-accent-foreground' onClick={() => navigate('/&/config')} />
                    </TooltipTrigger>

                    <TooltipContent>Instance Config</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <LogOut className='w-6 h-6 cursor-pointer text-destructive' onClick={() => api.auth.logout.post().then(() => location.reload())} />
                    </TooltipTrigger>

                    <TooltipContent>Log Out</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
});

const actionButtonClass = 'p-1.5 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors';

export const Breadcrumb = observer(function Breadcrumb() {
    const navigate = useNavigate();

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    if (!fileManager.currentFilePath) return null;

    const path = fileManager.currentFilePath;
    const segments = path.split('/').filter((part, i) => part !== '' || i === 0);
    const fileName = segments[segments.length - 1];

    const startRenaming = () => {
        setRenameValue(fileName);
        setIsRenaming(true);

        setTimeout(() => {
            renameInputRef.current?.focus();
            renameInputRef.current?.setSelectionRange(0, getName(fileName).length);
        }, 0);
    };

    const submitRename = () => {
        setIsRenaming(false);
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== fileName) fileManager.renameFile(path, trimmed);
    };

    const handleDelete = () => {
        shadd.confirm('delete file?', 'are you sure you want to delete this file? this CANNOT be undone!', () => {
            api.file.delete.post({ path }).then(() => {
                fileManager.fetchTree();
                fileManager.fileHistory = fileManager.fileHistory.filter(e => e !== path);
                fileManager.select('');
                navigate('/&');
            });
        });
    };

    return (
        <div className='flex items-center gap-2 mb-3 max-w-full'>
            <div className='inline-flex items-center max-w-full pl-3 pr-4 py-1.5 rounded-full bg-muted/60 text-sm min-w-0'>
                {segments.map((part, i) => {
                    const isFile = i === segments.length - 1;

                    return <div key={i} className='flex items-center min-w-0'>
                        {isFile && <span className='mr-1.5 shrink-0 opacity-80'>{getFileIcon(getExt(part))}</span>}

                        {isFile && isRenaming ? (
                            <Input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') submitRename();
                                    else if (e.key === 'Escape') setIsRenaming(false);
                                }}
                                onBlur={submitRename}
                                className='h-6 text-sm border-0 rounded-none ring-0 focus-visible:ring-0 p-0 bg-transparent w-40 font-medium'
                            />
                        ) : (
                            <span className={isFile ? 'font-medium text-foreground truncate' : 'text-muted-foreground truncate'}>{part === '' ? 'clqud' : part}</span>
                        )}

                        {!isFile && <span className='text-muted-foreground/40 mx-1.5 select-none'>/</span>}
                    </div>
                })}
            </div>

            {!isRenaming && <div className='inline-flex items-center gap-0.5 shrink-0 p-1 rounded-full bg-muted/60'>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button className={actionButtonClass} onClick={() => navigator.clipboard.writeText(path)}>
                            <Copy className='w-3.75 h-3.75' />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Copy Path</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button className={actionButtonClass} onClick={() => navigator.clipboard.writeText(location.origin + path)}>
                            <Link2 className='w-3.75 h-3.75' />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Copy URL</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button className={actionButtonClass} onClick={startRenaming}>
                            <Pencil className='w-3.75 h-3.75' />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Rename</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button className={`${actionButtonClass} hover:bg-destructive/10 hover:text-destructive`} onClick={handleDelete}>
                            <Trash2 className='w-3.75 h-3.75' />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                </Tooltip>
            </div>}
        </div>
    );
});

export default TopBar;
