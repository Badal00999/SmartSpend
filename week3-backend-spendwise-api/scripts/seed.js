/**
 * Seed script – creates a demo user with ~30 realistic transactions.
 *
 *   npm run seed
 *
 * Safe to re-run: it deletes and recreates the demo user's data only.
 * Demo login →  demo@spendwise.app / Demo1234
 */
import { connectDB, disconnectDB } from '../src/config/db.js'
import { User } from '../src/models/User.js'
import { Transaction } from '../src/models/Transaction.js'
import { logger } from '../src/utils/logger.js'

export const DEMO_USER = { name: 'Demo User', email: 'demo@spendwise.app', password: 'Demo1234', currency: 'INR' }

const daysAgo = (n) => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

// [title, amount, type, category, payment, daysAgo, notes]
const ROWS = [
  ['Monthly salary', 85000, 'income', 'salary', 'bank', 3, 'September salary credited'],
  ['Grocery run – Reliance Fresh', 2340, 'expense', 'food', 'upi', 1, 'Weekly vegetables, milk and snacks'],
  ['Uber to office', 260, 'expense', 'transport', 'wallet', 1, ''],
  ['Netflix subscription', 649, 'expense', 'entertainment', 'card', 2, 'Standard plan'],
  ['Electricity bill', 1870, 'expense', 'bills', 'upi', 4, 'PSPCL – August cycle'],
  ['Zomato dinner', 540, 'expense', 'food', 'upi', 5, 'Friday night order'],
  ['Logo design project', 12000, 'income', 'freelance', 'bank', 6, 'Client: Sharma Textiles'],
  ['New running shoes', 3499, 'expense', 'shopping', 'card', 8, 'Decathlon'],
  ['Petrol', 2000, 'expense', 'transport', 'card', 10, ''],
  ['Doctor consultation', 800, 'expense', 'health', 'cash', 12, 'Annual check-up'],
  ['Udemy course – Node.js', 499, 'expense', 'education', 'card', 14, 'REST API masterclass'],
  ['Mobile recharge', 299, 'expense', 'bills', 'upi', 16, 'Jio 28-day plan'],
  ['Movie night', 700, 'expense', 'entertainment', 'card', 18, 'PVR – two tickets'],
  ['Weekend trip to Dharamshala', 6800, 'expense', 'travel', 'card', 22, 'Hotel + bus'],
  ['Monthly salary', 85000, 'income', 'salary', 'bank', 34, 'August salary credited'],
  ['Grocery run', 2950, 'expense', 'food', 'upi', 36, ''],
  ['Internet bill', 999, 'expense', 'bills', 'upi', 40, 'Airtel Fiber'],
  ['Gym membership', 1500, 'expense', 'health', 'upi', 45, 'Quarterly plan'],
  ['Birthday gift', 1800, 'expense', 'shopping', 'card', 50, 'For Priya'],
  ['Auto rickshaw', 120, 'expense', 'transport', 'cash', 52, ''],
  ['Monthly salary', 85000, 'income', 'salary', 'bank', 64, 'July salary credited'],
  ['Website maintenance', 8000, 'income', 'freelance', 'bank', 70, 'Retainer'],
  ['Restaurant – family dinner', 3200, 'expense', 'food', 'card', 72, ''],
  ['Electricity bill', 2210, 'expense', 'bills', 'upi', 75, ''],
  ['Books', 1150, 'expense', 'education', 'card', 80, 'Two paperbacks'],
  ['Monthly salary', 85000, 'income', 'salary', 'bank', 95, 'June salary credited'],
  ['Laptop repair', 4500, 'expense', 'other', 'cash', 100, 'Battery replacement'],
  ['Concert tickets', 2500, 'expense', 'entertainment', 'card', 105, ''],
  ['Grocery run', 2600, 'expense', 'food', 'upi', 110, ''],
  ['Monthly salary', 85000, 'income', 'salary', 'bank', 125, 'May salary credited'],
  ['Flight to Delhi', 5200, 'expense', 'travel', 'card', 130, 'Work trip'],
  ['Pharmacy', 640, 'expense', 'health', 'upi', 135, ''],
]

export async function seedDemoData() {
  await User.deleteOne({ email: DEMO_USER.email })
  const user = await User.create(DEMO_USER)
  await Transaction.deleteMany({ user: user._id })
  const docs = ROWS.map(([title, amount, type, category, payment, ago, notes]) => ({
    user: user._id,
    title,
    amount,
    type,
    category,
    payment,
    date: daysAgo(ago),
    notes,
  }))
  const created = await Transaction.insertMany(docs)
  return { user, count: created.length }
}

// Run directly: node scripts/seed.js
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  try {
    await connectDB()
    const { user, count } = await seedDemoData()
    logger.info(`Seeded ${count} transactions for ${user.email} (password: ${DEMO_USER.password})`)
  } catch (err) {
    logger.error('Seed failed', err)
    process.exitCode = 1
  } finally {
    await disconnectDB()
  }
}
