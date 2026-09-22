import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import fileManager from '@/managers/FileManager';

import { getExt } from '@/shared/pathUtil';
import { audioExtensions, imageExtensions, videoExtensions } from '@/lib/utils';

import api from '@/lib/eden';

const AssetViewer = observer(function AssetViewer() {
    const navigate = useNavigate();

    const [type, setType] = useState<'image' | 'audio' | 'video' | ''>('');
    const [directLink, setDirectLink] = useState('');

    useEffect(() => {
        const requestedPath = fileManager.currentFilePath;

        setType('');
        setDirectLink('');

        const inferredExt = getExt(requestedPath);
        if (imageExtensions.includes(inferredExt)) setType('image');
        else if (videoExtensions.includes(inferredExt)) setType('video');
        else if (audioExtensions.includes(inferredExt)) setType('audio');

        api.file.pull.url.post({ path: requestedPath }).then((res) => {
            if (fileManager.currentFilePath !== requestedPath) return;
            if (res.data) setDirectLink(res.data.url);
            else {
                fileManager.select('');
                navigate('/&');
            }
        });
    }, [fileManager.currentFilePath]);

    return (
        <div className='w-full h-full flex items-center justify-center overflow-hidden px-3'>
            {type === 'image' ? <img src={directLink} alt={fileManager.currentFilePath} className='max-h-full max-w-full object-contain rounded-sm' /> :
                type === 'video' ? <video src={directLink} controls className='max-h-full max-w-full object-contain rounded-sm' /> :
                    type === 'audio' ? <audio src={directLink} controls className='w-[50%] mt-5' /> :
                        <>cannot preview this type of file</>}
        </div>
    )
});

export default AssetViewer;