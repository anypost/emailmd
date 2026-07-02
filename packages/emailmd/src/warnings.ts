/**
 * Non-fatal issue encountered during rendering. Rendering still produces
 * valid `html`/`text` output; warnings let callers surface problems to
 * end users (e.g. a banner in an editor UI).
 */
export interface RenderWarning {
  /**
   * Which render stage produced the warning:
   * - `frontmatter` — the YAML block could not be parsed
   * - `theme` — a theme or font value was invalid and the default was used
   * - `content` — a directive or button value was invalid and was dropped or defaulted
   * - `mjml` — MJML compilation reported an error (validation level `soft`)
   */
  stage: 'frontmatter' | 'theme' | 'content' | 'mjml';
  /** Human-readable message. */
  message: string;
  /** Original `Error`, when one was thrown internally. */
  cause?: Error;
}
