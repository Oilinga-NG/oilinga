"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { clearApiError, getApiState, getServerApiState, subscribeApiState } from "@/lib/api-client";

export function ApiProvider({ children }: { children: ReactNode }) {
    const state = useSyncExternalStore(subscribeApiState, getApiState, getServerApiState);
    return <>
        {state.pending > 0 && <div className="oi-api-progress" aria-label="Loading data" role="progressbar" />}
        {state.error && <div className="oi-api-error" role="alert"><span>{state.error}</span><button type="button" onClick={clearApiError} aria-label="Dismiss API error">×</button></div>}
        {children}
    </>;
}
