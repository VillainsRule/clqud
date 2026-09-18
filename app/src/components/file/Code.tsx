import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { Editor } from '@monaco-editor/react';

import fileManager from '@/managers/FileManager';

import api from '@/lib/eden';

const CodeViewer = observer(function CodeViewer() {
    const [content, setContent] = useState('');

    useEffect(() => {
        const requestedPath = fileManager.currentFilePath;
        setContent('');

        fetch('/api/file/pull/contents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: requestedPath })
        }).then(res => res.text()).then(text => {
            if (fileManager.currentFilePath === requestedPath) setContent(text);
        }).catch(() => {
            if (fileManager.currentFilePath === requestedPath) alert('failed to load file content');
        });
    }, [fileManager.currentFilePath]);

    return (
        <Editor className='h-full' theme={document.body.classList.contains('dark') ? 'vs-dark' : 'light'} path={fileManager.currentFilePath} options={{ minimap: { enabled: false } }} value={content} onChange={(value) => {
            if (value) {
                setContent(value!);
                api.file.edit.post({ path: fileManager.currentFilePath!, contents: value! });
            }
        }} />
    )
});

export default CodeViewer;