/** Every copy of a frame the viewer (components/lightbox.tsx) has painted, by frame src. Module state, so it outlives a page change:
    a Back to the home lays the copy just shown under its sleeve until the sleeve's own decodes (components/v4/home/back.ts). */
export const painted = new Map<string, string>();
