// Hand-written minimal typing for the vendored @viz-js/viz ESM build. Only what the CLI uses.
export type RenderOptions = { format?: "svg" | "dot" | "json" | "plain" | "plain-ext" | "xdot"; engine?: "dot" | "neato" | "fdp" | "circo" | "twopi" | "osage" | "patchwork" };
export type Viz = {
  graphvizVersion: string;
  renderString(src: string, options?: RenderOptions): string;
};
export function instance(): Promise<Viz>;
