// Importa i testi SRD 5.2 (D&D 2024) dal progetto 5e-database e scrive un file compatto per la wiki.
//
//   git clone --depth 1 https://github.com/5e-bits/5e-database.git /tmp/5e-database
//   node tools/import-srd.mjs /tmp/5e-database
//
// Testi: System Reference Document 5.2 di Wizards of the Coast LLC, licenza CC-BY-4.0.
// Dati strutturati: 5e-database (licenza MIT, vedi THIRD_PARTY_NOTICES.md).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) {
	console.error('Uso: node tools/import-srd.mjs <cartella di 5e-database>');
	process.exit(1);
}
const dir = join(root, 'src/2024/en');
const load = (name) => JSON.parse(readFileSync(join(dir, `5e-SRD-${name}.json`), 'utf8'));

const clean = (s) =>
	String(s ?? '')
		.replace(/\r/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
const join2 = (...parts) => parts.filter(Boolean).join('\n');
const list = (arr, f = (x) => x.name) => (arr ?? []).map(f).join(', ');
const out = [];
const add = (k, i, n, s, t) => out.push({ k, i, n, s: clean(s), t: clean(t) });

for (const s of load('Spells')) {
	const lvl = s.level === 0 ? `${s.school.name} cantrip` : `Level ${s.level} ${s.school.name}`;
	const comps = s.components.join(', ') + (s.material ? ` (${s.material})` : '');
	add(
		'spell',
		s.index,
		s.name,
		`${lvl}${s.ritual ? ' (ritual)' : ''} · ${list(s.classes)}`,
		join2(
			`**Casting Time:** ${s.casting_time}${s.ritual ? ' or Ritual' : ''}`,
			`**Range:** ${s.range}`,
			`**Components:** ${comps}`,
			`**Duration:** ${s.concentration ? 'Concentration, ' : ''}${s.duration}`,
			'',
			s.description ?? (s.desc ?? []).join('\n'),
			s.higher_level ? `\n**Using a Higher-Level Spell Slot.** ${[].concat(s.higher_level).join(' ')}` : ''
		)
	);
}

for (const c of load('Conditions')) add('condition', c.index, c.name, 'Condition', c.description ?? (c.desc ?? []).join('\n'));

for (const f of load('Feats')) add('feat', f.index, f.name, `${f.type ? f.type[0].toUpperCase() + f.type.slice(1) + ' ' : ''}Feat`, f.description ?? (f.desc ?? []).join('\n'));

for (const m of load('Magic-Items'))
	add(
		'item',
		m.index,
		m.name,
		`${m.equipment_category?.name ?? 'Magic item'} · ${m.rarity?.name ?? ''}${m.attunement ? ' · requires attunement' : ''}`,
		[].concat(m.desc ?? m.description ?? '').join('\n')
	);

const mod = (n) => `${n} (${n >= 10 ? '+' : ''}${Math.floor((n - 10) / 2)})`;
const crText = (cr) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr));
const block = (title, arr) => (arr?.length ? `\n**${title}**\n` + arr.map((a) => `**${a.name}.** ${a.desc}`).join('\n') : '');

for (const m of load('Monsters')) {
	const ac = (m.armor_class ?? []).map((a) => a.value).join(', ');
	const speed = Object.entries(m.speed ?? {})
		.map(([k, v]) => (k === 'walk' ? v : `${k} ${v}`))
		.join(', ');
	const senses = Object.entries(m.senses ?? {})
		.map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
		.join(', ');
	add(
		'monster',
		m.index ?? m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
		m.name,
		`${m.size} ${m.type}${m.subtype ? ` (${m.subtype})` : ''}, ${m.alignment} · CR ${crText(m.challenge_rating)}`,
		join2(
			`**AC** ${ac} · **HP** ${m.hit_points} (${m.hit_dice}) · **Speed** ${speed}`,
			`STR ${mod(m.strength)} · DEX ${mod(m.dexterity)} · CON ${mod(m.constitution)} · INT ${mod(m.intelligence)} · WIS ${mod(m.wisdom)} · CHA ${mod(m.charisma)}`,
			senses ? `**Senses** ${senses}` : '',
			m.languages ? `**Languages** ${m.languages}` : '',
			block('Traits', m.special_abilities),
			block('Actions', m.actions),
			block('Bonus Actions', m.bonus_actions),
			block('Reactions', m.reactions),
			block('Legendary Actions', m.legendary_actions)
		)
	);
}

for (const s of load('Species'))
	add('species', s.index, s.name, `${s.type ?? 'Humanoid'} · ${s.size ?? ''} · Speed ${s.speed ?? ''}`, list(s.traits, (t) => t.name) ? `**Traits:** ${list(s.traits)}` : '');

for (const c of load('Classes'))
	add(
		'class',
		c.index,
		c.name,
		`Hit die d${c.hit_die} · ${c.primary_ability?.desc ?? ''}`,
		join2(
			c.proficiency_choices?.length ? `**Skills:** ${c.proficiency_choices.map((p) => p.desc).join('; ')}` : '',
			c.saving_throws?.length ? `**Saving Throws:** ${list(c.saving_throws)}` : ''
		)
	);

for (const b of load('Backgrounds'))
	add(
		'background',
		b.index,
		b.name,
		'Background',
		join2(
			b.ability_scores?.length ? `**Ability Scores:** ${list(b.ability_scores)}` : '',
			b.feat ? `**Feat:** ${b.feat.name}${b.feat.note ? ` (${b.feat.note})` : ''}` : '',
			b.proficiencies?.length ? `**Proficiencies:** ${list(b.proficiencies)}` : ''
		)
	);

out.sort((a, b) => a.k.localeCompare(b.k) || a.n.localeCompare(b.n));
const file = 'src/lib/server/rules/srd-5.2.json';
writeFileSync(file, JSON.stringify(out));
const counts = out.reduce((c, e) => ((c[e.k] = (c[e.k] ?? 0) + 1), c), {});
console.log(file, JSON.stringify(counts), Math.round(JSON.stringify(out).length / 1024) + ' KB');
