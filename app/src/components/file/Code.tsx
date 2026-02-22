import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { Editor } from '@monaco-editor/react';

import fileManager from '@/managers/FileManager';

import api from '@/lib/eden';

const CodeViewer = observer(function CodeViewer() {
    const [content, setContent] = useState('');

    useEffect(() => {
        if (!fileManager.currentFileContent) {
            api.file.pull.contents.post({ path: fileManager.currentFilePath }).then((res) => {
                if (typeof res.data === 'string') setContent(res.data.toString());
                else alert('failed to load file content');
            });
        }
    }, [fileManager.currentFilePath]);

    return (
        <Editor className='h-full' theme={document.body.classList.contains('dark') ? 'vs-dark' : 'light'} path={fileManager.currentFilePath} options={{ minimap: { enabled: false }}} value={content} onChange={(value) => {
            if (value) {
                setContent(value!);
                api.file.edit.post({ path: fileManager.currentFilePath!, contents: value! });
            }
        }} />
    )
});

export default CodeViewer;