import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function watchDirRecursive(dir: string, ignored: string[], onChange: () => void) {
    if (ignored.includes(dir)) return;

    const watcher = fs.watch(dir, { persistent: true }, (_eventType, filename) => {
        if (filename) {
            const fullPath = path.join(dir, filename);

            fs.stat(fullPath, (err, stats) => {
                if (!err && stats.isDirectory()) {
                    watchDirRecursive(fullPath, ignored, onChange);
                }
            });

            onChange();
        }
    });

    fs.readdir(dir, { withFileTypes: true }, (err, files) => {
        if (err) return;
        for (const file of files) {
            if (file.isDirectory()) watchDirRecursive(path.join(dir, file.name), ignored, onChange);
        }
    });

    return watcher;
}

const currentDir = import.meta.dirname;

const ignore = [
    `${currentDir}/node_modules`,
    `${currentDir}/dist`, // or whatever your dist directory is...parsing vite.config.ts sounds irritating
    `${currentDir}/bun.lock`
];

console.log(`\x1b[34mwatching for changes\n\x1b[0m`);

const update = () => {
    try {
        execSync(`cd ${currentDir} && ABSOLUTE=1 bunx --bun vite build`, { stdio: 'inherit' });
        console.log('');
    } catch {
        console.error(`\x1b[31mError during build process.\n\x1b[0m`);
    }
}

update();
watchDirRecursive(currentDir, ignore, update);