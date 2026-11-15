// CadNav 2 libraries — Copyright (C) 2026 Lyren, Alexander Ellul
// SPDX-License-Identifier: LGPL-3.0-or-later
// See lib/LICENSE for full terms.

/**
 * MapTiler API key helpers.
 *
 * Users copy keys from a dashboard, a URL, or (sometimes) a chat message, so
 * the input is normalised before it reaches storage or the network. We keep
 * the shape check deliberately loose — MapTiler validates the key itself — but
 * strict enough to catch pasted prose, URLs and accidental whitespace.
 */

export const MAPTILER_KEY_MIN_LENGTH = 20;
export const MAPTILER_KEY_MAX_LENGTH = 128;

/** Extract the `key` query parameter from a MapTiler URL, if present. */
function keyFromUrl(value: string): string | null {
  const match = value.match(/[?&]key=([^&#\s]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Normalise a pasted MapTiler key.
 *
 * Accepts a raw key, a quoted key, or a style/tile URL that contains `key=`.
 * Returns `null` when the value cannot plausibly be a key, so callers can show
 * a friendly message instead of sending junk to MapTiler.
 */
export function parseApiKeyInput(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let value = raw.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    const fromUrl = keyFromUrl(value);
    if (!fromUrl) return null;
    value = fromUrl;
  } else if (/[?&]key=/i.test(value)) {
    const fromUrl = keyFromUrl(value);
    if (!fromUrl) return null;
    value = fromUrl;
  }

  value = value.replace(/^["'`]+|["'`]+$/g, '').trim();

  if (value.length < MAPTILER_KEY_MIN_LENGTH || value.length > MAPTILER_KEY_MAX_LENGTH) {
    return null;
  }
  // MapTiler keys are URL-safe tokens; whitespace or punctuation means the
  // user pasted something else (a sentence, a code block with line breaks, ...).
  if (!/^[A-Za-z0-9._~-]+$/.test(value)) {
    return null;
  }

  return value;
}

/** Short, non-sensitive key display for settings and debug surfaces. */
export function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 10) return `${key.slice(0, 2)}...`;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}
