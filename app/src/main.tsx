import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'

import { Editor } from '@monaco-editor/react'

import { Button } from './components/ui/button'
import { Input } from './components/ui/input'

import authManager from './managers/AuthManager'
import fileManager from './managers/FileManager'

import Auth from './components/Auth'
import Unlock from './components/Unlock'
import Welcome from './components/Welcome'

import Dashboard from './components/Dashboard'
import SideBar from './components/navi/SideBar'
import TopBar from './components/navi/TopBar'

import Config from './components/control/Config'
import Labs from './components/control/Labs'
import Passkeys from './components/control/Passkeys'

import FileSwitch from './components/file/Switch'

import api, { errorFrom } from './lib/eden'
import { ShaddProvider } from './lib/shadd'

import './index.css'

function Container({ element: Element, forceFullscreen }: { element: React.ComponentType<any>, forceFullscreen?: boolean }) {
    const location = useLocation();
    const navigate = useNavigate();
    const dragCounterRef = useRef(0);

    useEffect(() => {
        if (!location.pathname.includes('auth') && !authManager.loggedIn) navigate('/&/auth');
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

        const formData = new FormData();
        formData.append('files', new File([], '_forceArray.txt'));
        formData.append('paths', '');

        for (const file of files) {
            formData.append('files', file);
            formData.append('paths', targetPath === '/' ? `/${file.name}` : `${targetPath}/${file.name}`);
        }

        fetch('/api/file/upload', {
            method: 'POST',
            body: formData
        }).then(() => fileManager.fetchTree());
    };

    return (
        <div
            className='flex gap-5 h-screen w-screen'
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className='hidden'><Editor /></div>

            <SideBar />

            <div
                className={`flex flex-col w-full h-full ${forceFullscreen && 'overflow-hidden'} pr-5`}
                onDragEnter={(e: React.DragEvent) => e.dataTransfer.types.includes('Files') && setBodyDraggedOver(true)}
                onDragLeave={(e: React.DragEvent) => {
                    if (!e.dataTransfer.types.includes('Files')) return;
                    dragCounterRef.current--;
                    if (dragCounterRef.current === 0) setBodyDraggedOver(false);
                }}
                onDragOver={(e: React.DragEvent) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
            >
                <TopBar />

                <div
                    className={`flex flex-col items-center ${forceFullscreen && 'h-full'}`}>
                    <Element />
                    {bodyDraggedOver && <div className='w-full h-full absolute backdrop-blur-xs flex justify-center items-center text-xl'>drop to upload to /!</div>}
                </div>
            </div>
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
        <h2>is currently locked. you can unlock it with the instance password:</h2>

        <div className='flex gap-3 min-w-fit mt-1'>
            <Input type='password' placeholder='instance password' id='unlockPassword' />
            <Button onClick={() => {
                const pwInput = document.getElementById('unlockPassword') as HTMLInputElement;
                if (pwInput.value) api.admin.instance.unlock.post({ password: pwInput.value }).then((res) => {
                    if (res.data) location.reload();
                    else alert(errorFrom(res));
                });
            }}>unlock instance</Button>
        </div>
    </div> : <>
        <div className='hidden md:block'><BrowserRouter>
            <Routes>
                <Route path='/' element={<Welcome />} />
                <Route path='/&/auth' element={<Auth />} />

                <Route path='/&' element={<Container element={Dashboard} />} />
                <Route path='/&/file' element={<Container element={FileSwitch} forceFullscreen />} />

                <Route path='/&/config' element={<Container element={Config} />} />
                <Route path='/&/labs' element={<Container element={Labs} />} />
                <Route path='/&/passkeys' element={<Container element={Passkeys} />} />

                <Route path='*' element={<div className='flex flex-col justify-center items-center gap-2 h-screen w-screen'>
                    <h1 className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</h1>
                    <h2>404 not found</h2>
                </div>} />
            </Routes>
        </BrowserRouter></div>

        <div className='md:hidden flex flex-col justify-center items-center text-center px-6 gap-2 h-screen w-screen'>
            <h1 className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</h1>
            <h2>unfortunately does not support mobile at the moment. future goals?</h2>
            <h2>however, in the event of an emergency, you may need to lock and unlock the instance. you can use the instance password to do so below:</h2>

            <div className='flex gap-3 min-w-fit mt-1'>
                <Input type='password' placeholder='instance password' id='lockPassword' />
                <Button onClick={() => {
                    const pwInput = document.getElementById('lockPassword') as HTMLInputElement;
                    if (!pwInput.value) return;

                    api.admin.instance.lockMobile.post({ password: pwInput.value }).then((res) => {
                        if (res.data) location.reload();
                        else alert(errorFrom(res));
                    });
                }}>lock instance</Button>
            </div>
        </div>
    </>) : <div className='flex flex-col justify-center items-center text-center px-6 gap-2 h-screen w-screen'>
        <h1 className='text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm'>clqud</h1>
        <h2>is loading...</h2>
    </div>
});

createRoot(document.getElementById('root')!).render(<><App /><ShaddProvider /></>);