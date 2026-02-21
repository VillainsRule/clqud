import { observer } from 'mobx-react-lite';

import { Button } from '@/components/shadcn/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select';

import labManager from '@/managers/LabManager';

const Labs = observer(function Labs() {
    return (
        <div className='flex flex-col justify-center gap-5 w-5/6 mt-5'>
            {Object.entries(labManager.experiments).map(([name]) => {
                const value = labManager.get(name);

                if (typeof value === 'boolean') return (
                    <div className='flex justify-between items-center w-full py-3 px-6 border rounded-md'>
                        <span className='font-bold text-lg'>{name}</span>
                        <Button onClick={() => labManager.set(name, !value)}>{value ? 'disable' : 'enable'}</Button>
                    </div>
                )

                return (
                    <div className='flex justify-between items-center w-full py-3 px-6 border rounded-md'>
                        <span className='font-bold text-lg'>{name}</span>

                        <Select value={value} onValueChange={(nv) => labManager.set(name, nv)}>
                            <SelectTrigger>
                                <SelectValue placeholder={`configure ${name}`} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {labManager.treatments[name].map((e) => <SelectItem value={e}>{e}</SelectItem>)}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                )
            })}
        </div>
    )
});

export default Labs;