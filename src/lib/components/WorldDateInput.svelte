<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import type { CalMonth } from '../calendar.ts';
	import type { WorldDate } from '../content/types.ts';

	let {
		prefix,
		months,
		value = null,
		legend,
		required = false,
		idPrefix
	}: { prefix: string; months: CalMonth[]; value?: WorldDate | null; legend: string; required?: boolean; idPrefix?: string } = $props();
	// I nomi dei campi restano quelli del modulo; gli id cambiano quando nella pagina ce n'è più d'uno.
	const id = $derived(idPrefix ?? prefix);
	const t = getT();
</script>

<fieldset class="world-date">
	<legend>{legend}</legend>
	<div class="parts">
		<div class="field">
			<label for="{id}Year">{t('calendar.year')}</label>
			<input id="{id}Year" name="{prefix}Year" type="number" step="1" {required} value={value?.year ?? ''} inputmode="numeric" />
		</div>
		<div class="field">
			<label for="{id}Month">{t('calendar.month')}</label>
			<select id="{id}Month" name="{prefix}Month">
				<option value="">—</option>
				{#each months as m, i (i)}
					<option value={i + 1} selected={value?.month === i + 1}>{m.name}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="{id}Day">{t('calendar.day')}</label>
			<input id="{id}Day" name="{prefix}Day" type="number" min="1" max="99" step="1" value={value?.day ?? ''} inputmode="numeric" />
		</div>
	</div>
	<p class="hint">{t('calendar.dateHint')}</p>
</fieldset>

<style>
	.parts {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
	}
	.parts .field {
		margin-bottom: 0.5rem;
	}
	.parts input {
		width: 8rem;
	}
	.hint {
		margin: 0;
	}
</style>
