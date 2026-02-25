// utils/emailNotificationSettings.js  ✅ (NEW for flags Map design)
const EmailNotificationSettings = require("../models/emailNotificationSettingsModel");
const EMAIL_KEYS = require("./emailNotificationKeys");

const TTL_MS = 30_000;
let cache = { flags: null, expiresAt: 0 };

const ALL_KEYS = Object.values(EMAIL_KEYS);

function defaultFlags() {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, true]));
}

function flagsToObject(flags) {
  if (!flags) return {};
  if (flags instanceof Map) return Object.fromEntries(flags.entries());
  if (typeof flags === "object") return { ...flags };
  return {};
}

function normalize(doc) {
  return { ...defaultFlags(), ...flagsToObject(doc?.flags) };
}

async function getFlagsCached() {
  const now = Date.now();
  if (cache.flags && cache.expiresAt > now) return cache.flags;

  const doc = await EmailNotificationSettings.findOneAndUpdate(
    {},
    { $setOnInsert: { flags: defaultFlags() } },
    { new: true, upsert: true },
  );

  const flags = normalize(doc);
  cache = { flags, expiresAt: now + TTL_MS };
  return flags;
}

// key can be "cto_approval" etc.
async function isEmailEnabled(key) {
  try {
    const flags = await getFlagsCached();
    return !!flags[key]; // defaults to true from normalize()
  } catch (e) {
    // fail-open (same behavior as your old util)
    console.error(
      "[EMAIL SETTINGS] failed to load, defaulting to ON:",
      e?.message,
    );
    return true;
  }
}

function bustEmailSettingsCache() {
  cache = { flags: null, expiresAt: 0 };
}

module.exports = { isEmailEnabled, bustEmailSettingsCache };
