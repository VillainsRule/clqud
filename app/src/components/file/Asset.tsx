import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import fileManager from '@/managers/FileManager';

import { getExt } from '@/shared/pathUtil';
import { audioExtensions, imageExtensions, videoExtensions } from '@/lib/utils';

import api from '@/lib/eden';

const AssetViewer = observer(function AssetViewer() {
    const [type, setType] = useState<'image' | 'audio' | 'video' | ''>('');
    const [directLink, setDirectLink] = useState('');

    useEffect(() => {
        const inferredExt = getExt(fileManager.currentFilePath);
        if (inferredExt) {
            if (imageExtensions.includes(inferredExt)) setType('image');
            else if (videoExtensions.includes(inferredExt)) setType('video');
            else if (audioExtensions.includes(inferredExt)) setType('audio');
        }

        if (!fileManager.currentFileContent) {
            fileManager.currentFileContent = 'loading...';

            api.file.pull.url.post({ path: fileManager.currentFilePath }).then((res) => {
                if (res.data) setDirectLink(res.data.url);
                else alert('failed to load file content');
            });
        }
    }, [fileManager.currentFilePath]);

    return (
        <>
            {type === 'image' ? <img src={directLink} alt={fileManager.currentFilePath} className='max-h-full max-w-full object-contain' /> :
                type === 'video' ? <video src={directLink} controls className='max-h-full max-w-full object-contain' /> :
                    type === 'audio' ? <audio src={directLink} controls className='w-[50%] mt-5' /> : <>cannot preview this type of file</>}
        </>
    )
});

export default AssetViewer;