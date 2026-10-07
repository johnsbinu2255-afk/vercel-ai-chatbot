# Car Shop

Stock, billing and reports for a car accessory shop, built with Next.js and Supabase. It works on phones and computers and can be added to the home screen like an app.

## What it does

- **Sell:** search or scan product codes, add fitting charges and serial numbers, take cash, UPI, card or udhaar (with part payment), send the bill on WhatsApp or print it.
- **Stock:** bulk add new products (or paste them from Excel), add delivered quantities for many products at once, count stock, and see every stock change.
- **Customers:** cars, purchase history and warranty months left; an udhaar book with WhatsApp reminders.
- **Fitting jobs and quotations:** track cars in the shop and turn jobs or quotations into bills.
- **Owner only:** buying prices, profit, suppliers and purchases, expenses and daily cash closing, reports for day / week / month / quarter / year (Indian financial year) with profit per product, and a night summary to send on WhatsApp.
- **Backup:** download all bills and the stock list as Excel (CSV) files.

There is no GST in bills.

## Owner and staff

Everyone signs in with an email and password.

- The first person to open a new shop taps **Set up my shop** and becomes the owner.
- The owner adds staff emails in **More → Settings → Staff**. Staff then create an account with that same email.
- Staff can sell, add stock and manage customers, jobs and quotations. Buying prices, profit, suppliers, expenses and reports are protected by row level security in the database, so staff can't read them even through the API.

## Setup

1. Create a Supabase project and run the SQL in `supabase/migrations/` in order (in the dashboard's SQL Editor, or with `supabase db push`). `20261006000000_shop.sql` creates everything the app uses; later files add to it.
2. In Supabase **Authentication → Sign In / Providers → Email**, keep email sign-in on. Turn **Confirm email** off if staff should be able to sign in right away.
3. Copy `.env.example` to `.env` (or set these in Vercel) and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from **Project Settings → API**.
4. Install and run:

```bash
pnpm install
pnpm dev
```

The app runs at [localhost:3000](http://localhost:3000/).
