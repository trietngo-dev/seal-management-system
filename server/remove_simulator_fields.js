// One-off cleanup after the Lexatek simulator / MQTT integration was removed.
// Unsets simulator credentials and codes from teams and environmentId from tracks.
// Dry run by default; pass --apply to write.
//   node remove_simulator_fields.js          -> count affected documents
//   node remove_simulator_fields.js --apply  -> unset the fields
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
const APPLY = process.argv.includes('--apply');

const TEAM_FIELDS = [
  'externalTeamId', 'externalTeamCode', 'accessCode', 'testApiKey', 'judgeApiKey',
  'mqttUsername', 'mqttPassword', 'testTopic', 'judgeTopic'
];
const TRACK_FIELDS = ['environmentId'];

function anyFieldExists(fields) {
  return { $or: fields.map(f => ({ [f]: { $exists: true } })) };
}

function unsetAll(fields) {
  return { $unset: Object.fromEntries(fields.map(f => [f, ''])) };
}

mongoose.connect(MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const targets = [
    { name: 'teams', fields: TEAM_FIELDS },
    { name: 'tracks', fields: TRACK_FIELDS }
  ];

  for (const { name, fields } of targets) {
    const filter = anyFieldExists(fields);
    const count = await db.collection(name).countDocuments(filter);
    if (!APPLY) {
      console.log(`[DRY RUN] ${name}: ${count} document(s) have simulator fields.`);
      continue;
    }
    const result = await db.collection(name).updateMany(filter, unsetAll(fields));
    console.log(`${name}: unset simulator fields on ${result.modifiedCount} document(s).`);
  }

  if (!APPLY) console.log('Re-run with --apply to remove the fields.');
  await mongoose.disconnect();
}).catch(err => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});
