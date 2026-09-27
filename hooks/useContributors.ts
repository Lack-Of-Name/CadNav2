/**
 * useContributors — GitHub contributors for the About page.
 *
 * Fetches the repo contributor list so it stays current without app updates.
 * Results are cached in AsyncStorage: offline (or rate-limited) opens fall
 * back to the last good fetch, then to a small static list.
 */
import { GITHUB_CONTRIBUTORS } from '@/constants/storageKeys';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type Contributor = {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number | null;
};

const REPO = 'Lack-Of-Name/CadNav2';

// Shown when there is no network and nothing cached yet.
const STATIC_FALLBACK: Contributor[] = [
  {
    login: 'lack-of-name',
    avatarUrl: 'https://github.com/lack-of-name.png',
    profileUrl: 'https://github.com/Lack-Of-Name',
    contributions: null,
  },
  {
    login: 'aellul27',
    avatarUrl: 'https://github.com/aellul27.png',
    profileUrl: 'https://github.com/aellul27',
    contributions: null,
  },
];

type Cached = {
  fetchedAt: number;
  contributors: Contributor[];
};

function normalize(raw: unknown): Contributor[] {
  if (!Array.isArray(raw)) return [];
  const out: Contributor[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.login !== 'string') continue;
    out.push({
      login: r.login,
      avatarUrl: typeof r.avatar_url === 'string' ? r.avatar_url : `https://github.com/${r.login}.png`,
      profileUrl: typeof r.html_url === 'string' ? r.html_url : `https://github.com/${r.login}`,
      contributions: typeof r.contributions === 'number' ? r.contributions : null,
    });
  }
  return out;
}

async function readCache(): Promise<Cached | null> {
  try {
    const raw = await AsyncStorage.getItem(GITHUB_CONTRIBUTORS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Cached>;
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !Array.isArray(parsed.contributors)) return null;
    return { fetchedAt: parsed.fetchedAt, contributors: normalize(parsed.contributors) };
  } catch {
    return null;
  }
}

export function useContributors() {
  const [contributors, setContributors] = useState<Contributor[]>(STATIC_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await readCache();
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=100`, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const list = normalize(await res.json());
        if (!cancelled && list.length > 0) {
          setContributors(list);
          setFromCache(false);
          await AsyncStorage.setItem(
            GITHUB_CONTRIBUTORS,
            JSON.stringify({ fetchedAt: Date.now(), contributors: list } satisfies Cached),
          );
        } else if (!cancelled && cached) {
          setContributors(cached.contributors);
          setFromCache(true);
        }
      } catch {
        if (!cancelled && cached) {
          setContributors(cached.contributors);
          setFromCache(true);
        }
        // else: keep STATIC_FALLBACK
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { contributors, loading, fromCache } as const;
}
