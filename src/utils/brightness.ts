// expo-camera has no exposure/brightness control on native platforms (its
// exposureCompensation/iso/brightness settings exist only in the web
// implementation), so brightness is applied in software when the photo is
// composited.
//
// The technique is "screen the photo onto itself": each extra copy of the
// photo blended with mixBlendMode 'screen' turns a pixel value c into
// 1 - (1 - c)^(n + 1) after n copies. Black stays black, shadows are
// multiplied up hard (a dark 0.05 becomes ~0.14 after two copies), and
// bright areas roll off smoothly instead of clipping. That is what makes a
// dark scene look clear rather than grey, which a flat white overlay can't
// do because it lifts the black level too.
//
// Why not RN's `filter` brightness? Android applies it through a layer
// cache that is capped at the screen's pixel area, and the compositor is
// bigger than that, so the filter would be silently skipped. mixBlendMode
// is drawn with Canvas.saveLayer, which has no such limit (API 29+).
//
// `boost` is the number of screened copies; a fractional part is the
// opacity of the last copy (3.5 = three full copies plus one at 50%).
export interface BrightnessPreset {
  label: string;
  boost: number;
}

export const BRIGHTNESS_PRESETS: BrightnessPreset[] = [
  { label: 'Off', boost: 0 },
  { label: 'Low', boost: 0.5 },
  { label: 'Medium', boost: 1 },
  { label: 'High', boost: 2 },
  { label: 'Max', boost: 3.5 },
];

// Starts at High: the dim-room scenes this has been tested in need a strong
// boost, and the badge makes stepping down for daylight a single tap.
export const DEFAULT_BRIGHTNESS_INDEX = 3;

/** Opacity of each screened copy needed for `boost`, e.g. 2.5 -> [1, 1, 0.5]. */
export function boostLayerOpacities(boost: number): number[] {
  const opacities: number[] = [];
  for (let remaining = boost; remaining > 0.001; remaining -= 1) {
    opacities.push(Math.min(1, remaining));
  }
  return opacities;
}
