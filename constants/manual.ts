export type ManualItem = {
  id: string;
  title: string;
  description: string;
  imageName: string;
  imageCaption: string;
};

export type ManualSection = {
  id: string;
  title: string;
  summary: string;
  items: ManualItem[];
};

const sections: ManualSection[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    summary: 'Getting oriented — the drawer menu, API key, and GPS modes.',
    items: [
      {
        id: 'api-key-setup',
        title: 'MapTiler API Key',
        description:
          'CadNav needs a free MapTiler API key to load map tiles. Without one the map is blank with an "Enter API Key" button. Sign up at cloud.maptiler.com, copy your key, then paste it in Settings → Map → MapTiler API Key. The map reloads with tiles once saved.',
        imageName: 'manual-api-key.png',
        imageCaption:
          'Side-by-side: (1) Blank map with "Enter API Key" button centered and (2) Settings scrolled to the Map section with the "MapTiler API Key" row highlighted. Use an arrow showing the flow: blank map → Settings → paste key.',
      },
      {
        id: 'drawer-navigation',
        title: 'Navigation Drawer',
        description:
          'There is no visible tab bar — the hamburger menu (three lines, top-left) opens a slide-out drawer to switch between Map, Routes, and Settings. The active screen is highlighted. Tap outside the drawer or the arrow button to close it. Opening the Manual from the drawer works the same way.',
        imageName: 'manual-drawer.png',
        imageCaption:
          'The drawer open from the left showing Map, Routes, Settings, and Manual items with icons. Highlight the hamburger button with a callout. Show the active item with its indicator bar.',
      },
      {
        id: 'gps-modes',
        title: 'GPS Modes',
        description:
          'Settings → Location offers four GPS modes. "Best Accuracy" (GPS+network), "GPS Priority" (satellites only), "Power Saving" (network only, less battery). "Super Saving" disables the map entirely and shows a minimal direction-and-bearing screen — use this for long hikes when you only need basic nav. Switch modes at any time.',
        imageName: 'manual-gps-modes.png',
        imageCaption:
          'The Location section in Settings showing the four GPS mode cards in a 2×2 grid: Best Accuracy, GPS Priority, Power Saving, Super Saving. The active card is highlighted. Next to it show the Super Saving screen: a stripped-down view with just heading, bearing, distance, and arrow buttons.',
      },
    ],
  },

  {
    id: 'placing-targets',
    title: 'Placing Targets',
    summary: 'Setting navigation targets on the map using different methods.',
    items: [
      {
        id: 'setting-a-target',
        title: 'Setting a Target',
        description:
          'Tap the pin icon (right edge of the map) to open the mode drawer. Choose "Tap Map" to enter placement mode — a crosshair appears and you tap anywhere to drop a pin. Tap "Done" to confirm or "Cancel" to discard. The target becomes your active navigation point, showing distance and bearing from your position. Tap the pin button again to place a new target.',
        imageName: 'manual-setting-target.png',
        imageCaption:
          'Map with the mode drawer open from the bottom showing three options (Tap Map, Grid Reference, Project Point). Highlight the pin button on the right that triggered it. Then show the placement result: a pin on the map with its info popup and the HUD showing "Done" / "Cancel".',
      },
      {
        id: 'grid-reference',
        title: 'Grid Reference Entry',
        description:
          'Choosing "Grid Reference" opens a modal where you enter easting and northing values (relative to your grid origin). Tap +/- to toggle the sign. The grid origin is set in Settings → Grid → Grid Origin. Tap "Add Point" to convert to lat/lon and place the checkpoint. This is the fastest way to navigate to a known map reference.',
        imageName: 'manual-grid-ref.png',
        imageCaption:
          'The Grid Reference modal: two input fields (Easting, Northing) with +/- toggles, and "Add Point" / "Cancel" buttons at the bottom. Add a callout note: "Your grid origin must be set in Settings first."',
      },
      {
        id: 'project-point',
        title: 'Projecting a Point',
        description:
          '"Project Point" computes a new location from an origin point using a bearing and distance. Enter the bearing (in mils or degrees depending on your Settings) and the distance. Toggle "From Last Checkpoint" to project from the most recent checkpoint instead of your GPS location. This is useful for estimating positions from terrain features.',
        imageName: 'manual-project-point.png',
        imageCaption:
          'The Project Point modal showing bearing and distance inputs, the "From Last Checkpoint" toggle. Add a small diagram overlay: a line from an origin point along a bearing arrow for the given distance, ending at the new projected point.',
      },
    ],
  },

  {
    id: 'routes-and-grid',
    title: 'Routes & Grid',
    summary: 'Managing waypoints, workspace routes, and the grid overlay.',
    items: [
      {
        id: 'workspace-routes',
        title: 'Routes Screen & Workspace',
        description:
          'The Routes tab shows your workspace — a list of route cards with title, icon, color, and waypoint count. Expand a card to see its waypoints and action buttons. The "ACTIVE" badge marks the route being navigated. Tap the + button to create a new route. Routes persist between sessions. Use "Export workspace JSON" at the bottom to back up all routes.',
        imageName: 'manual-workspace-routes.png',
        imageCaption:
          'The Routes screen with collapsed route cards (icons, colors, waypoint counts). One card shows an "ACTIVE" badge. Callouts on the + button top-left and the "Export workspace JSON" link at the bottom.',
      },
      {
        id: 'adding-waypoints',
        title: 'Adding Waypoints to a Route',
        description:
          'Expand a route card and tap "Waypoint" — the Add Route Panel gives four methods: "Place on map" (jumps to map in placement mode), "Grid Reference" (enter coords), "Project Point" (bearing+distance), and "Saved Library" (import from previously saved routes/locations). Alternatively, set a target on the map first, then tap the HUD chevron → "Add to route" to append it to an existing route.',
        imageName: 'manual-adding-waypoints.png',
        imageCaption:
          'Composite: (1) Route card expanded showing the "Waypoint" button, (2) The Add Route Panel modal with four method cards, (3) The map HUD with chevron expanded showing "Add to route". Use arrows to connect the three states.',
      },
      {
        id: 'grid-overlay',
        title: 'Grid Overlay',
        description:
          'Settings → Grid lets you enable an MGRS-style grid on the map. Toggle "Grid Overlay" to show lines, "Subdivisions" for finer detail, and "Grid Labels" for coordinate numbers. "Grid Origin" sets the reference point (use your GPS location or enter a grid reference) — all grid references in the app are relative to this origin. "Grid Convergence" adjusts the angle between true north and grid north.',
        imageName: 'manual-grid-overlay.png',
        imageCaption:
          'The Grid section in Settings showing all rows. Overlay a map screenshot with the grid active — show grid lines, labels, and the origin marker. Use callouts to connect settings toggles to their visual effect on the map.',
      },
    ],
  },
];

export const MANUAL_SECTIONS = sections;

export const MANUAL_ITEM_MAP = new Map<string, { item: ManualItem; sectionId: string; sectionTitle: string }>();

for (const section of sections) {
  for (const item of section.items) {
    MANUAL_ITEM_MAP.set(item.id, {
      item,
      sectionId: section.id,
      sectionTitle: section.title,
    });
  }
}
