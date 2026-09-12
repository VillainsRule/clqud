import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import ChevronRight from 'lucide-react/icons/chevron-right';
import LogOut from 'lucide-react/icons/log-out';
import Wrench from 'lucide-react/icons/wrench';

import fileManager from '@/managers/FileManager';

import { getExt } from '@/shared/pathUtil';
import { getFileIcon } from '@/lib/utils';

import api from '@/lib/eden';

const TopBar = observer(function TopBar() {
    const navigate = useNavigate();

    return <>
        <div className='hidden md:flex justify-between items-center pt-6 z-30'>
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
                        <LogOut className='w-6 h-6 cursor-pointer text-red-500' onClick={() => api.auth.logout.post().then(() => location.reload())} />
                    </TooltipTrigger>

                    <TooltipContent>Log Out</TooltipContent>
                </Tooltip>
            </div>
        </div>

        <div className={fileManager.currentFilePath ? `hidden md:flex items-center pt-1 pb-5 text-sm` : 'hidden'}>
            {fileManager.currentFilePath.split('/').map((part, i) => {
                const isFile = i === fileManager.currentFilePath.split('/').length - 1;
                return <>
                    {isFile && getFileIcon(getExt(part))}
                    <div className={isFile ? 'ml-1.5' : ''}>{part === '' ? 'files' : part}</div>
                    {!isFile && <ChevronRight className='text-xs h-5' />}
                </>
            })}
        </div>
    </>
});

export default TopBar;