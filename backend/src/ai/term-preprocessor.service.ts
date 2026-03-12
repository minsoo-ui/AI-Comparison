import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Service to perfectly replace well-known logistics acronyms with their full descriptions.
 * Uses word-boundary matching so "THC" is matched, but not "MTHC..."
 */
@Injectable()
export class TermPreprocessorService {
  private readonly logger = new Logger(TermPreprocessorService.name);
  private termDictionary: Record<string, string> = {};

  constructor() {
    this.loadDictionary();
  }

  private loadDictionary() {
    try {
      // Find the term_dictionary.json file (located in the shared 'data' dir at project root)
      const rootDataPath = path.join(
        process.cwd(),
        '..',
        'data',
        'term_dictionary.json',
      );
      const backendDataPath = path.join(
        process.cwd(),
        'data',
        'term_dictionary.json',
      );

      const dictPath = fs.existsSync(rootDataPath)
        ? rootDataPath
        : backendDataPath;

      if (fs.existsSync(dictPath)) {
        this.termDictionary = fs.readJsonSync(dictPath);
        this.logger.log(
          `Loaded ${Object.keys(this.termDictionary).length} terms from dictionary.`,
        );
      } else {
        this.logger.warn(
          `Could not find term dictionary at ${dictPath}. Preprocessor will skip.`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Error loading term dictionary: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Scans text and carefully replaces acronyms with full terms based on term_dictionary.json
   * @param text The stripped OCR text (the table area)
   * @returns Transformed text
   */
  public processText(text: string): string {
    if (!text || Object.keys(this.termDictionary).length === 0) {
      return text;
    }

    let processedText = text;

    // We process each key carefully
    for (const [key, value] of Object.entries(this.termDictionary)) {
      // Escape exact key for Regex (like D/O)
      const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

      // Use word boundaries \b to ensure exact match of the token.
      // But \b doesn't work well if the key contains symbols (like D/O).
      // So we use a lookbehind and lookahead approach for robust isolated token matching.
      // E.g., match if it's surrounded by space, punctuation, or string start/end.
      const boundaryRegex = new RegExp(
        `(?<=[\\s,.:;"'(]|^)${escapedKey}(?=[\\s,.:;"')]|$)`,
        'gi',
      );

      processedText = processedText.replace(boundaryRegex, value);
    }

    return processedText;
  }
}
