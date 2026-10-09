// expo-camera has no exposure/brightness control on native platforms (its
// exposureCompensation/iso/brightness settings exist only in the web
// implementation), so brightness is applied as a software boost when the
// photo is composited, in two layers that work differently:
//   - gain/saturate: a linear multiply on the photo (like +EV exposure
//     compensation). Strong, but clips highlights if pushed too far.
//   - lift: a translucent white 'screen' blend on top, which raises shadows
//     far more than highlights, so it brightens dark areas without
//     flattening bright ones.
// The user picks a preset from the on-screen "Bright" badge; they differ
// scene to scene (a dim room wants High/Max, bright daylight wants Low/Off).
export interface BrightnessPreset {
  label: string;
  gain: number;
  saturate: number;
  lift: number;
}

// Gain does most of the work and the white lift is kept light: a strong
// lift raises the black level too, which turns a dark scene grey and hazy
// rather than clear, so it only nudges the deepest shadows.
export const BRIGHTNESS_PRESETS: BrightnessPreset[] = [
  { label: 'Off', gain: 1, saturate: 1, lift: 0 },
  { label: 'Low', gain: 1.2, saturate: 1.04, lift: 0.03 },
  { label: 'Medium', gain: 1.4, saturate: 1.07, lift: 0.06 },
  { label: 'High', gain: 1.65, saturate: 1.1, lift: 0.09 },
  { label: 'Max', gain: 1.95, saturate: 1.14, lift: 0.14 },
];

// Starts at High: the dim-room scenes this has been tested in need a strong
// boost, and the badge makes stepping down for daylight a single tap.
export const DEFAULT_BRIGHTNESS_INDEX = 3;
