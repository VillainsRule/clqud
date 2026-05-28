import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import ChevronRight from 'lucide-react/icons/chevron-right';
import LogOut from 'lucide-react/icons/log-out';
import Wrench from 'lucide-react/icons/wrench';
import X from 'lucide-react/icons/x';

import fileManager from '@/managers/FileManager';

import { getExt, getNameExt } from '@/shared/pathUtil';
import { codeExtensions, getFileIcon } from '@/lib/utils';

import api from '@/lib/eden';

const TopBar = observer(function TopBar() {
    const navigate = useNavigate();

    const fileBarRef = useRef<HTMLDivElement>(null);

    const drag = useRef<{
        draggingFile: string;
        ghostEl: HTMLElement | null;
        dropIndex: number | null;
        indicatorEl: HTMLElement | null;
        originIndex: number;
    } | null>(null);

    useEffect(() => {
        if (!fileBarRef.current || !fileManager.currentFilePath) return;
        const bar = fileBarRef.current;
        const idx = fileManager.fileBar.indexOf(fileManager.currentFilePath);
        if (idx === -1) return;
        const tab = bar.children[idx] as HTMLElement | undefined;
        tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, [fileManager.currentFilePath]);

    const createGhost = (source: HTMLElement) => {
        const ghost = source.cloneNode(true) as HTMLElement;
        ghost.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            transition: none;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: rgba(255,255,255,0.3);
            backdrop-filter: blur(1px);
        `;
        const rect = source.getBoundingClientRect();
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
        ghost.style.top = rect.top + 'px';
        ghost.style.left = rect.left + 'px';
        document.body.appendChild(ghost);
        return ghost;
    }

    const createIndicator = () => {
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute;
            width: 1px;
            border-radius: 2px;
            background: var(--muted-foreground);
            pointer-events: none;
            z-index: 9998;
            top: 50%;
            height: 60%;
            transform: translateY(-50%);
            transition: left 80ms ease;
        `;
        return el;
    }

    const computeDropIndex = (clientX: number, clientY: number): number | null => {
        if (!fileBarRef.current) return null;
        const barRect = fileBarRef.current.getBoundingClientRect();

        if (clientY < barRect.top || clientY > barRect.bottom) return null;

        const tabs = Array.from(fileBarRef.current.children) as HTMLElement[];
        for (let i = 0; i < tabs.length; i++) {
            const rect = tabs[i].getBoundingClientRect();
            if (clientX < rect.left + rect.width / 2) return i;
        }
        return tabs.length;
    }

    const positionIndicator = (dropIndex: number | null): void => {
        const d = drag.current;
        if (!d?.indicatorEl || !fileBarRef.current) return;

        if (dropIndex === null) {
            d.indicatorEl.style.display = 'none';
            d.dropIndex = null;
            return;
        }

        d.indicatorEl.style.display = 'block';
        const tabs = Array.from(fileBarRef.current.children) as HTMLElement[];
        const barRect = fileBarRef.current.getBoundingClientRect();

        let left: number;
        if (dropIndex === 0) {
            const first = tabs[0]?.getBoundingClientRect();
            left = first ? first.left - barRect.left - 2 : 0;
        } else if (dropIndex >= tabs.length) {
            const last = tabs[tabs.length - 1]?.getBoundingClientRect();
            left = last ? last.right - barRect.left + 1 : 0;
        } else {
            const tab = tabs[dropIndex].getBoundingClientRect();
            left = tab.left - barRect.left - 2;
        }

        left += fileBarRef.current.scrollLeft;
        d.indicatorEl.style.left = left + 'px';
        d.dropIndex = dropIndex;
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, file: string) => {
        if (e.button !== 0) return;
        e.preventDefault();

        const source = e.currentTarget as HTMLElement;
        const ghost = createGhost(source);
        const indicator = createIndicator();

        if (fileBarRef.current) {
            fileBarRef.current.style.position = 'relative';
            fileBarRef.current.appendChild(indicator);
        }

        const originIndex = fileManager.fileBar.indexOf(file);

        drag.current = {
            draggingFile: file,
            ghostEl: ghost,
            dropIndex: originIndex,
            indicatorEl: indicator,
            originIndex,
        };

        const offsetX = e.clientX - source.getBoundingClientRect().left;
        const offsetY = e.clientY - source.getBoundingClientRect().top;

        positionIndicator(originIndex);

        function onMouseMove(ev: MouseEvent) {
            const d = drag.current;
            if (!d?.ghostEl) return;

            d.ghostEl.style.left = ev.clientX - offsetX + 'px';
            d.ghostEl.style.top = ev.clientY - offsetY + 'px';

            const newDrop = computeDropIndex(ev.clientX, ev.clientY);
            positionIndicator(newDrop);
        }

        const onMouseUp = () => {
            const d = drag.current;
            if (!d) return;

            d.ghostEl?.remove();
            d.indicatorEl?.remove();
            drag.current = null;

            const { draggingFile, dropIndex, originIndex } = d;

            if (dropIndex !== null && dropIndex !== originIndex && dropIndex !== originIndex + 1) {
                const bar = [...fileManager.fileBar];
                bar.splice(originIndex, 1);
                const adjustedDrop = dropIndex > originIndex ? dropIndex - 1 : dropIndex;
                bar.splice(adjustedDrop, 0, draggingFile);
                fileManager.fileBar = bar;
            }

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

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

        <div ref={fileBarRef} className='hidden md:flex relative items-center gap-2 min-h-11 no-scrollbar overflow-x-auto'>
            {fileManager.fileBar.map((file) => (
                <ContextMenu key={file}>
                    <ContextMenuTrigger asChild>
                        <div
                            className={`flex gap-1.5 items-center px-3 py-1 rounded-md text-sm cursor-pointer select-none shrink-0 ${fileManager.currentFilePath === file && 'border'}`}
                            onClick={() => fileManager.select(file)}
                            onMouseDown={(e) => handleMouseDown(e, file)}
                        >
                            {getFileIcon(getExt(file))}
                            <span className='ml-1'>{getNameExt(file)}</span>
                            <X
                                className='w-3 h-3 ml-2 text-muted-foreground hover:text-red-500'
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    fileManager.fileBar = fileManager.fileBar.filter(f => f !== file);
                                    if (fileManager.currentFilePath === file) {
                                        if (fileManager.fileBar.length > 0) {
                                            if (fileManager.fileHistory.reverse().some(f => {
                                                if (f !== file && fileManager.fileBar.includes(f)) {
                                                    fileManager.select(f);
                                                    return true;
                                                } else return false;
                                            })) return;
                                        }
                                        navigate('/&');
                                        fileManager.currentFilePath = '';
                                    }
                                }}
                            />
                        </div>
                    </ContextMenuTrigger>

                    <ContextMenuContent className='p-2'>
                        <ContextMenuItem onClick={() => window.open(location.origin + file)}>Open in New Tab</ContextMenuItem>
                        <ContextMenuItem onClick={() => window.open(location.origin + file + '?d')}>Download</ContextMenuItem>
                        {codeExtensions.includes(getExt(file)) && <ContextMenuItem onClick={async () => {
                            const req = await api.file.pull.contents.post({ path: file });
                            if (req.data) navigator.clipboard.writeText(req.data);
                        }}>Copy Contents</ContextMenuItem>}
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => navigator.clipboard.writeText(file)}>Copy Path</ContextMenuItem>
                        <ContextMenuItem onClick={() => navigator.clipboard.writeText(location.origin + file)}>Copy URL</ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>
            ))}
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