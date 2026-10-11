'use client';
import Script from 'next/script';
import {useCallback, useEffect, useRef} from 'react';

import {TRAIL_MAINTENANCE_TURNSTILE_ACTION} from '@/src/lib/trail-maintenance/constants';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TrailReportBotCheck({onToken}: {onToken: (token: string) => void}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
  const render = useCallback(() => {
    if (!siteKey || !container.current || widget.current !== null || !window.turnstile) return;
    widget.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      action: TRAIL_MAINTENANCE_TURNSTILE_ACTION,
      callback: (token) => callback.current(token),
      'expired-callback': () => callback.current(''),
      'error-callback': () => callback.current(''),
    });
  }, [siteKey]);
  useEffect(() => {
    render();
    return () => {
      if (widget.current !== null) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [render]);
  return siteKey ? (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={render}
      />
      <div ref={container} />
    </>
  ) : null;
}
