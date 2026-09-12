import { observer } from 'mobx-react-lite';

import fileManager from '@/managers/FileManager';

const UploadQueue = observer(function UploadQueue() {
    if (!fileManager.uploads.length) return null;

    return (
        <div className='fixed bottom-5 right-5 z-50 w-80 bg-card border rounded-lg shadow-2xl overflow-hidden'>
            <div className='px-3 py-2 border-b text-sm font-medium flex justify-between items-center'>
                <span>upload queue</span>
                <span className='text-xs text-muted-foreground'>{fileManager.uploads.length}</span>
            </div>

            <div className='max-h-64 overflow-y-auto custom-scrollbar flex flex-col divide-y'>
                {fileManager.uploads.map(task => (
                    <div key={task.id} className='p-3'>
                        <div className='flex justify-between items-center gap-2 mb-1.5'>
                            <span className='text-sm truncate'>{task.label}</span>
                            <span className='text-xs text-muted-foreground shrink-0'>
                                {task.status === 'error' ? 'failed' : task.status === 'done' ? 'done' : task.status === 'queued' ? 'queued' : `${task.progress}%`}
                            </span>
                        </div>
                        <div className='h-1.5 w-full rounded-full bg-muted overflow-hidden'>
                            <div
                                className={`h-full rounded-full transition-all duration-150 ${task.status === 'error' ? 'bg-destructive' : task.status === 'queued' ? 'bg-muted-foreground/40' : 'bg-primary'}`}
                                style={{ width: task.status === 'queued' ? '100%' : `${task.progress}%` }}
                            />
                        </div>
                        {task.status === 'error' && task.error && <div className='text-xs text-destructive mt-1.5 truncate' title={task.error}>{task.error}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
});

export default UploadQueue;
