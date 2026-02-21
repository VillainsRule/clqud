import { useRef, useState } from 'react';

import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';

export default function Unlock() {
    const [error, setError] = useState<string>('');

    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
        <div className='flex flex-col justify-center items-center gap-2 h-screen w-screen'>
            <h1 className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</h1>
            <h2>this file requires a password to be opened</h2>

            <div className='flex gap-3 min-w-fit mt-1'>
                <Input autoComplete='off' placeholder='password' id='unlockPassword' onKeyDown={(k) => {
                    if (k.key === 'Enter') buttonRef.current?.click();
                }} />

                <Button ref={buttonRef} onClick={() => {
                    const pwInput = document.getElementById('unlockPassword') as HTMLInputElement;
                    if (!pwInput.value) return;

                    const u = `${location.pathname}?x=${btoa(pwInput.value)}`;
                    fetch(u, { redirect: 'manual' }).then((res) => {
                        if (res.status === 200) location.href = u;
                        else setError('incorrect password');
                    }).catch(() => setError('an error occurred while trying to unlock the file. try again.'));
                }}>open file</Button>
            </div>

            {error && <h2 className='text-red-500 mt-1'>{error}</h2>}

            <h2 className='italic mt-1 text-xs text-muted-foreground'>for a permanent link, keep the ?x parameter once authorized</h2>
        </div>
    )
}