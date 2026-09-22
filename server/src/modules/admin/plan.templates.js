/**
 * Ready-made plans an admin can add in one click.
 *
 * Priced from the running cost of a call: LemonSlice is about $0.164 a minute
 * (see avatar/capabilities.js) plus a few cents for speech and the language
 * model, so every paid plan works out above $0.24 a minute. Adjust freely once
 * added - they are ordinary plans. None is made the default, so adding them
 * changes nothing for new sign-ups until an admin chooses.
 */
export const PLAN_TEMPLATES = [
  {
    key: "free",
    name: "Free",
    description: "Try it out: one avatar and a few minutes a month.",
    priceCents: 0,
    includedMinutes: 10,
    overageEnabled: false,
    concurrencyLimit: 1,
    maxAvatars: 1,
  },
  {
    key: "starter",
    name: "Starter",
    description: "For individuals getting started.",
    priceCents: 2900,
    includedMinutes: 100,
    overageEnabled: false,
    concurrencyLimit: 2,
    maxAvatars: 3,
  },
  {
    key: "pro",
    name: "Pro",
    description: "For teams running avatars every day.",
    priceCents: 9900,
    includedMinutes: 400,
    overageEnabled: true,
    concurrencyLimit: 5,
    maxAvatars: 10,
  },
  {
    key: "business",
    name: "Business",
    description: "For high-volume support and sales.",
    priceCents: 29900,
    includedMinutes: 1200,
    overageEnabled: true,
    concurrencyLimit: 20,
    maxAvatars: 0,
  },
];
