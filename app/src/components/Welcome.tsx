import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import authManager from '@/managers/AuthManager'

const Welcome = observer(function Welcome() {
    const navigate = useNavigate();

    useEffect(() => {
        if (authManager.loggedIn) navigate('/&');
        if (localStorage.getItem('dark')) document.body.classList.add('dark');
    }, []);

    return (
        <div className='min-h-screen flex items-center justify-center'>
            <Card className='w-11/12 md:w-full max-w-md gap-3'>
                <CardHeader className='text-center flex flex-col items-center'>
                    <CardTitle className='text-5xl font-extrabold tracking-tight text-primary drop-shadow-md'>clqud</CardTitle>
                    <CardDescription className='text-lg mt-2'>clqud is a file hosting service.</CardDescription>
                    <CardDescription className='text-lg'>view the source on <a className='underline' target='_blank' href='https://github.com/VillainsRule/clqud'>github</a></CardDescription>
                </CardHeader>

                <CardContent className='space-y-4'>
                    <Button variant='outline' className='w-full cursor-pointer' onClick={() => navigate('/&/auth')}>sign in</Button>
                </CardContent>
            </Card>
        </div>
    )
});

export default Welcome;