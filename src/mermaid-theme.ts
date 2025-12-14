/**
 * Mermaid theme configuration.
 * 
 * Note: themeVariables needs actual hex values at render time (can't use CSS variables).
 * themeCSS CAN use CSS variables since the SVG is inline in the DOM.
 */

import type { ThemeColors } from "./types";

export interface MermaidThemeColors {
  nodeBg: string;
  nodeBorder: string;
  nodeText: string;
  line: string;
  clusterBg: string;
  clusterBorder: string;
  labelBg: string;
  noteBg: string;
  noteBorder: string;
  rowOdd: string;
  rowEven: string;
  // Derived from node colors
  secondaryBg: string;
  secondaryBorder: string;
  tertiaryBg: string;
  tertiaryBorder: string;
}

/**
 * Build MermaidThemeColors from app ThemeColors
 */
export function getMermaidColorsFromTheme(colors: ThemeColors): MermaidThemeColors {
  return {
    nodeBg: colors.mermaid_node_bg,
    nodeBorder: colors.mermaid_node_border,
    nodeText: colors.mermaid_node_text,
    line: colors.mermaid_line,
    clusterBg: colors.mermaid_cluster_bg,
    clusterBorder: colors.mermaid_cluster_border,
    labelBg: colors.bg_primary,
    noteBg: colors.mermaid_note_bg,
    noteBorder: colors.mermaid_note_border,
    rowOdd: colors.mermaid_row_odd,
    rowEven: colors.mermaid_row_even,
    // Use same colors for secondary/tertiary
    secondaryBg: colors.mermaid_node_bg,
    secondaryBorder: colors.mermaid_node_border,
    tertiaryBg: colors.mermaid_node_bg,
    tertiaryBorder: colors.mermaid_node_border,
  };
}

/**
 * Build mermaid themeVariables from our colors
 */
export function getMermaidThemeVariables(colors: MermaidThemeColors) {
  return {
    primaryColor: colors.nodeBg,
    primaryTextColor: colors.nodeText,
    primaryBorderColor: colors.nodeBorder,
    secondaryColor: colors.secondaryBg,
    secondaryTextColor: colors.nodeText,
    secondaryBorderColor: colors.secondaryBorder,
    tertiaryColor: colors.tertiaryBg,
    tertiaryTextColor: colors.nodeText,
    tertiaryBorderColor: colors.tertiaryBorder,
    lineColor: colors.line,
    textColor: colors.nodeText,
    mainBkg: colors.nodeBg,
    nodeBorder: colors.nodeBorder,
    clusterBkg: colors.clusterBg,
    clusterBorder: colors.clusterBorder,
    titleColor: colors.nodeText,
    edgeLabelBackground: colors.labelBg,
    nodeTextColor: colors.nodeText,
    // ER diagram
    attributeBackgroundColorOdd: colors.clusterBg,
    attributeBackgroundColorEven: colors.labelBg,
    entityBkg: colors.nodeBg,
    entityBorder: colors.nodeBorder,
    entityTextColor: colors.nodeText,
    relationColor: colors.line,
    relationLabelColor: colors.line,
    relationLabelBackground: colors.labelBg,
    // Flowchart
    nodeBkg: colors.nodeBg,
    // Notes
    noteBkgColor: colors.noteBg,
    noteTextColor: colors.nodeText,
    noteBorderColor: colors.noteBorder,
    // Actor (sequence diagrams)
    actorBkg: colors.nodeBg,
    actorTextColor: colors.nodeText,
    actorBorder: colors.nodeBorder,
    actorLineColor: colors.line,
    // Signals
    signalColor: colors.nodeText,
    signalTextColor: colors.nodeText,
    // Labels
    labelBoxBkgColor: colors.labelBg,
    labelBoxBorderColor: colors.clusterBorder,
    labelTextColor: colors.nodeText,
    // Loop
    loopTextColor: colors.nodeText,
    // Activation
    activationBkgColor: colors.secondaryBg,
    activationBorderColor: colors.secondaryBorder,
    // Sequence numbers
    sequenceNumberColor: colors.nodeText,
  };
}

/**
 * Build mermaid themeCSS - uses CSS variables where possible for live theme switching.
 * For elements that themeVariables doesn't cover.
 */
export function getMermaidThemeCSS(colors: MermaidThemeColors) {
  return `
    /* ER diagram row striping */
    .row-rect-odd path[fill^="hsl"],
    .row-rect-odd rect[fill^="hsl"] { fill: ${colors.rowOdd} !important; }
    .row-rect-even path[fill^="hsl"],
    .row-rect-even rect[fill^="hsl"] { fill: ${colors.rowEven} !important; }
    /* Entity box & labels */
    .er .entityBox { fill: ${colors.nodeBg} !important; stroke: ${colors.nodeBorder} !important; }
    .er .entityLabel { fill: ${colors.nodeText} !important; }
    .er .relationshipLabel { fill: ${colors.line} !important; }
    .er .relationshipLine { stroke: ${colors.line} !important; }
    /* Cluster/subgraph borders */
    .cluster rect { stroke: ${colors.clusterBorder} !important; fill: ${colors.clusterBg} !important; }
    .cluster span { color: ${colors.nodeText} !important; }
    /* State diagram clusters */
    .statediagram-cluster rect.outer { stroke: ${colors.clusterBorder} !important; fill: ${colors.clusterBg} !important; }
    .statediagram-cluster rect.inner { fill: ${colors.labelBg} !important; }
  `;
}
