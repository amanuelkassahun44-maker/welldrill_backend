import { db } from '../config/database';

async function seed() {
  console.log('🌱 Seeding Ethiopia location data...');
  const regions = [
    { name_en: 'Addis Ababa', name_am: 'አዲስ አበባ' },
    { name_en: 'Oromia', name_am: 'ኦሮሚያ' },
    { name_en: 'Amhara', name_am: 'አማራ' },
    { name_en: 'Tigray', name_am: 'ትግራይ' },
    { name_en: 'SNNPR', name_am: 'ደቡብ ብሄሮች' },
    { name_en: 'Afar', name_am: 'አፋር' },
    { name_en: 'Somali', name_am: 'ሶማሌ' },
    { name_en: 'Benishangul-Gumuz', name_am: 'ቤኒሻንጉል-ጉምዝ' },
    { name_en: 'Gambela', name_am: 'ጋምቤላ' },
    { name_en: 'Harari', name_am: 'ሐረሪ' },
    { name_en: 'Dire Dawa', name_am: 'ድሬ ዳዋ' },
    { name_en: 'Sidama', name_am: 'ሲዳማ' },
    { name_en: 'South West Ethiopia', name_am: 'ደቡብ ምዕራብ ኢትዮጵያ' },
  ];
  for (const r of regions) {
    await db.query(
      'INSERT INTO regions (name_en, name_am) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [r.name_en, r.name_am]
    );
  }
  // Seed major zones for Oromia
  const oromia = await db.query(`SELECT id FROM regions WHERE name_en = 'Oromia'`);
  if (oromia.rows[0]) {
    const zones = [
      { name_en: 'West Hararghe', name_am: 'ምዕራብ ሃረርጌ' },
      { name_en: 'East Hararghe', name_am: 'ምስራቅ ሃረርጌ' },
      { name_en: 'West Shewa', name_am: 'ምዕራብ ሸዋ' },
      { name_en: 'East Shewa', name_am: 'ምስራቅ ሸዋ' },
      { name_en: 'Arsi', name_am: 'አርሲ' },
      { name_en: 'Bale', name_am: 'ባሌ' },
      { name_en: 'Borena', name_am: 'ቦረና' },
      { name_en: 'Guji', name_am: 'ጉጂ' },
    ];
    for (const z of zones) {
      await db.query(
        'INSERT INTO zones (region_id, name_en, name_am) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [oromia.rows[0].id, z.name_en, z.name_am]
      );
    }
  }
  console.log('✅ Seed complete!');
  process.exit(0);
}
seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
