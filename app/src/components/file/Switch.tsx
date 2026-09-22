import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import fileManager from '@/managers/FileManager';

import { getExt } from '@/shared/pathUtil';
import { getFileSize, getTypeFromExt } from '@/lib/utils';

import api from '@/lib/eden';

import AssetViewer from './Asset';
import CodeViewer from './Code';

const FileSwitch = observer(function FileSwitch() {
    const navigate = useNavigate();

    const [fileSpace, setFileSpace] = useState('');
    const [type, setType] = useState('');

    useEffect(() => {
        if (fileManager.currentFilePath) return;

        const hashPath = decodeURIComponent(location.hash.slice(1));
        if (hashPath) fileManager.select(hashPath.startsWith('/') ? hashPath : `/${hashPath}`);
        else navigate('/&');
    }, [fileManager.currentFilePath]);

    useEffect(() => {
        if (!fileManager.currentFilePath) return;

        const newHash = `#${fileManager.currentFilePath.replace(/^\//, '')}`;
        if (location.hash !== newHash) history.replaceState(null, '', location.pathname + newHash);
    }, [fileManager.currentFilePath]);

    useEffect(() => {
        if (!fileManager.currentFilePath) return;

        const nType = getTypeFromExt(getExt(fileManager.currentFilePath));

        if (nType === 'other') api.file.size.post({ path: fileManager.currentFilePath }).then((res) => {
            if (res.data) setFileSpace(getFileSize(res.data.size));
            else alert('failed to get file size');
        });

        setType(nType);
    }, [fileManager.currentFilePath]);

    if (!fileManager.currentFilePath) return;

    if (type === 'code') return <CodeViewer />;
    if (type === 'image' || type === 'audio' || type === 'video') return <AssetViewer />;
    else return <div className='text-center mt-5'>
        <div>this file does not have a built-in clqud parser.</div>
        <div>if you believe it should, open an issue on <a className='underline' target='_blank' href='https://github.com/VillainsRule/clqud'>the repository</a>.</div>
        <br />
        <div>this file occupies {fileSpace}.</div>
    </div>;
});

export default FileSwitch;
