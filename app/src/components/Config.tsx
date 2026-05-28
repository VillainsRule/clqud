import { observer } from 'mobx-react-lite';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';

import fileManager from '@/managers/FileManager';

import api from '@/lib/eden';

const Config = observer(function Config() {
    return (
        <div className='flex flex-col items-center w-5/6 gap-5 h-full overflow-y-auto'>
            <div className='flex justify-between flex-col text-center w-full'>
                <h1 className='text-2xl text-center font-bold'>clqud not so secret management and config controls 🤯🤯🤯</h1>

                <h2 className='text-lg text-center font-medium'>total files: {fileManager.numFiles}</h2>
                <h2 className='text-lg text-center font-medium'>file size: {fileManager.size}</h2>
            </div>

            <Separator orientation='horizontal' className='max-w-1/2' />

            <div className='flex items-center gap-3'>
                <Checkbox id='setLocked' checked={false} onCheckedChange={(isChecked) => {
                    api.admin.instance.lock.post({ locked: !!isChecked })
                        .then(() => location.reload());
                }} />

                <Label htmlFor='setLocked'>instance FULLY locked?</Label>
            </div>

            <div className='flex items-center gap-3'>
                <Label htmlFor='maxFileSize'>max file size</Label>
                <Slider id='maxFileSize' className='w-52' defaultValue={[fileManager.maxSizeMB]} min={1} max={250} onValueChange={(values) => {
                    api.admin.instance.maxSize.post({ maxSizeMB: values[0] }).then(() => {
                        fileManager.maxSizeMB = values[0];
                    });
                }} />
                <span className='w-16'>{fileManager.maxSizeMB} MB</span>
            </div>
        </div>
    )
});

export default Config;