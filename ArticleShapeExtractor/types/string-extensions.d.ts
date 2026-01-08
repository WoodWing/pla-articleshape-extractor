export {};

declare global {
  interface String {
    /**
     * Remove characters or whitespaces from the start of string.
     */
    ltrim(characters?: string): string;

    /**
     * Remove characters or whitespaces from the end of string.
     */
    rtrim(characters?: string): string;

    /**
     * Escape regex special characters.
     * @internal
     */
    _escapeRegExChars(characters: string): string;
  }
}
