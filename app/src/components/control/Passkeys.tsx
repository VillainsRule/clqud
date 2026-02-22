import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { startRegistration } from '@simplewebauthn/browser';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import authManager from '@/managers/AuthManager';

import Trash from 'lucide-react/icons/trash';

import api, { errorFrom } from '@/lib/eden';
import { shadd } from '@/lib/shadd';

const Passkeys = observer(function Passkeys() {
    const [internalTransport, setInternalTransport] = useState(!!localStorage.getItem('internalTransport'));

    useEffect(() => {
        if (authManager.loggedIn) authManager.fetchPasskeys();
    }, [authManager.hasInit]);

    const createPasskey = () => shadd.prompt(
        'add a new passkey',
        'name your passkey something you\'ll remember later, such as your device\'s name.',
        { placeholder: 'iCloud', maxLength: 24, minLength: 1 },
        async (value) => {
            const options = await api.auth.webauthn.register.options.post({
                name: value
            });

            if (!options.data) return alert(errorFrom(options));

            let attResp;

            try {
                attResp = await startRegistration({ optionsJSON: options.data });
            } catch (e) {
                console.error(e);
                return alert('an error occurred during passkey registration. please try again.');
            }

            const verifyRes = await api.auth.webauthn.register.verify.post(attResp);
            if (verifyRes.data) authManager.fetchPasskeys();
            else alert(errorFrom(verifyRes));
        }
    );

    return (
        <div className='flex flex-col items-center w-full h-full md:w-5/6 gap-5 overflow-y-auto custom-scrollbar mt-6'>
            <div className='flex justify-between items-center gap-3 md:gap-0 w-full flex-col md:flex-row'>
                <h2 className='text-2xl font-bold'>passkey manager</h2>

                <div className='flex gap-3'>
                    <Button className='w-56 py-2 rounded-md transition-colors duration-150' onClick={createPasskey}>add passkey</Button>
                </div>
            </div>

            {authManager.passkeys.length < 1 && <span className='text-muted-foreground text-sm text-center'>you have no passkeys. <span className='underline cursor-pointer' onClick={createPasskey}>create one!</span></span>}

            <div className='flex flex-col justify-center gap-5 w-full'>
                {authManager.passkeys.map((passkey) => (
                    <div className='flex justify-between items-center w-full py-3 px-6 border rounded-md'>
                        <span className='text-lg font-bold w-30'>{passkey.name}</span>
                        <span className='text-md text-muted-foreground'>{passkey.lastUsed === 'never' ? 'never used' : 'last used ' + passkey.lastUsed}</span>

                        <div className='flex gap-3'>
                            <Button variant='destructive' onClick={() => shadd.confirm(
                                'delete passkey',
                                `are you sure you want to delete the passkey "${passkey.name}"? this action cannot be undone.\n\nplease also note that this does not delete the passkey from your passkey manager; that must be done by you separately.`,
                                () => api.auth.passkeys.delete.post({ id: passkey.id }).then(() => authManager.fetchPasskeys())
                            )}>
                                <Trash className='h-4 w-4 md:hidden' />
                                <span className='hidden md:flex'>delete passkey</span>
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {
                authManager.passkeys.length >= 1 && <span className='flex gap-3 w-full'>
                    <Checkbox id='forceIT' checked={internalTransport} onCheckedChange={(isChecked) => {
                        if (isChecked) localStorage.setItem('internalTransport', '1');
                        else localStorage.removeItem('internalTransport');
                        setInternalTransport(!!isChecked);
                    }} />

                    <Label htmlFor='forceIT'>i exclusively use apple touchID passkeys</Label>
                </span>
            }
        </div >
    )
});

export default Passkeys;