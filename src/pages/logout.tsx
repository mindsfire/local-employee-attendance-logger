import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

import { cn } from '@/lib/utils';
import { FieldDescription, FieldGroup } from '@/components/ui/field';

export default function Logout() {
    const router = useRouter();
    const { logout } = useAuth();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            try {
                await logout();
                if (cancelled) return;
                router.replace('/login');
            } catch {
                if (cancelled) return;
                setError('Unable to log out. Please try again.');
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [logout, router]);

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className={cn('flex w-full max-w-sm flex-col gap-6')}>
                <FieldGroup>
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Image
                            src="/logo-only.svg"
                            alt="Mindsfire"
                            width={56}
                            height={56}
                            className="object-contain"
                            priority
                        />

                        {error ? (
                            <FieldDescription className="text-destructive">{error}</FieldDescription>
                        ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Logging out…</span>
                            </div>
                        )}
                    </div>
                </FieldGroup>
            </div>
        </div>
    );
}
