<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import type { PageField } from '../content/types.ts';
	import { untrack } from 'svelte';

	/** I riquadri della colonna a lato, modificati sul posto: un titolo e un testo breve ciascuno. */
	let { fields }: { fields: PageField[] } = $props();
	const t = getT();
	let rows = $state(untrack(() => fields.map((f) => ({ ...f }))));
	let announce = $state('');
	const json = $derived(JSON.stringify(rows.filter((r) => r.label.trim() || r.value.trim())));

	function add() {
		rows.push({ label: '', value: '' });
		announce = t('fields.added');
		queueMicrotask(() => document.getElementById(`field-label-${rows.length - 1}`)?.focus());
	}
	function remove(i: number) {
		rows.splice(i, 1);
		announce = t('fields.removed');
		queueMicrotask(() => document.getElementById('fields-add')?.focus());
	}
</script>

<section class="boxes" aria-label={t('fields.title')}>
	{#each rows as row, i (i)}
		<div class="box">
			<label class="visually-hidden" for="field-label-{i}">{t('fields.label', { n: i + 1 })}</label>
			<input id="field-label-{i}" class="box-label" type="text" maxlength="60" placeholder={t('fields.labelPlaceholder')} bind:value={row.label} />
			<label class="visually-hidden" for="field-value-{i}">{t('fields.value', { n: i + 1 })}</label>
			<input id="field-value-{i}" class="box-value" type="text" maxlength="500" placeholder={t('fields.valuePlaceholder')} bind:value={row.value} />
			<button class="remove" type="button" title={t('common.delete')} onclick={() => remove(i)}>
				<span aria-hidden="true">×</span><span class="visually-hidden">{t('common.delete')}: {t('fields.label', { n: i + 1 })}</span>
			</button>
		</div>
	{/each}
	<button id="fields-add" class="add" type="button" onclick={add}>+ {t('fields.add')}</button>
	<p class="visually-hidden" aria-live="polite">{announce}</p>
	<input type="hidden" name="fields" value={json} />
</section>

<style>
	.boxes {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.box {
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 0.4rem 2rem 0.4rem 0.5rem;
		border-radius: var(--radius);
		outline: 1px dashed var(--c-border);
	}
	.box:hover {
		outline-color: var(--c-control);
		background: var(--c-surface2);
	}
	.box:focus-within {
		outline: 2px solid var(--c-primary);
		background: var(--c-surface2);
	}
	/* Gli input sembrano testo: si scrive dove si legge. */
	.box input {
		border: 0;
		background: none;
		padding: 0.1rem 0;
		min-height: 0;
		width: 100%;
	}
	.box input:focus {
		outline: none;
	}
	.box-label {
		font-weight: 700;
	}
	.remove {
		position: absolute;
		top: 0.2rem;
		right: 0.2rem;
		width: 1.75rem;
		height: 1.75rem;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		font-size: 1.1rem;
		cursor: pointer;
	}
	.remove:hover,
	.remove:focus-visible {
		color: var(--c-danger);
		background: var(--c-surface);
	}
	.add {
		font: inherit;
		font-size: var(--fs-sm);
		padding: 0.5rem;
		border: 1px dashed var(--c-control);
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		cursor: pointer;
	}
	.add:hover,
	.add:focus-visible {
		color: var(--c-primary);
		border-color: var(--c-primary);
	}
</style>
