import type { DocNode, SessionInfo } from './content/types.ts';
import { translate } from './i18n/index.ts';

/**
 * Template di partenza: alla creazione della wiki diventano pagine (tipo «template») nella cartella Template,
 * nella lingua della wiki. Da lì in poi sono pagine come le altre: si modificano, si eliminano, se ne aggiungono.
 */
export const BUILTIN_TEMPLATES = ['npc', 'pc', 'place', 'faction', 'item', 'deity', 'monster', 'session', 'houserule'] as const;
export type BuiltinTemplate = (typeof BUILTIN_TEMPLATES)[number];

/** Dati di sessione vuoti: in un template dicono che le sue copie sono resoconti di sessione. */
export const SESSION_TEMPLATE: SessionInfo = { number: null, realDate: null, world: null };

export interface TemplateData {
	name: string;
	/** Titoli dei riquadri della colonna a lato. */
	fields: string[];
	content: DocNode;
	/** Le pagine fatte con questo template sono resoconti di sessione. */
	session: boolean;
	icon: string | null;
}

const h = (text: string): DocNode => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
const p = (text?: string): DocNode => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
const secret = (text: string): DocNode => ({ type: 'secret', content: [p(text)] });

// Sezioni e campi di ogni template (chiavi di traduzione in templates.*).
const SPEC: Record<BuiltinTemplate, { fields: string[]; sections: string[]; icon: string; secret?: boolean; session?: boolean }> = {
	npc: { fields: ['race', 'role', 'alignment', 'location', 'faction'], sections: ['appearance', 'personality', 'relations'], icon: 'person', secret: true },
	pc: { fields: ['player', 'race', 'class', 'background', 'alignment'], sections: ['appearance', 'story', 'goals'], icon: 'shield' },
	place: { fields: ['type', 'region', 'population', 'ruler'], sections: ['description', 'places', 'people'], icon: 'castle', secret: true },
	faction: { fields: ['leader', 'seat', 'goals', 'allies', 'enemies'], sections: ['description', 'members', 'history'], icon: 'crown', secret: true },
	item: { fields: ['type', 'rarity', 'attunement', 'owner'], sections: ['description', 'properties', 'history'], icon: 'gem' },
	deity: { fields: ['domains', 'alignment', 'symbol', 'worshippers'], sections: ['description', 'dogma', 'clergy'], icon: 'temple' },
	monster: { fields: ['type', 'cr', 'habitat'], sections: ['description', 'tactics', 'lore'], icon: 'claws' },
	session: { fields: ['present', 'location'], sections: ['summary', 'events', 'loot', 'next'], icon: 'scroll', session: true },
	houserule: { fields: ['replaces'], sections: ['rule', 'why'], icon: 'book' }
};

export function builtinTemplate(id: BuiltinTemplate, locale: string): TemplateData {
	const t = (k: string) => translate(locale, k);
	const spec = SPEC[id];
	const content: DocNode[] = [];
	for (const s of spec.sections) content.push(h(t(`templates.s.${s}`)), p());
	if (spec.secret) content.push(h(t('templates.s.secrets')), secret(t('templates.secretHint')));
	return {
		name: t(`templates.${id}`),
		fields: spec.fields.map((f) => t(`templates.f.${f}`)),
		content: { type: 'doc', content },
		session: !!spec.session,
		icon: spec.icon
	};
}
