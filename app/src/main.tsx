import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { observer } from 'mobx-react-lite'

import { Editor } from '@monaco-editor/react'

import { Button } from './components/ui/button'

import authManager from './managers/AuthManager'
import fileManager from './managers/FileManager'

import Unlock from './components/Unlock'
import Welcome from './components/Welcome'

import Dashboard from './components/Dashboard'
import SideBar from './components/navi/SideBar'
import TopBar, { Breadcrumb } from './components/navi/TopBar'

import Config from './components/Config'

import FileSwitch from './components/file/Switch'
import UploadQueue from './components/navi/UploadQueue'

import { ShaddProvider } from './lib/shadd'

import './index.css'

function Container({ element: Element, isAsset }: { element: React.ComponentType<any>, isAsset?: boolean }) {
    const location = useLocation();
    const dragCounterRef = useRef(0);

    useEffect(() => {
        if (!location.pathname.includes('auth') && !authManager.loggedIn) window.location.href = '/&/auth';
    }, [authManager.loggedIn]);

    const [bodyDraggedOver, setBodyDraggedOver] = useState(false);

    const handleDragEnter = (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        dragCounterRef.current++;
        fileManager.isDraggingExternal = true;
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            fileManager.isDraggingExternal = false;
            fileManager.dragHoverPath = null;
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setBodyDraggedOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (!files.length) return;

        const targetPath = fileManager.dragHoverPath ?? '/';

        fileManager.isDraggingExternal = false;
        fileManager.dragHoverPath = null;

        fileManager.uploadFiles(files, targetPath);
    };

    return (
        <div
            className='flex gap-4 h-screen w-screen p-5 bg-background'
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className='hidden'><Editor /></div>

            <div className='hidden md:block min-w-84 max-w-84 h-full bg-card border rounded-2xl shadow-lg overflow-hidden'>
                <SideBar />
            </div>

            <div className='flex flex-col w-full h-full gap-3 min-w-0'>
                <div className='hidden md:block shrink-0 bg-card border rounded-2xl shadow-lg px-6 py-3'>
                    <TopBar />
                </div>

                <div
                    className={`relative flex flex-col w-full flex-1 min-h-0 bg-card border rounded-2xl shadow-lg p-3 ${isAsset ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}
                    onDragEnter={(e: React.DragEvent) => e.dataTransfer.types.includes('Files') && setBodyDraggedOver(true)}
                    onDragLeave={(e: React.DragEvent) => {
                        if (!e.dataTransfer.types.includes('Files')) return;
                        dragCounterRef.current--;
                        if (dragCounterRef.current === 0) setBodyDraggedOver(false);
                    }}
                    onDragOver={(e: React.DragEvent) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
                >
                    {isAsset && <Breadcrumb />}

                    <div className={`flex flex-col items-center w-full ${isAsset ? 'flex-1 min-h-0' : ''}`}>
                        <Element />
                        {bodyDraggedOver && <div className='absolute inset-0 backdrop-blur-xs flex justify-center items-center text-xl rounded-2xl'>drop to upload to /!</div>}
                    </div>
                </div>
            </div>

            <UploadQueue />
        </div>
    )
}

const hasCookie = document.cookie.split(';').some((cookie) => cookie.trim().startsWith('cp='));

const App = observer(function App() {
    if (hasCookie) {
        document.cookie = 'cp=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        return <Unlock />;
    }

    authManager.checkAuth();

    return authManager.hasInit ? (authManager.locked ? <div className='flex flex-col justify-center items-center text-center px-6 gap-2 h-screen w-screen'>
        <h1 className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</h1>
        <h2>is locked. you can unlock it by confirming through voauth:</h2>

        <Button className='mt-1' onClick={() => location.href = authManager.redirect.replace('ACTION', 'unlock')}>confirm with voauth</Button>
    </div> : <>
        <div className='hidden md:block'><BrowserRouter>
            <Routes>
                <Route path='/' element={<Welcome />} />

                <Route path='/&' element={<Container element={Dashboard} />} />
                <Route path='/&/file' element={<Container element={FileSwitch} isAsset />} />
                <Route path='/&/config' element={<Container element={Config} />} />

                <Route path='*' element={<div className='flex flex-col justify-center items-center gap-2 h-screen w-screen'>
                    <h1 className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</h1>
                    <h2>404 not found</h2>
                </div>} />
            </Routes>
        </BrowserRouter></div>

        <div className='md:hidden flex flex-col justify-center items-center text-center px-6 gap-2 h-screen w-screen'>
            <h1 className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</h1>
            <h2>unfortunately does not support mobile at the moment. future goals?</h2>
            <h2>however, in the event of an emergency, you may need to lock the instance. you can confirm with voauth to do that below:</h2>

            <Button className='mt-1' onClick={() => location.href = authManager.redirect.replace('ACTION', 'lock')}>lock instance</Button>
        </div>
    </>) : <div className='flex flex-col justify-center items-center text-center px-6 gap-2 h-screen w-screen'>
        <h1 className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</h1>
        <h2>is loading...</h2>
    </div>
});

createRoot(document.getElementById('root')!).render(<><App /><ShaddProvider /></>);