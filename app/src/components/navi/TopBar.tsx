import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import LogOut from 'lucide-react/icons/log-out';
import Wrench from 'lucide-react/icons/wrench';

import fileManager from '@/managers/FileManager';

import { getExt } from '@/shared/pathUtil';
import { getFileIcon } from '@/lib/utils';

import api from '@/lib/eden';

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

export const Breadcrumb = observer(function Breadcrumb() {
    if (!fileManager.currentFilePath) return null;

    return (
        <div className='inline-flex items-center max-w-full mb-4 pl-3 pr-4 py-1.5 rounded-full bg-muted/60 text-sm w-fit'>
            {fileManager.currentFilePath.split('/').filter((part, i) => part !== '' || i === 0).map((part, i, segments) => {
                const isFile = i === segments.length - 1;
                return <div key={i} className='flex items-center min-w-0'>
                    {isFile && <span className='mr-1.5 shrink-0 opacity-80'>{getFileIcon(getExt(part))}</span>}
                    <span className={isFile ? 'font-medium text-foreground truncate' : 'text-muted-foreground truncate'}>{part === '' ? 'clqud' : part}</span>
                    {!isFile && <span className='text-muted-foreground/40 mx-1.5 select-none'>/</span>}
                </div>
            })}
        </div>
    );
});

export default TopBar;
