declare module 'lucide-react/icons/*' {
    import type { FC, SVGProps } from 'react';

    export interface LucideProps extends Partial<Omit<SVGProps<SVGSVGElement>, 'ref'>> {
        size?: string | number;
        absoluteStrokeWidth?: boolean;
    }

    export default LucideIcon;
}