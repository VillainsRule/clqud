export const getExt = (filename: string) => filename.slice(filename.lastIndexOf('.') + 1);
export const getName = (filename: string) => filename.slice(0, filename.lastIndexOf('.'));
export const getNameExt = (fullPath: string) => fullPath.slice(fullPath.lastIndexOf('/') + 1);