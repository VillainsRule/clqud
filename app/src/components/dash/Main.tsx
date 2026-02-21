import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import Fingerprint from 'lucide-react/icons/fingerprint-pattern';
import LogOut from 'lucide-react/icons/log-out';
import Wrench from 'lucide-react/icons/wrench';

import authManager from '@/managers/AuthManager';
import fileManager from '@/managers/FileManager';

const getTOD = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    else if (hour >= 12 && hour < 18) return 'afternoon';
    else return 'evening';
}

const Main = observer(function Main() {
    const navigate = useNavigate();

    const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening'>(getTOD());

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeOfDay(getTOD());
        }, 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className='flex items-center flex-col gap-3 md:gap-6 h-full w-full mt-2 md:mt-16'>
            <div className='flex md:justify-center items-center flex-col md:flex-row gap-3 md:gap-9 w-full'>
                <div className='flex items-center flex-col text-center'>
                    <h1 className='text-4xl font-bold mb-1.5'>good {timeOfDay}, admin!</h1>
                    <h3 className='text-2xl font-medium'>clqud has {fileManager.numFiles} files totaling {fileManager.size}</h3>
                </div>
            </div>

            <div className='flex md:hidden flex-row gap-4 min-w-fit mt-2'>
                {authManager.webAuthnEnabled && <Fingerprint className='w-8 h-8 cursor-pointer text-accent-foreground' onClick={() => navigate('/user/passkeys')} />}
                {<Wrench className='w-8 h-8 cursor-pointer text-accent-foreground' onClick={() => navigate('/admin/config')} />}
                <LogOut className='w-8 h-8 cursor-pointer text-red-500' onClick={() => authManager.logout()} />
            </div>
        </div>
    )
});

export default Main;