/* Every copy of a frame the viewer has painted, by frame src. Module state, so it outlives a page change:
   a Back to the home lays the copy just shown under its sleeve until the sleeve's own decodes (components/home/back.ts). */
const painted = new Map<string, string>();

/** Notes the copy of `src` the viewer just painted. */
export const rememberPainted = (src: string, url: string) => void painted.set(src, url);

/** The copy of `src` the viewer last painted, if any. */
export const paintedCopy = (src: string): string | undefined => painted.get(src);

/** Forgets every painted copy (tests). */
export const resetPainted = () => painted.clear();
