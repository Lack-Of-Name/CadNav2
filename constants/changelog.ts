/**
 * CadNav release history, shown in the About page changelog section.
 *
 * Newest first. When cutting a release, add an entry at the top and keep
 * each highlight to one short user-facing line.
 */
export type ChangelogEntry = {
  version: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.0',
    highlights: [
      'Sticky mini compass: draggable, resizable, opens from the compass panel',
      'Drawer opens with a finger-tracked left-edge swipe or the edge tab',
      'Double-tap recenter to track GPS; pan, zoom or tap stops tracking',
      'Long-press the checkpoint widget to pick from the route list',
      'Dotted route lines in the route colour',
      'Custom location dot colour (HSV sliders) in Settings',
      'Compass warnings now show short action notes',
      'Map key guide moved into Settings, theming polish, new splash screen',
    ],
  },
  {
    version: '1.1.1',
    highlights: [
      'Compass accuracy fixes: declination timer, level leeway',
      'Jitter and stationary-drift smoothing, indoor threshold tuning',
    ],
  },
  {
    version: '1.1.0',
    highlights: [
      'Battery-aware sensors with opt-in live diagnostics',
      'Compass health warnings and attribution info',
      'Map improvements and inline manual API key field',
    ],
  },
  {
    version: '1.0.x',
    highlights: [
      'Early field releases: MGRS grid, offline packs, route management',
      'Grid rendering, Android panning and theming fixes',
    ],
  },
];
