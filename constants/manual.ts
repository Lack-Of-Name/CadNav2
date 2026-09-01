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
    id: 'api-key-tutorial',
    title: 'Get Your Free Map Key - Step by Step',
    summary: 'Start here. 4 screenshots: sign up at MapTiler, open Keys, copy your key, paste it in CadNav. About 2 minutes. No credit card needed.',
    items: [
      {
        id: 'api-key-step-1-signup',
        title: 'Step 1 - Sign Up at MapTiler (Free)',
        description:
          'Open cloud.maptiler.com, tap Sign Up, create a free account (email + password). The Free tier is generous and covers normal field use - no credit card needed. Once verified, you land on the MapTiler dashboard.',
        imageName: 'manual-api-key-01-signup.png',
        imageCaption:
          'Screenshot 1 - MapTiler homepage / sign-up: show cloud.maptiler.com with the Sign Up button highlighted. Crop to 800x500, annotate with a red arrow / circle on Sign Up. Keep UI chrome visible so users recognise the site.',
      },
      {
        id: 'api-key-step-2-dashboard',
        title: 'Step 2 - Open Your Dashboard to Keys',
        description:
          'After logging in, open the top-left menu (or go directly to cloud.maptiler.com/account/keys). Tap Keys in the left sidebar. You will see a Default key already created for you.',
        imageName: 'manual-api-key-02-dashboard.png',
        imageCaption:
          'Screenshot 2 - MapTiler dashboard with left sidebar: highlight Keys. Show the Default key row. 800x500, circle the Keys item in red. Blur any personal email if visible.',
      },
      {
        id: 'api-key-step-3-copy',
        title: 'Step 3 - Copy Your Key',
        description:
          'In the Keys table, tap the copy icon (two overlapping squares) next to your key, or select the key string and copy it. It is a long hex string (about 40 chars). Keep the dashboard open in case you need it again.',
        imageName: 'manual-api-key-03-copy-key.png',
        imageCaption:
          'Screenshot 3 - Close-up of the Keys table row: highlight the copy button / key string. Show tooltip Copied if possible. 800x500, arrow pointing to the copy icon. Mask most of the key but leave 4 to 6 chars visible so users recognise the format.',
      },
      {
        id: 'api-key-step-4-paste',
        title: 'Step 4 - Paste in CadNav and Save',
        description:
          'Back in CadNav: paste into the Paste your MapTiler key field and tap Save key. The map reloads immediately. If it fails, double-check for extra spaces. You can always change it later in Settings under Map then MapTiler API Key. Tip: you can also tap Skip for now to use downloaded offline maps without any key. You can paste and save your key right below without leaving this guide.',
        imageName: 'manual-api-key-04-paste-key.png',
        imageCaption:
          'Screenshot 4 - CadNav KeyEntryModal with the paste field focused and Save key highlighted. Also show the fallback: Settings under Map then MapTiler API Key row. 800x500, two-callout composite: (1) paste field plus Save, (2) Settings row. Use the existing manual-api-key.png composite as template - replace with fresh captures.',
      },
    ],
  },
  {
    id: 'first-steps',
    title: 'First Steps',
    summary: 'Getting oriented - the drawer menu, API key, and GPS modes.',
    items: [
      {
        id: 'api-key-setup',
        title: 'MapTiler API Key',
        description:
          'CadNav needs a free MapTiler API key to load map tiles. Without one the map is blank with an Enter API Key button. Sign up at cloud.maptiler.com, copy your key, then paste it in Settings under Map then MapTiler API Key. The map reloads with tiles once saved. You can paste and save your key in the field below.',
        imageName: 'manual-api-key.png',
        imageCaption:
          'Side-by-side: (1) Blank map with Enter API Key button centered and (2) Settings scrolled to the Map section with the MapTiler API Key row highlighted. Use an arrow showing the flow: blank map to Settings to paste key.',
      },
      {
        id: 'drawer-navigation',
        title: 'Navigation Drawer',
        description:
          'There is no visible tab bar - the hamburger menu (three lines, top-left) opens a slide-out drawer to switch between Map, Routes, and Settings. The active screen is highlighted. Tap outside the drawer or the arrow button to close it. Opening the Manual from the drawer works the same way.',
        imageName: 'manual-drawer.png',
        imageCaption:
          'The drawer open from the left showing Map, Routes, Settings, and Manual items with icons. Highlight the hamburger button with a callout. Show the active item with its indicator bar.',
      },
      {
        id: 'gps-modes',
        title: 'GPS Modes',
        description:
          'Settings under Location offers four GPS modes. Best Accuracy (GPS plus network), GPS Priority (satellites only), Power Saving (network only, less battery). Super Saving disables the map entirely and shows a minimal direction and bearing screen - use this for long hikes when you only need basic nav. Switch modes at any time.',
        imageName: 'manual-gps-modes.png',
        imageCaption:
          'The Location section in Settings showing the four GPS mode cards in a 2x2 grid: Best Accuracy, GPS Priority, Power Saving, Super Saving. The active card is highlighted. Next to it show the Super Saving screen: a stripped-down view with just heading, bearing, distance, and arrow buttons.',
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
          'Tap the pin icon (right edge of the map) to open the mode drawer. Choose Tap Map to enter placement mode, then tap anywhere on the map to drop a point. With no route active, the point becomes your navigation target, showing distance and bearing from your position - placing another target replaces it. If a route is active, the point is appended to that route as a waypoint instead. Grid Reference and Project Point behave the same way.',
        imageName: 'manual-setting-target.png',
        imageCaption:
          'Map with the mode drawer open from the bottom showing three options (Tap Map, Grid Reference, Project Point). Highlight the pin button on the right that triggered it. Then show the placement result: a target pin on the map with its info popup and the HUD showing bearing, distance, and Done / Cancel.',
      },
      {
        id: 'grid-reference',
        title: 'Grid Reference Entry',
        description:
          'Choosing Grid Reference opens a modal where you enter a Military Grid Reference System (MGRS) reference: the Grid Zone Designator (GZD, for example 55H) and 100km square (for example DV), prefilled from your GPS location, then easting and northing digits. Use 3 digits each for 100 m precision or 5 digits each for 1 m precision. The reference is stored with the checkpoint, and a semi-transparent polygon shows its accuracy on the map. Tap Add Point to convert to lat/lon and place the checkpoint. This is the fastest way to navigate to a known map reference.',
        imageName: 'manual-grid-ref.png',
        imageCaption:
          'The Grid Reference modal: GZD and 100km square fields prefilled from GPS, an easting/northing precision toggle (3 or 5 digits), a live reference preview showing the accuracy, and "Add Point" / "Cancel" buttons at the bottom.',
      },
      {
        id: 'project-point',
        title: 'Projecting a Point',
        description:
          'Project Point computes a new location from an origin point using a bearing and distance. Enter the bearing (in mils or degrees depending on your Settings) and the distance. Toggle From Last Checkpoint to project from the most recent checkpoint instead of your GPS location. This is useful for estimating positions from terrain features.',
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
        title: 'Routes Screen and Workspace',
        description:
          'The Routes tab shows your workspace - a list of route cards with title, icon, color, and waypoint count. Expand a card to see its waypoints and action buttons. The ACTIVE badge marks the route being navigated. Tap the + button to create a new route. Routes persist between sessions. Use Export workspace JSON at the bottom to back up all routes.',
        imageName: 'manual-workspace-routes.png',
        imageCaption:
          'The Routes screen with collapsed route cards (icons, colors, waypoint counts). One card shows an "ACTIVE" badge. Callouts on the + button top-left and the "Export workspace JSON" link at the bottom.',
      },
      {
        id: 'adding-waypoints',
        title: 'Adding Waypoints to a Route',
        description:
          'Expand a route card and tap Waypoint. The Add Route Panel gives four methods: Place on map (jumps to the map in placement mode; the route is activated first, so tapping the map adds the waypoint to it immediately - tap Done to finish), Grid Reference (enter coords), Project Point (bearing and distance), and Saved Library (import from previously saved routes and locations). You can also tap the pin tool on the map while a route is active - placed points are appended to the route the same way.',
        imageName: 'manual-adding-waypoints.png',
        imageCaption:
          'Composite: (1) Route card expanded showing the "Waypoint" button, (2) The Add Route Panel modal with four method cards, (3) The map HUD with chevron expanded showing "Add to route". Use arrows to connect the three states.',
      },
      {
        id: 'grid-overlay',
        title: 'Grid Overlay',
        description:
          'Settings under Grid lets you enable an MGRS (Military Grid Reference System) grid on the map. The grid is aligned to the UTM zone you are in - the 1000 m lines, subdivisions, and labels switch automatically as you pan across zone boundaries. Toggle Grid Overlay to show lines, Subdivisions for finer detail, and Grid Labels for coordinate numbers.',
        imageName: 'manual-grid-overlay.png',
        imageCaption:
          'The Grid section in Settings showing the overlay, subdivisions, and labels toggles. Overlay a map screenshot with the grid active - show grid lines, labels, and the UTM zone in the corner. Use callouts to connect settings toggles to their visual effect on the map.',
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
