#!/usr/bin/env node
/**
 * Print VAPID keys for Web Push (contractor booked-job notifications).
 * Copy into Vercel env / .env.local — never commit the private key.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const webpush = require("web-push");

const keys = webpush.generateVAPIDKeys();
process.stdout.write(
  [
    `# Contractor Web Push (PWA). Generate with: npm run vapid:keys`,
    `VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    `VAPID_SUBJECT=https://www.tradesondemand.com`,
    "",
  ].join("\n"),
);
