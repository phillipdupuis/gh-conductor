// Geometry shared by the layout (src/core/layout.ts) and the node components (src/app): the layout
// places boxes of these sizes and React renders boxes of these sizes, so nothing depends on font
// metrics or DOM measurement.

/** A plain issue node. */
export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 56;

/** A collapsed layer: one list node. Rows scroll inside it past MAX_VISIBLE_ROWS. */
export const LAYER_WIDTH = 360;
export const ROW_HEIGHT = 28;
export const FOOTER_HEIGHT = 32;
export const MAX_VISIBLE_ROWS = 8;

/** An expanded row is framed with this padding around its columns. */
export const FRAME_PAD = 12;

/** The "Collapse" pill, centred on the frame's top edge, overlapping the border by this much. */
export const TOGGLE_WIDTH = 96;
export const TOGGLE_HEIGHT = 28;
export const TOGGLE_OVERLAP = 6;

/** A layer with more issues than this renders collapsed until expanded. Not configurable in the UI yet. */
export const COLLAPSE_THRESHOLD = 1;

/** Between columns in an expanded row / between rows. */
export const GAP_X = 40;
export const GAP_Y = 64;
