<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import type { CalMonth } from '../calendar.ts';
	import type { WorldDate } from '../content/types.ts';

	let {
		prefix,
		months,
		value = null,
		legend,
		required = false
	}: { prefix: string; months: CalMonth[]; value?: WorldDate | null; legend: string; required?: boolean } = $props();
	const t = getT();
</script>

<fieldset class="world-date">
	<legend>{legend}</legend>
	<div class="parts">
		<div class="field">
			<label for="{prefix}Year">{t('calendar.year')}</label>
			<input id="{prefix}Year" name="{prefix}Year" type="number" step="1" {required} value={value?.year ?? ''} inputmode="numeric" />
		</div>
		<div class="field">
			<label for="{prefix}Month">{t('calendar.month')}</label>
			<select id="{prefix}Month" name="{prefix}Month">
				<option value="">—</option>
				{#each months as m, i (i)}
					<option value={i + 1} selected={value?.month === i + 1}>{m.name}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="{prefix}Day">{t('calendar.day')}</label>
			<input id="{prefix}Day" name="{prefix}Day" type="number" min="1" max="99" step="1" value={value?.day ?? ''} inputmode="numeric" />
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
