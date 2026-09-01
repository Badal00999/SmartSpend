import { toDateOnly } from './utils';
import { detectCategory } from './merchantMap';
import type { ParsedSms } from './types';

const AMOUNT_PATTERNS = [
  /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  /(?:inr|rs|rupay|rupees)\s*([\d,]+(?:\.\d{1,2})?)/gi
];

const DATE_PATTERNS = [
  /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/g,
  /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,.-]*(\d{2,4})/gi
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

const MERCHANT_HINTS = [
  /(?:at|at\s|from|via|on)\s+([A-Z][A-Za-z0-9 &.]+?)(?=[.,]|$|\s\d)/g,
  /(?:UPI\/|info:\s*upi\/)?([A-Z][A-Za-z0-9 &.]+)/,
  /paid\s+(?:₹|Rs\.?|INR)\s*[\d,.]+\s+to\s+([A-Za-z][A-Za-z0-9 &.]+)/i
];

const ACCOUNT_PATTERNS = [
  /(?:A\/C|A\/c|acct|account)\s*(?:No\.?)?\s*(?:XXXX|XX)?(\d{3,4})/i,
  /(?:card\s+ending|card\s+[Xx]+)\s*(\d{4})/i,
  /XX(\d{4})/i,
  /X{2,4}(\d{3,4})/i
];

const TYPE_PATTERNS = [
  { type: 'debit' as const, re: /(?:debited|spent|paid|purchase|withdrawn|used|upi\/(?:pay|txn))/i },
  { type: 'credit' as const, re: /(?:credited|received|refund|deposited|cashback|added to)/i }
];

function normalizeDate(day: number, month: number, year: number): string {
  let fullYear = year;
  if (year < 100) {
    fullYear = year >= 50 ? 1900 + year : 2000 + year;
  }
  if (fullYear < 1970) fullYear = 2000 + year;
  return toDateOnly(new Date(fullYear, month - 1, day));
}

function extractAmount(text: string): number | null {
  for (const re of AMOUNT_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  const alt = text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|rupaye|rs\.?|inr)/i);
  if (alt) {
    const num = parseFloat(alt[1].replace(/,/g, ''));
    if (!isNaN(num)) return num;
  }
  return null;
}

function extractDate(text: string): string | null {
  for (const re of DATE_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      if (m[3]) {
        return normalizeDate(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
      }
      const monthNum = MONTHS[m[2].slice(0, 3).toLowerCase()];
      if (monthNum) {
        return normalizeDate(parseInt(m[1], 10), monthNum, parseInt(m[3], 10));
      }
    }
  }
  return null;
}

function cleanMerchant(raw: string): string {
  return raw
    .replace(/^(at|from|via|on)\s+/i, '')
    .replace(/\.\s*(avail|avl|bal|balance).*$/i, '')
    .replace(/[.,;]+$/, '')
    .replace(/upi\//i, '')
    .trim();
}

function extractMerchant(text: string): string {
  for (const re of MERCHANT_HINTS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const hint = cleanMerchant(m[1]);
      if (hint.length >= 2 && !/(hdfc|sbi|icici|axis|kotak|bank|a\/c)/i.test(hint)) {
        return hint;
      }
    }
  }
  const gpay = text.match(/upi\/?(?:pay)?\s*([A-Za-z][A-Za-z0-9 &.]+)/i);
  if (gpay) {
    const hint = cleanMerchant(gpay[1]);
    if (hint.length >= 2) return hint;
  }
  return 'Unknown Merchant';
}

export function parseSms(raw: string): ParsedSms {
  const amount = extractAmount(raw) ?? 0;
  const date = extractDate(raw) ?? toDateOnly(new Date());
  const accountLast4 = extractAccount(raw);
  const type = detectType(raw);
  const merchant = extractMerchant(raw);

  return {
    amount,
    merchant,
    date,
    accountLast4,
    type,
    raw
  };
}

function extractAccount(text: string): string | undefined {
  for (const re of ACCOUNT_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m && m[1]) return m[1];
  }
  return undefined;
}

function detectType(text: string): 'debit' | 'credit' {
  const debit = /(?:debited|spent|paid|purchase|withdrawn)/i.test(text);
  const credit = /(?:credited|received|refund|deposited|cashback)/i.test(text);
  if (debit && !credit) return 'debit';
  if (credit && !debit) return 'credit';
  return 'debit';
}

export function categorizeMerchant(merchant: string): string {
  return detectCategory(merchant) ?? 'Other';
}

export const SAMPLE_SMS: string[] = [
  'INR 500.00 debited from A/C XXXX1234 on 12-Jan-25. Info: UPI/Zomato. Avl Bal: INR 9500.00',
  'Rs.1200 spent on HDFC Credit Card XX1234 at Amazon on 12-Jan-2025',
  'Dear Customer, your A/C XX5678 is debited with Rs.250.00 on 12-01-2025. UPI Ref: 1234567890',
  'Paid ₹500 to Swiggy via GPay UPI',
  'Transaction of INR 2000 on your Debit Card ending 1234 at Flipkart',
  'INR 350 credited to A/C XXXX4567 on 05-Feb-25. Ref: REFUND from Amazon. Avl Bal: INR 12000.00',
  'You have spent Rs.80.00 on your ICICI Bank Card XX4455 at Starbucks on 08-02-2025'
];
