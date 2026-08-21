import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  /**
   * Generates high-fidelity Neural Female Voice MP3 audio Data URI for Malayalam or English.
   * Chunks long responses seamlessly so the audio is never cut off.
   */
  async generateNeuralSpeech(text: string, language: 'ml' | 'en'): Promise<string | null> {
    try {
      const speechText = this.prepareSpeechText(text, language);
      if (!speechText) return null;

      const chunks = this.splitIntoChunks(speechText, 160);
      if (chunks.length === 0) return null;

      this.logger.log(
        `[KENBY_TTS] Generating speech for ${language} (${chunks.length} chunks): "${speechText.substring(0, 50)}..."`
      );

      const audioBuffers: Buffer[] = [];
      for (const chunk of chunks) {
        const buf = await this.fetchGoogleTtsAudioBuffer(chunk, language === 'ml' ? 'ml' : 'en');
        if (buf && buf.length > 0) {
          audioBuffers.push(buf);
        }
      }

      if (audioBuffers.length === 0) return null;

      const concatenated = Buffer.concat(audioBuffers);
      return `data:audio/mp3;base64,${concatenated.toString('base64')}`;
    } catch (err: any) {
      this.logger.error(`[KENBY_TTS] Error generating TTS audio: ${err.message}`);
      return null;
    }
  }

  /**
   * Prepares clean SPEECH_TEXT by stripping markdown noise, raw brackets, bullets,
   * converting numbers, and normalizing units for natural spoken flow.
   */
  public prepareSpeechText(text: string, language: 'ml' | 'en'): string {
    if (!text) return '';

    let clean = text
      .replace(/[\*\#\_]/g, '') // remove markdown symbols
      .replace(/\[.*?\]/g, '')  // remove markdown link brackets
      .replace(/[\(\)]/g, ' ')  // replace parentheses with space
      .replace(/[\—\–]/g, ', ') // replace em-dashes with comma pauses
      .replace(/[📊🧠📦📈🏭↩⚠👋😊✨🤖•①②③④⑤\u2022\u25E6\u2023\u2219]/g, ' ') // remove emojis and bullet symbols
      .replace(/\n+/g, '. ')    // convert newlines to sentence pauses
      .replace(/\s+/g, ' ')     // collapse multiple spaces
      .trim();

    // Strip commas from numbers so TTS reads '1000' naturally instead of reading 'comma'
    clean = clean.replace(/(\d+),(\d+)/g, '$1$2');

    // Currency and unit speech normalization
    // Month names for TTS date pronunciation (must cover all 12 months — never hardcode a single month)
    const monthNamesMl = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (language === 'ml') {
      clean = clean
        .replace(/₹\s*(\d+)/g, '$1 രൂപ')
        .replace(/cases/gi, 'കേസുകൾ')
        .replace(/units/gi, 'യൂണിറ്റ്')
        .replace(/jars/gi, 'ജാർ')
        .replace(/bottles/gi, 'ബോട്ടിലുകൾ')
        // Dynamic month lookup: captures year($1), month-number($2), day($3) — never hardcode a month name
        .replace(/(\d{4})-(\d{2})-(\d{2})/g, (_match, y, m, d) => {
          const monthName = monthNamesMl[parseInt(m, 10) - 1] || m;
          return `${y} ${monthName} ${d}`;
        });
    } else {
      clean = clean
        .replace(/₹\s*(\d+)/g, '$1 rupees')
        // Dynamic month lookup: captures year($1), month-number($2), day($3) — never hardcode a month name
        .replace(/(\d{4})-(\d{2})-(\d{2})/g, (_match, y, m, d) => {
          const monthName = monthNamesEn[parseInt(m, 10) - 1] || m;
          return `${monthName} ${d}, ${y}`;
        });
    }

    return clean.trim();
  }

  /**
   * Splits normalized text into natural sentence/clause chunks under maxCharLength
   */
  public splitIntoChunks(text: string, maxLen: number = 160): string[] {
    if (!text) return [];
    if (text.length <= maxLen) return [text];

    const sentences = text.split(/(?<=[.?!,])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).trim().length <= maxLen) {
        currentChunk = (currentChunk + ' ' + sentence).trim();
      } else {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }

        if (sentence.length <= maxLen) {
          currentChunk = sentence;
        } else {
          // If a single sentence exceeds maxLen, split at word boundaries
          const words = sentence.split(/\s+/);
          let subChunk = '';
          for (const word of words) {
            if ((subChunk + ' ' + word).trim().length <= maxLen) {
              subChunk = (subChunk + ' ' + word).trim();
            } else {
              if (subChunk.length > 0) chunks.push(subChunk);
              subChunk = word;
            }
          }
          if (subChunk.length > 0) currentChunk = subChunk;
        }
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks.filter((c) => c.trim().length > 0);
  }

  private fetchGoogleTtsAudioBuffer(text: string, langCode: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const encodedText = encodeURIComponent(text);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${langCode}&client=tw-ob`;

      const req = https.get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            this.logger.warn(`Google TTS API returned status code ${res.statusCode} for chunk "${text.substring(0, 20)}"`);
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            resolve(Buffer.concat(chunks));
          });
        }
      );

      req.on('error', (err) => {
        this.logger.warn(`Google TTS API request error: ${err.message}`);
        resolve(null);
      });

      req.setTimeout(6000, () => {
        req.destroy();
        resolve(null);
      });
    });
  }
}
