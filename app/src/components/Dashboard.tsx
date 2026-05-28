import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import fileManager from '@/managers/FileManager';

const getTOD = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    else if (hour >= 12 && hour < 18) return 'afternoon';
    else return 'evening';
}

const Dashboard = observer(function Dashboard() {
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
        </div>
    )
});

export default Dashboard;