<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import type { PageField } from '../content/types.ts';
	import { untrack } from 'svelte';

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

<fieldset class="fields-editor">
	<legend>{t('fields.title')}</legend>
	<p class="hint">{t('fields.hint')}</p>
	{#each rows as row, i (i)}
		<div class="row">
			<div class="field">
				<label for="field-label-{i}">{t('fields.label', { n: i + 1 })}</label>
				<input id="field-label-{i}" type="text" maxlength="60" bind:value={row.label} />
			</div>
			<div class="field grow">
				<label for="field-value-{i}">{t('fields.value', { n: i + 1 })}</label>
				<input id="field-value-{i}" type="text" maxlength="500" bind:value={row.value} />
			</div>
			<button class="btn btn-small btn-danger" type="button" onclick={() => remove(i)}>
				{t('common.delete')}<span class="visually-hidden">: {t('fields.label', { n: i + 1 })}</span>
			</button>
		</div>
	{/each}
	<button id="fields-add" class="btn btn-small" type="button" onclick={add}>+ {t('fields.add')}</button>
	<p class="visually-hidden" aria-live="polite">{announce}</p>
	<input type="hidden" name="fields" value={json} />
</fieldset>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.75rem;
		align-items: flex-end;
		margin-bottom: 0.5rem;
	}
	.row .field {
		margin-bottom: 0.25rem;
		flex: 1 1 10rem;
	}
	.row .grow {
		flex: 3 1 16rem;
	}
	.row .btn {
		margin-bottom: 0.25rem;
	}
</style>
