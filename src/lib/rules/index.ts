import { slugify } from '../slug.ts';

/**
 * Sistema di regole. Per ora uno solo: D&D 5.5 (2024). È scritto come modulo,
 * così in futuro altri sistemi (Pathfinder, OSR…) potranno aggiungersi come plugin.
 */
export const RULE_KINDS = ['spell', 'monster', 'condition', 'item', 'feat', 'species', 'class', 'background', 'rule'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

/** Nomi accettati dopo la @, in inglese e in italiano. */
export const KIND_ALIASES: Record<string, RuleKind> = {
	spell: 'spell',
	incantesimo: 'spell',
	monster: 'monster',
	mostro: 'monster',
	condition: 'condition',
	condizione: 'condition',
	item: 'item',
	oggetto: 'item',
	feat: 'feat',
	talento: 'feat',
	species: 'species',
	specie: 'species',
	class: 'class',
	classe: 'class',
	background: 'background',
	rule: 'rule',
	regola: 'rule'
};

/** @incantesimo[Fireball] oppure @incantesimo[Fireball|Palla di fuoco] (nome inglese | testo mostrato). */
export const RULE_RE = /@([a-zA-Z]+)\[([^[\]|\n]{1,80})(?:\|([^[\]\n]{1,80}))?\]/g;

export function parseRuleKind(k: string): RuleKind | null {
	return KIND_ALIASES[k.toLowerCase()] ?? null;
}

export const ruleKey = (name: string) => slugify(name, 'rule');

/** Destinazione usata per "chi cita questa regola" (stessa tabella dei collegamenti tra pagine). */
export const ruleTarget = (kind: RuleKind, name: string) => `@${kind}/${ruleKey(name)}`;

/** D&D Beyond non ha un'API pubblica: si collega alla sua ricerca. */
export function ddbUrl(_kind: RuleKind, name: string): string {
	return `https://www.dndbeyond.com/search?q=${encodeURIComponent(name.trim())}`;
}

export const SRD_ATTRIBUTION =
	'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';
