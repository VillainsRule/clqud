import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import File from 'lucide-react/icons/file';
import FileBraces from 'lucide-react/icons/file-braces';
import FileCode from 'lucide-react/icons/file-code';
import FileDiff from 'lucide-react/icons/file-diff';
import FileImage from 'lucide-react/icons/file-image';
import FileMusic from 'lucide-react/icons/file-music';
import FilePlay from 'lucide-react/icons/file-play';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const getRelativeTime = (timestamp: number): string => {
    if (timestamp <= 0) return 'never';

    const now = Date.now();
    let diff = Math.floor((now - timestamp) / 1000);

    if (diff < 0) return 'just now';

    const units = [
        { name: 'month', secs: 2592000 },
        { name: 'week', secs: 604800 },
        { name: 'day', secs: 86400 },
        { name: 'hour', secs: 3600 },
        { name: 'minute', secs: 60 },
        { name: 'second', secs: 1 }
    ];

    for (const unit of units) {
        const value = Math.floor(diff / unit.secs);
        if (value > 0) return `${value} ${unit.name}${value > 1 ? 's' : ''} ago`;
    }

    return 'just now';
}

export const codeExtensions = [
    'txt', 'md', 'json', 'yaml', 'yml', 'xml', 'csv', 'log', 'ini', 'conf', 'cfg',
    'js', 'jsx', 'ts', 'tsx', 'vue', 'html', 'css', 'scss', 'less',
    'java', 'py', 'rb', 'go', 'rs', 'cpp', 'c', 'h', 'hpp', 'cs',
    'sh', 'bat', 'ps1', 'zsh',
    'sql', 'pl', 'pm', 'lua', 'r', 'swift', 'kt', 'kts',
    'dart', 'scala', 'groovy', 'clj', 'cljs', 'coffee',
    'asm', 's', 'S', 'diff'
]

export const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
export const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'webm'];
export const audioExtensions = ['mp3', 'wav', 'ogg', 'flac'];

type FileT = 'code' | 'image' | 'video' | 'audio' | 'other';

export const getTypeFromExt = (ext: string): FileT => {
    if (codeExtensions.includes(ext)) return 'code';
    else if (imageExtensions.includes(ext)) return 'image';
    else if (videoExtensions.includes(ext)) return 'video';
    else if (audioExtensions.includes(ext)) return 'audio';
    else return 'other';
}

export const getFileIcon = (extension?: string) => {
    if (!extension) return <File className="h-4 w-4 text-muted-foreground" />;

    if (extension === 'json') return <FileBraces className="h-4 w-4 text-foreground/60" />;
    else if (extension === 'diff') return <FileDiff className="h-4 w-4 text-foreground/60" />;

    else if (codeExtensions.includes(extension)) return <FileCode className="h-4 w-4 text-foreground/70" />;
    else if (imageExtensions.includes(extension)) return <FileImage className="h-4 w-4 text-foreground/60" />;
    else if (videoExtensions.includes(extension)) return <FilePlay className="h-4 w-4 text-foreground/60" />;
    else if (audioExtensions.includes(extension)) return <FileMusic className="h-4 w-4 text-foreground/60" />;

    return <File className="h-4 w-4 text-muted-foreground" />;
}

export const getMonacoEditorLang = (extension?: string) => {
    if (!extension) return 'plaintext';

    if (extension === 'md') return 'markdown';
    else if (extension === 'json') return 'json';
    else if (extension === 'yaml' || extension === 'yml') return 'yaml';
    else if (extension === 'xml') return 'xml';
    else if (extension === 'csv') return 'csv';
    else if (extension === 'js' || extension === 'jsx') return 'javascript';
    else if (extension === 'ts' || extension === 'tsx') return 'typescript';
    else if (extension === 'html') return 'html';
    else if (extension === 'css' || extension === 'scss' || extension === 'less') return 'css';
    else if (extension === 'java') return 'java';
    else if (extension === 'py') return 'python';
    else if (extension === 'rb') return 'ruby';
    else if (extension === 'go') return 'go';
    else if (extension === 'rs') return 'rust';
    else if (extension === 'cpp' || extension === 'c' || extension === 'h' || extension === 'hpp') return 'cpp';
    else if (extension === 'cs') return 'csharp';
    else if (extension === 'sh' || extension === 'bat' || extension === 'ps1' || extension === 'zsh') return 'shell';
    else if (extension === 'sql') return 'sql';
    else if (extension === 'lua') return 'lua';
    else if (extension === 'r') return 'r';
    else if (extension === 'dart') return 'dart';
    else if (extension === 'scala') return 'scala';
    else if (extension === 'groovy') return 'groovy';
    else if (extension === 'clj' || extension === 'cljs') return 'clojure';
    else if (extension === 'coffee') return 'coffeescript';
    else if (extension === 'asm' || extension === 's' || extension === 'S') return 'asm';

    else return 'plaintext';
}

export const getFileSize = (bytes: number): string => {
    if (bytes >= 1e12) return parseFloat((bytes / 1e12).toFixed(1)) + ' TB';
    else if (bytes >= 1e9) return parseFloat((bytes / 1e9).toFixed(1)) + ' GB';
    else if (bytes >= 1e6) return Math.round((bytes / 1e6)) + ' MB';
    else if (bytes >= 1e3) return Math.round((bytes / 1e3)) + ' KB';
    else return bytes + ' bytes';
}