import { useEffect, useState } from 'react';
import { getAccessToken, resolveApiUrl } from './api';

export function useAuthedBlobUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);

    if (!path) {
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    const load = async () => {
      try {
        const headers = new Headers();
        const token = getAccessToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        const response = await fetch(resolveApiUrl(path), {
          headers,
          signal: controller.signal,
        });
        if (!response.ok || !active) {
          return;
        }

        const blob = await response.blob();
        if (!active) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (active) {
          setUrl(null);
        }
      }
    };

    void load();

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path]);

  return url;
}
