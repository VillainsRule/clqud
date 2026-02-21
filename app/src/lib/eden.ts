import { treaty } from '@elysiajs/eden';

import type { App } from '../../../api/src/main';

const { api } = treaty<App>(location.origin);
export default api;

export const errorFrom = (response: { error: any }): string =>
    response.error.value.error || 'Internal Error';