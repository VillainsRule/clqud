import { useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type DialogType = 'alert' | 'confirm' | 'prompt';

interface IInput {
    placeholder: string;
    maxLength: number | undefined;
    minLength: number | undefined;
}

interface DialogState {
    open: boolean;
    type: DialogType | null;
    title: string;
    body: string;
    inputs: IInput[];
    onConfirm: (() => void) | ((value: string) => void) | null;
    onCancel: (() => void) | null;
}

let _setState: ((state: DialogState) => void) | null = null;

const defaultState: DialogState = {
    open: false,
    type: null,
    title: '',
    body: '',
    inputs: [],
    onConfirm: null,
    onCancel: null,
};

const handleInputs = (inputs: (string | IInput)[]) =>
    inputs.map((input) => typeof input === 'string' ? { placeholder: input, maxLength: undefined, minLength: undefined } : input);

export class shadd {
    /**
     * alerts with a simple message and an OK button
     * @param title the alert title
     * @param body the alert body
     */
    static alert(title: string, body: string): void {
        _setState?.({ ...defaultState, open: true, type: 'alert', title, body });
    }

    /**
     * confirms an action
     * @param title the confirmation title
     * @param body the confirmation body
     * @param onConfirm callback on confirm
     * @param onCancel callback on cancel/close
     */
    static confirm(
        title: string,
        body: string,
        onConfirm?: () => void,
        onCancel?: () => void
    ): void {
        _setState?.({
            ...defaultState,
            open: true,
            type: 'confirm',
            title,
            body,
            onConfirm: onConfirm ?? null,
            onCancel: onCancel ?? null,
        });
    }

    /**
     * prompts for text input
     * @param title the prompt title
     * @param body the prompt body
     * @param placeholder placeholder for the input field
     * @param onConfirm callback on confirms (placeholder data as value)
     * @param onCancel callback on cancel
     */
    static prompt(
        title: string,
        body: string,
        inputs: string | string[] | IInput | IInput[],
        onConfirm?: (value: string) => void,
        onCancel?: () => void
    ): void {
        _setState?.({
            ...defaultState,
            open: true,
            type: 'prompt',
            title,
            body,
            inputs: handleInputs(Array.isArray(inputs) ? inputs : [inputs]),
            onConfirm: onConfirm ?? null,
            onCancel: onCancel ?? null,
        });
    }
}

export function ShaddProvider() {
    const [state, setState] = useState<DialogState>(defaultState);
    const [inputValue, setInputValue] = useState('');

    _setState = useCallback((next: DialogState) => {
        setInputValue('');
        setState(next);
    }, []);

    const close = useCallback(() => {
        setState((s) => ({ ...s, open: false }));
    }, []);

    const handleConfirm = useCallback(() => {
        close();

        if (state.type === 'prompt') (state.onConfirm as ((value: string) => void) | null)?.(inputValue);
        else (state.onConfirm as (() => void) | null)?.();
    }, [close, state, inputValue]);

    const handleCancel = useCallback(() => {
        close();
        state.onCancel?.();
    }, [close, state]);

    return (
        <Dialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent className='sm:max-w-lg gap-2'>
                <DialogHeader>
                    <DialogTitle>{state.title}</DialogTitle>
                    {state.body && <DialogDescription>{state.body}</DialogDescription>}
                </DialogHeader>

                {state.type === 'prompt' && <div className='flex flex-col py-2 gap-2'>{state.inputs.map((input, idx) => <Input
                    autoFocus
                    key={idx}
                    placeholder={input.placeholder}
                    minLength={input.minLength}
                    maxLength={input.maxLength}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />)}</div>}

                <DialogFooter className={state.type === 'prompt' ? 'gap-3 pt-1' : 'gap-3'}>
                    {state.type === 'alert' && <Button onClick={close}>OK</Button>}

                    {state.type === 'confirm' && <>
                        <Button variant='outline' onClick={handleCancel}>Cancel</Button>
                        <Button onClick={handleConfirm}>Confirm</Button>
                    </>}

                    {state.type === 'prompt' && <>
                        <Button variant='outline' onClick={handleCancel}>Cancel</Button>
                        <Button onClick={handleConfirm}>Submit</Button>
                    </>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

(window as any).shadd = shadd;