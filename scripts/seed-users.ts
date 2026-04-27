import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PASSWORD = 'Dsober123!';
const TEST_PHONE = '+1 (571) 419-3903';

const GROUPS = [
  { abbr: 'abg', name: 'Alpha Beta Gamma', code: 'ABG2024' },
  { abbr: 'dez', name: 'Delta Epsilon Zeta', code: 'DEZ2024' },
  { abbr: 'tkl', name: 'Theta Kappa Lambda', code: 'TKL2024' },
  { abbr: 'ktp', name: 'Kappa Theta Pie', code: 'KTP2024' },
];

interface AccountDef {
  email: string;
  name: string;
  role: 'admin' | 'member';
  is_dd: boolean;
  dd_status: 'none' | 'active' | 'revoked';
  car_make?: string;
  car_model?: string;
  car_plate?: string;
  birthday: string;
  age: number;
  gender: string;
  type: string;
}

function buildAccounts(abbr: string): AccountDef[] {
  const g = abbr.toUpperCase();
  return [
    {
      email: `admin1.${abbr}@dsober.test`,
      name: `Admin One ${g}`,
      role: 'admin',
      is_dd: false,
      dd_status: 'none',
      birthday: '1998-03-15',
      age: 28,
      gender: 'Male',
      type: 'Admin',
    },
    {
      email: `admin2.${abbr}@dsober.test`,
      name: `Admin Two ${g}`,
      role: 'admin',
      is_dd: false,
      dd_status: 'none',
      birthday: '1999-07-22',
      age: 27,
      gender: 'Female',
      type: 'Admin',
    },
    {
      email: `dd1.${abbr}@dsober.test`,
      name: `DD One ${g}`,
      role: 'member',
      is_dd: true,
      dd_status: 'active',
      car_make: 'Toyota',
      car_model: 'Camry',
      car_plate: 'TRK-1001',
      birthday: '2000-01-10',
      age: 26,
      gender: 'Male',
      type: 'DD',
    },
    {
      email: `dd2.${abbr}@dsober.test`,
      name: `DD Two ${g}`,
      role: 'member',
      is_dd: true,
      dd_status: 'active',
      car_make: 'Honda',
      car_model: 'Civic',
      car_plate: 'HND-2002',
      birthday: '2001-04-18',
      age: 25,
      gender: 'Female',
      type: 'DD',
    },
    {
      email: `dd3.${abbr}@dsober.test`,
      name: `DD Three ${g}`,
      role: 'member',
      is_dd: true,
      dd_status: 'active',
      car_make: 'Ford',
      car_model: 'Focus',
      car_plate: 'FRD-3003',
      birthday: '2000-09-05',
      age: 25,
      gender: 'Male',
      type: 'DD',
    },
    {
      email: `dd4.${abbr}@dsober.test`,
      name: `DD Four ${g}`,
      role: 'member',
      is_dd: true,
      dd_status: 'active',
      car_make: 'Nissan',
      car_model: 'Altima',
      car_plate: 'NSN-4004',
      birthday: '2001-12-03',
      age: 24,
      gender: 'Female',
      type: 'DD',
    },
    {
      email: `revoked.${abbr}@dsober.test`,
      name: `Revoked DD ${g}`,
      role: 'member',
      is_dd: false,
      dd_status: 'revoked',
      car_make: 'Chevy',
      car_model: 'Malibu',
      car_plate: 'RVK-5005',
      birthday: '1999-12-01',
      age: 26,
      gender: 'Male',
      type: 'Revoked DD',
    },
    {
      email: `passenger1.${abbr}@dsober.test`,
      name: `Passenger One ${g}`,
      role: 'member',
      is_dd: false,
      dd_status: 'none',
      birthday: '2002-06-14',
      age: 23,
      gender: 'Female',
      type: 'Passenger',
    },
    {
      email: `passenger2.${abbr}@dsober.test`,
      name: `Passenger Two ${g}`,
      role: 'member',
      is_dd: false,
      dd_status: 'none',
      birthday: '2001-11-30',
      age: 24,
      gender: 'Male',
      type: 'Passenger',
    },
    {
      email: `passenger3.${abbr}@dsober.test`,
      name: `Passenger Three ${g}`,
      role: 'member',
      is_dd: false,
      dd_status: 'none',
      birthday: '2003-02-08',
      age: 22,
      gender: 'Female',
      type: 'Passenger',
    },
  ];
}

async function authAdminFetch(method: string, path: string, body?: object) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res;
}

async function deleteAllUsers() {
  console.log('\n🗑️  Deleting all existing users...');

  // Get IDs from public.users (service role bypasses RLS)
  const { data: profileRows, error: fetchErr } = await supabase
    .from('users')
    .select('id, email');

  if (fetchErr) {
    console.error('❌ Failed to fetch user profiles:', fetchErr.message);
    process.exit(1);
  }

  const profiles = profileRows ?? [];
  if (profiles.length === 0) {
    console.log('   No existing users to delete.');
    return;
  }

  let deleted = 0;
  const staleIds: string[] = [];
  for (const profile of profiles) {
    const res = await authAdminFetch('DELETE', `/users/${profile.id}`);
    if (res.ok) {
      deleted++;
    } else {
      // Auth user likely doesn't exist — collect stale profile for direct cleanup
      staleIds.push(profile.id);
    }
  }

  // Remove stale public.users rows that have no matching auth user
  if (staleIds.length > 0) {
    const { error: cleanErr } = await supabase
      .from('users')
      .delete()
      .in('id', staleIds);
    if (cleanErr) {
      console.warn(`   ⚠️  Could not purge ${staleIds.length} stale profile(s): ${cleanErr.message}`);
    } else {
      console.log(`   ✓ Purged ${staleIds.length} stale profile(s) directly.`);
    }
  }

  console.log(`   ✓ Deleted ${deleted + staleIds.length}/${profiles.length} user(s).`);
}

async function fetchGroupIds(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('groups').select('id, name');
  if (error || !data) {
    console.error('❌ Failed to fetch groups:', error?.message);
    process.exit(1);
  }
  const map: Record<string, string> = {};
  for (const g of data) {
    const match = GROUPS.find((gr) => gr.name === g.name);
    if (match) map[match.abbr] = g.id;
  }

  // Insert any missing groups
  const missing = GROUPS.filter((g) => !map[g.abbr]);
  for (const g of missing) {
    console.log(`   ↳ Inserting missing group: ${g.name} (${g.code})`);
    const { data: inserted, error: insertErr } = await supabase
      .from('groups')
      .insert({ name: g.name, access_code: g.code })
      .select('id')
      .single();
    if (insertErr || !inserted) {
      console.error(`❌ Failed to insert group ${g.name}:`, insertErr?.message);
      process.exit(1);
    }
    map[g.abbr] = inserted.id;
  }

  return map;
}

interface CreatedAccount extends AccountDef {
  groupName: string;
  groupCode: string;
}

async function createAccount(
  account: AccountDef,
  groupId: string,
  groupName: string,
  groupCode: string
): Promise<CreatedAccount | null> {
  const res = await authAdminFetch('POST', '/users', {
    email: account.email,
    password: PASSWORD,
    email_confirm: true,
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn(`   ⚠️  Auth create failed for ${account.email}: ${res.status} ${body}`);
    return null;
  }

  const authData = await res.json() as { id: string };
  const userId = authData.id;

  const { error: insertErr } = await supabase.from('users').insert({
    id: userId,
    email: account.email,
    name: account.name,
    birthday: account.birthday,
    age: account.age,
    gender: account.gender,
    group_id: groupId,
    role: account.role,
    is_dd: account.is_dd,
    dd_status: account.dd_status,
    phone_number: TEST_PHONE,
    ...(account.car_make ? { car_make: account.car_make } : {}),
    ...(account.car_model ? { car_model: account.car_model } : {}),
    ...(account.car_plate ? { car_plate: account.car_plate } : {}),
  });

  if (insertErr) {
    console.warn(`   ⚠️  Profile insert failed for ${account.email}: ${insertErr.message}`);
    await authAdminFetch('DELETE', `/users/${userId}`);
    return null;
  }

  // Insert SEP baseline so onboarding is considered complete
  const reactionMs = 280 + (account.email.length % 7) * 20;   // 280–400ms range
  const phraseSec = 2.8 + (account.email.length % 9) * 0.25;  // 2.8–4.8s range
  const selfieUrl = `${supabaseUrl}/storage/v1/object/public/sep-selfies/seed-placeholder.png`;

  const { error: sepErr } = await supabase.from('sep_baselines').insert({
    user_id: userId,
    reaction_avg_ms: reactionMs,
    phrase_duration_sec: phraseSec,
    selfie_url: selfieUrl,
  });

  if (sepErr) {
    console.warn(`   ⚠️  SEP baseline insert failed for ${account.email}: ${sepErr.message}`);
  }

  return { ...account, groupName, groupCode };
}

function writeDevAccounts(created: CreatedAccount[], groups: typeof GROUPS) {
  const groupSection = groups
    .map((g) => `| ${g.name.padEnd(22)} | ${g.code}   |`)
    .join('\n');

  const rows = created.map((a) => {
    const car = a.car_make ? `${a.car_make} ${a.car_model} / ${a.car_plate}` : '—';
    return `| ${a.name.padEnd(24)} | ${a.email.padEnd(34)} | ${PASSWORD.padEnd(12)} | ${a.role.padEnd(6)} | ${a.type.padEnd(11)} | ${a.groupName.padEnd(22)} |`;
  });

  const content = `# Dev / Seed Accounts

Credentials for fake accounts seeded to the Supabase DB for development and demo purposes.
**DO NOT COMMIT — this file is gitignored.**

---

## Test Groups

| Group Name               | Access Code |
|--------------------------|-------------|
${groupSection}

---

## Test Users

**Password for all accounts:** \`${PASSWORD}\`
**Test phone (all accounts):** \`${TEST_PHONE}\`

| Name                     | Email                              | Password     | Role   | Type        | Group                    |
|--------------------------|------------------------------------|--------------|----|------------|--------------------------|
${rows.join('\n')}

---

## Quick Reference by Role

### Admins
${created
  .filter((a) => a.role === 'admin')
  .map((a) => `- \`${a.email}\` — ${a.groupName}`)
  .join('\n')}

### Active DDs
${created
  .filter((a) => a.is_dd && a.dd_status === 'active')
  .map((a) => `- \`${a.email}\` — ${a.groupName} (${a.car_make} ${a.car_model}, plate: ${a.car_plate})`)
  .join('\n')}

### Revoked DDs
${created
  .filter((a) => a.dd_status === 'revoked')
  .map((a) => `- \`${a.email}\` — ${a.groupName}`)
  .join('\n')}

### Passengers
${created
  .filter((a) => a.role === 'member' && !a.is_dd && a.dd_status === 'none')
  .map((a) => `- \`${a.email}\` — ${a.groupName}`)
  .join('\n')}

---

## Notes

- Supabase project: \`ybsinrajanwhabgivsvv\`
- Generated by: \`npm run seed-users\`
`;

  const filePath = path.resolve(__dirname, '../dev-accounts.md');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`\n📄 dev-accounts.md written to ${filePath}`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DSober User Seeder');
  console.log('═══════════════════════════════════════════════════');

  await deleteAllUsers();

  console.log('\n🔍 Fetching group IDs...');
  const groupIds = await fetchGroupIds();
  console.log('   ✓ Found all 4 groups.');

  const created: CreatedAccount[] = [];

  for (const group of GROUPS) {
    console.log(`\n👥 Seeding ${group.name} (${group.code})...`);
    const accounts = buildAccounts(group.abbr);
    for (const account of accounts) {
      const result = await createAccount(account, groupIds[group.abbr], group.name, group.code);
      if (result) {
        console.log(`   ✓ ${account.type.padEnd(11)} ${account.email}`);
        created.push(result);
      }
    }
  }

  writeDevAccounts(created, GROUPS);

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`✅ Done! ${created.length} users created across ${GROUPS.length} groups.`);
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
