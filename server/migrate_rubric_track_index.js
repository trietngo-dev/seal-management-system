// One-off index migration for per-track rubrics.
// The old unique index allowed one active rubric per round; the new one allows one per
// (round, track), with the round-wide rubric having no trackId.
// Dry run by default; pass --apply to write.
//   node migrate_rubric_track_index.js          -> show what would change
//   node migrate_rubric_track_index.js --apply  -> drop the old index, create the new one
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
const APPLY = process.argv.includes('--apply');

const OLD_INDEX = 'roundId_1';
const NEW_KEYS = { roundId: 1, trackId: 1 };
const NEW_OPTIONS = { unique: true, partialFilterExpression: { isActive: true } };

mongoose.connect(MONGO_URI).then(async () => {
  const rubrics = mongoose.connection.db.collection('rubrics');
  const indexes = await rubrics.indexes();
  const hasOld = indexes.some(i => i.name === OLD_INDEX);
  const hasNew = indexes.some(i => i.name === 'roundId_1_trackId_1');

  console.log(`Old index ${OLD_INDEX}: ${hasOld ? 'present' : 'absent'}`);
  console.log(`New index roundId_1_trackId_1: ${hasNew ? 'present' : 'absent'}`);

  if (!APPLY) {
    console.log('Re-run with --apply to migrate.');
  } else {
    if (!hasNew) {
      await rubrics.createIndex(NEW_KEYS, NEW_OPTIONS);
      console.log('Created roundId_1_trackId_1.');
    }
    if (hasOld) {
      await rubrics.dropIndex(OLD_INDEX);
      console.log(`Dropped ${OLD_INDEX}.`);
    }
  }
  await mongoose.disconnect();
}).catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
