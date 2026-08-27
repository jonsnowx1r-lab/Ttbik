/**
 * Registry for "studio" tools: real, self-contained interactive tools (audio/
 * video/image processing that runs entirely in the visitor's browser) sold
 * as permanent access via the same order-code gate as the AI tools, but
 * without any AI/Groq call — the tool itself does the work client-side.
 */
export const STUDIO_TOOL_LABELS: Record<string, { title: string }> = {
  "audio-visualizer": { title: "استوديو تحويل الصوت إلى فيديو ريلز" },
};

export type StudioToolKey = keyof typeof STUDIO_TOOL_LABELS;
