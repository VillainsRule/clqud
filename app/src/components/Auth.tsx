import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'

import { startAuthentication } from '@simplewebauthn/browser'

import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'

import api, { errorFrom } from '@/lib/eden'

import authManager from '@/managers/AuthManager'

const Auth = observer(function Auth() {
    const navigate = useNavigate();

    const [allowCredentials] = useState<any[]>(JSON.parse(localStorage.getItem('passkeys') || '[]'));
    const [showingAll, setShowingAll] = useState<boolean>(allowCredentials.length < 1);

    const [standardError, setStandardError] = useState<string>('');

    const passwordRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (authManager.loggedIn) navigate('/&');

        if (localStorage.getItem('dark')) {
            document.body.classList.add('dark');
        }
    }, []);

    const doWebAuthn = async () => {
        const res = await api.auth.webauthn.login.options.post({});
        if (!res.data) return alert(errorFrom(res));

        if (!showingAll) {
            res.data.allowCredentials = localStorage.getItem('internalTransport') ? allowCredentials.map(e => ({ ...e, transports: ['internal'] })) : allowCredentials;
            res.data.userVerification = 'required';
        }

        let assertionResp;
        try {
            assertionResp = await startAuthentication({ optionsJSON: res.data });
        } catch (err: any) {
            return setStandardError(err.toString().includes('NotAllowedError') ?
                'do it again and don\'t close the popup early :P' :
                'failed to complete passkey authentication. try again or sign in with another method.'
            );
        }

        api.auth.webauthn.login.verify.post(assertionResp).then((res) => {
            if (res.data) {
                location.reload();
                localStorage.setItem('resavePasskeys', '1');
            } else setStandardError(errorFrom(res));
        });
    }

    return (
        <div className='min-h-screen flex items-center justify-center'>
            <Card className='w-11/12 md:w-full max-w-md'>
                <CardHeader className='text-center flex flex-col items-center gap-1'>
                    <CardTitle className='text-3xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</CardTitle>
                    <CardDescription>clqud has only one password for the site admin.</CardDescription>
                </CardHeader>

                {showingAll ? <CardContent className='space-y-4'>
                    <div className='space-y-2'>
                        <Label htmlFor='password'>Password</Label>
                        <Input id='password' type='password' required ref={passwordRef} onKeyUp={(e) => e.key === 'Enter' && buttonRef.current!.click()} />
                    </div>

                    {standardError && <div className='text-red-500 text-sm'>{standardError}</div>}

                    <Button variant='outline' className='w-full cursor-pointer' ref={buttonRef} onClick={() => {
                        api.auth.account.post({
                            password: passwordRef.current!.value
                        }).then((res) => {
                            if (res.data) {
                                authManager.setAuth();
                                navigate('/&');
                            } else setStandardError(errorFrom(res));
                        })
                    }}>Log In</Button>

                    {authManager.webAuthnEnabled && <>
                        <div className='flex items-center'>
                            <div className='grow h-px bg-ring' />
                            <span className='mx-3 text-ring text-sm'>OR</span>
                            <div className='grow h-px bg-ring' />
                        </div>

                        <Button variant='outline' className='w-full cursor-pointer' onClick={doWebAuthn}>i have a passkey</Button>
                    </>}
                </CardContent> : <CardContent className='space-y-4'>
                    <div className='border-2 border-dashed bg-background p-6 text-center flex justify-center items-center w-full h-36 rounded-sm cursor-pointer hover:scale-101 transition-all duration-100' onClick={doWebAuthn}>
                        <span className='text-muted-foreground'>reauthenticate with your passkey</span>
                    </div>

                    {standardError && <div className='text-red-500 text-sm'>{standardError}</div>}

                    <Button variant='outline' className='w-full cursor-pointer' ref={buttonRef} onClick={() => setShowingAll(true)}>sign in with alternative method</Button>
                </CardContent>}
            </Card>
        </div>
    )
});

export default Auth;