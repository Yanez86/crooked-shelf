import type { DocNode } from './content/types.ts';
import { translate } from './i18n/index.ts';

/** Template preinstallati: titoli e campi nella lingua della wiki. */
export const BUILTIN_TEMPLATES = ['npc', 'pc', 'place', 'faction', 'item', 'deity', 'monster', 'session', 'houserule'] as const;
export type BuiltinTemplate = (typeof BUILTIN_TEMPLATES)[number];

export interface TemplateData {
	/** "b:npc" per i preinstallati, "c:12" per quelli creati dal Master. */
	key: string;
	name: string;
	description: string;
	fields: string[];
	content: DocNode;
	session: boolean;
	builtin: boolean;
}

const h = (text: string): DocNode => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
const p = (text?: string): DocNode => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
const secret = (text: string): DocNode => ({ type: 'secret', content: [p(text)] });

// Sezioni e campi di ogni template (chiavi di traduzione in templates.*).
const SPEC: Record<BuiltinTemplate, { fields: string[]; sections: string[]; secret?: boolean; session?: boolean }> = {
	npc: { fields: ['race', 'role', 'alignment', 'location', 'faction'], sections: ['appearance', 'personality', 'relations'], secret: true },
	pc: { fields: ['player', 'race', 'class', 'background', 'alignment'], sections: ['appearance', 'story', 'goals'] },
	place: { fields: ['type', 'region', 'population', 'ruler'], sections: ['description', 'places', 'people'], secret: true },
	faction: { fields: ['leader', 'seat', 'goals', 'allies', 'enemies'], sections: ['description', 'members', 'history'], secret: true },
	item: { fields: ['type', 'rarity', 'attunement', 'owner'], sections: ['description', 'properties', 'history'] },
	deity: { fields: ['domains', 'alignment', 'symbol', 'worshippers'], sections: ['description', 'dogma', 'clergy'] },
	monster: { fields: ['type', 'cr', 'habitat'], sections: ['description', 'tactics', 'lore'] },
	session: { fields: ['present', 'location'], sections: ['summary', 'events', 'loot', 'next'], session: true },
	houserule: { fields: ['replaces'], sections: ['rule', 'why'] }
};

export function builtinTemplate(id: BuiltinTemplate, locale: string): TemplateData {
	const t = (k: string) => translate(locale, k);
	const spec = SPEC[id];
	const content: DocNode[] = [];
	for (const s of spec.sections) content.push(h(t(`templates.s.${s}`)), p());
	if (spec.secret) content.push(h(t('templates.s.secrets')), secret(t('templates.secretHint')));
	return {
		key: `b:${id}`,
		name: t(`templates.${id}`),
		description: t(`templates.${id}Hint`),
		fields: spec.fields.map((f) => t(`templates.f.${f}`)),
		content: { type: 'doc', content },
		session: !!spec.session,
		builtin: true
	};
}
