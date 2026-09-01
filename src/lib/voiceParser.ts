import { toDateOnly } from './utils';
import { detectCategory } from './merchantMap';
import type { ParsedVoice } from './types';

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  thousand: 1000, lakh: 100000, lac: 100000
};

function wordsToNumber(words: string): number {
  const tokens = words.toLowerCase().split(/\s+/);
  let total = 0;
  let current = 0;
  for (const token of tokens) {
    const val = WORD_NUMBERS[token];
    if (!val) continue;
    if (val === 100 || val === 1000 || val === 100000) {
      current = current === 0 ? 1 : current;
      total += current * val;
      current = 0;
    } else if (token === 'hundred') {
      current = current === 0 ? 1 : current;
      total += current * 100;
      current = 0;
    } else {
      current += val;
    }
  }
  return total + current;
}

export function parseVoice(raw: string): ParsedVoice {
  const text = raw.trim();
  const normalized = text.toLowerCase();

  const numberMatch = normalized.match(
    /(\d+(?:[,.]\d{1,2})?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh|lac)\b(?:\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand))?)\s*(?:rupees|rupay|rs|rs\.|inr|₹|bucks|dollars|dollar|euros|pounds)?/i
  );

  let amount = 0;
  if (numberMatch) {
    const valStr = numberMatch[1];
    if (/^\d/.test(valStr)) {
      amount = parseFloat(valStr.replace(/,/g, ''));
    } else {
      amount = wordsToNumber(valStr);
    }
  }

  const merchantMatch = text.match(/\b(?:at|for|on|from)\s+([A-Za-z][A-Za-z0-9&.' ]*)/i);
  const merchant = merchantMatch && merchantMatch[1].trim().split(/\s+/).slice(0, 3).join(' ') || '';

  const merchantKeywords = [
    'starbucks', 'zomato', 'swiggy', 'uber', 'ola', 'amazon', 'flipkart',
    'netflix', 'spotify', 'dmart', 'bigbasket', 'dominos', 'mcdonald'
  ];
  let foundMerchant = '';
  for (const kw of merchantKeywords) {
    if (normalized.includes(kw)) {
      foundMerchant = kw.charAt(0).toUpperCase() + kw.slice(1);
      break;
    }
  }
  const finalMerchant = foundMerchant || merchant || 'Unknown';

  const categoryHint = detectCategory(finalMerchant) ?? 'Other';

  return { amount, merchant: finalMerchant, categoryHint, raw: text };
}

export const SAMPLE_VOICE_PHRASES = [
  'I spent 500 on food',
  '200 rupees for petrol',
  'Paid 1000 for electricity bill',
  'Coffee at Starbucks 350 rupees',
  'Uber ride 250',
  'Grocery shopping 2000 rupees',
  'Rent 15000',
  'Bought books worth 800 rupees',
  'One thousand five hundred rupees for groceries',
  'Spent 2500 on a new shirt'
];

export function speechRecognitionAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  );
}
