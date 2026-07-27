import type { ImageSourcePropType } from 'react-native';

export type TutorialPage = {
  title?: string;
  text: string;
  image?: ImageSourcePropType;
};

export type Tutorial = {
  id: string;
  title: string;
  autoShow?: boolean;
  pages: TutorialPage[];
};

const mapTutorial: Tutorial = {
  id: 'map-basics',
  title: 'Map Basics',
  autoShow: false,
  pages: [
    {
      title: 'Welcome to CadNav',
      text: 'CadNav is a grid navigation tool for field use. The main map screen is your primary workspace — you can pan, zoom, place checkpoints, and navigate with grid references.',
    },
    {
      title: 'Map Controls',
      text: 'The bottom panel shows your current target or route. Tap "Set target" (pin icon on the right) to place a marker by tapping the map, entering a grid reference, or projecting from a bearing. The compass button (bottom-right) opens a bearing compass. The location button re-centers on your GPS position. Pinch to zoom, drag to pan.',
    },
    {
      title: 'Checkpoints & Routes',
      text: 'Tap the pin icon (right edge) to open the placement drawer — choose Tap Map, Grid Reference, or Project Point. The bottom panel shows your active target: bearing, distance, and grid reference. In placing mode it shows "TAP MAP TO PLACE" with Done/Cancel. After placing, the panel shows nav info with an approach progress bar and stepper arrows to cycle between multiple targets. Tap the chevron to expand route options (Add to route).',
    },
    {
      title: 'Grid & Bearings',
      text: 'Enable the grid overlay in Settings to see MGRS-style grid lines. Choose between mils and degrees for bearings, and set a grid origin for local grid references. The bottom panel displays bearing, distance, and grid reference for the current target.',
    },
    {
      title: 'Revisit Tutorials',
      text: 'You can replay any tutorial or browse the full manual anytime from the Settings screen. Look for the Tutorials section with badges for each guide.',
    },
  ],
};

const apiKeyTutorial: Tutorial = {
  id: 'api-key',
  title: 'MapTiler API Key',
  pages: [
    {
      title: 'Why You Need a Key',
      text: 'CadNav uses MapTiler for map tiles. You need a free MapTiler API key to load maps. Without one, the map will show a blank background.',
    },
    {
      title: 'Getting a Key',
      text: 'Go to cloud.maptiler.com and sign up for a free account. Once logged in, go to your account settings and copy your API key.',
    },
    {
      title: 'Entering the Key',
      text: 'Tap the MapTiler API Key row in Settings, then paste your key. The map will automatically reload with your tiles once the key is saved.',
    },
  ],
};

const fullManual: Tutorial = {
  id: 'full-manual',
  title: 'Manual',
  autoShow: false,
  pages: [],
};

export const tutorials: Tutorial[] = [
  mapTutorial,
  apiKeyTutorial,
  fullManual,
];

export const tutorialMap = new Map<string, Tutorial>(
  tutorials.map((t) => [t.id, t]),
);
