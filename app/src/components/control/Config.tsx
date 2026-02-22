import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import Github from 'lucide-react/icons/github';
import KeyRound from 'lucide-react/icons/key-round';
import Power from 'lucide-react/icons/power';

import adminManager from '@/managers/AdminManager';
import authManager from '@/managers/AuthManager';
import fileManager from '@/managers/FileManager';

import api, { errorFrom } from '@/lib/eden';
import { shadd } from '@/lib/shadd';

const Config = observer(function Config() {
    const [gitOutput, setGitOutput] = useState<string>('');

    useEffect(() => {
        if (authManager.loggedIn) adminManager.fetchInstanceInformation();
    }, [authManager.hasInit]);

    return (
        <div className='flex flex-col items-center w-5/6 gap-5 h-full overflow-y-auto mt-6'>
            <div className='flex justify-between flex-col text-center w-full'>
                <h1 className='text-2xl text-center font-bold'>clqud not so secret management and config controls 🤯🤯🤯</h1>

                <h2 className='text-lg text-center font-medium'>total files: {fileManager.numFiles}</h2>
                <h2 className='text-lg text-center font-medium'>file size: {fileManager.size}</h2>

                {/* <h2 className='text-lg text-center font-medium mt-4'>instance commit: {adminManager.instanceInformation.commit}</h2> */}
                <h2 className='text-lg text-center font-medium'>has local changes?: {adminManager.instanceInformation.localChanges.toString()}</h2>
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

            <div className='flex justify-center gap-3'>
                <Tooltip>
                    <TooltipTrigger onClick={() => shadd.prompt(
                        'update the password',
                        'make this something you\'ll remember. if you forget it, you\'ll need to reset it using the clqud CLI.',
                        { placeholder: 'admin', maxLength: 64, minLength: 3 },
                        async (value) => {
                            const options = await api.admin.instance.password.post({ password: value });
                            if (options.data) location.reload();
                            else alert(errorFrom(options));
                        }
                    )}>
                        <Button className='md:hidden'><KeyRound /></Button>
                        <Button className='hidden md:flex'>set access password</Button>
                    </TooltipTrigger>

                    <TooltipContent>
                        <span>set password</span>
                    </TooltipContent>
                </Tooltip>

                {!adminManager.instanceInformation.localChanges && <Tooltip>
                    <TooltipTrigger onClick={() => {
                        api.admin.gitPull.post().then((res) => setGitOutput(res.data?.out || errorFrom(res)));
                    }}>
                        <Button className='md:hidden'><Github /></Button>
                        <Button className='hidden md:flex'>git pull</Button>
                    </TooltipTrigger>

                    <TooltipContent>
                        <span>git pull</span>
                    </TooltipContent>
                </Tooltip>}

                {adminManager.instanceInformation.isUsingSystemd && <Tooltip>
                    <TooltipTrigger onClick={() => {
                        api.admin.systemdRestart.post().then(() => {
                            shadd.alert('systemd restart triggered!', 'the app will reload in ~2 seconds.');
                            setTimeout(() => location.reload(), 2000);
                        });
                    }}>
                        <Button className='md:hidden'><Power /></Button>
                        <Button className='hidden md:flex'>restart app</Button>
                    </TooltipTrigger>

                    <TooltipContent>
                        <span>restart app</span>
                    </TooltipContent>
                </Tooltip>}
            </div>

            {gitOutput && <Dialog open={!!gitOutput} onOpenChange={(isOpen) => !isOpen && setGitOutput('')}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>git pull</DialogTitle>
                        <DialogDescription>command output or something</DialogDescription>
                    </DialogHeader>

                    <pre className='bg-neutral-900 text-neutral-100 p-4 rounded-lg max-h-[70vh] overflow-y-auto custom-scrollbar whitespace-pre-wrap'>{gitOutput}</pre>
                </DialogContent>
            </Dialog>}
        </div>
    )
});

export default Config;