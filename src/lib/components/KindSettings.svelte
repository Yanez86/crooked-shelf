<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import { TIMELINE_MODES } from '../pageKinds.ts';

	/**
	 * Le impostazioni proprie di una pagina «mappa» (immagine, mappa che la contiene, scala), «cronologia» (modo)
	 * o «bacheca» (le colonne con cui nasce; dopo si cambiano dalla bacheca).
	 */
	let {
		kind,
		map,
		mode,
		columns,
		parents = [],
		requireImage = false
	}: {
		kind: 'map' | 'timeline' | 'board';
		columns?: string;
		map?: { parentId: number | null; across: string; unit: string };
		mode?: string;
		parents?: { id: number; title: string }[];
		requireImage?: boolean;
	} = $props();
	const t = getT();
</script>

{#if kind === 'map' && map}
	<fieldset class="kind-settings">
		<legend>{t('maps.settings')}</legend>
		<div class="field">
			<label for="image">{requireImage ? t('maps.image') : t('maps.replaceImage')}</label>
			<input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required={requireImage} aria-describedby="image-hint" />
			<span id="image-hint" class="hint">{t('maps.imageHint')}</span>
		</div>
		<div class="field">
			<label for="parentId">{t('maps.parent')}</label>
			<select id="parentId" name="parentId" aria-describedby="parent-hint">
				<option value="">{t('maps.noParent')}</option>
				{#each parents as p (p.id)}<option value={p.id} selected={map.parentId === p.id}>{p.title}</option>{/each}
			</select>
			<span id="parent-hint" class="hint">{t('maps.parentHint')}</span>
		</div>
		<fieldset>
			<legend>{t('maps.scale')}</legend>
			<p class="hint">{t('maps.scaleHint')}</p>
			<div class="row">
				<div class="field">
					<label for="across">{t('maps.across')}</label>
					<input id="across" name="across" type="text" inputmode="decimal" value={map.across} />
				</div>
				<div class="field">
					<label for="unit">{t('maps.unit')}</label>
					<input id="unit" name="unit" type="text" maxlength="20" value={map.unit} placeholder="km" />
				</div>
			</div>
		</fieldset>
	</fieldset>
{:else if kind === 'board'}
	<fieldset class="kind-settings">
		<legend>{t('kinds.boardColumns')}</legend>
		<div class="field">
			<label for="columns">{t('boards.columns')}</label>
			<textarea id="columns" name="columns" rows="4" aria-describedby="columns-hint">{columns ?? t('boards.defaultColumns')}</textarea>
			<span id="columns-hint" class="hint">{t('boards.columnsHint')}</span>
		</div>
	</fieldset>
{:else if kind === 'timeline'}
	<fieldset class="kind-settings">
		<legend>{t('timeline.mode.title')}</legend>
		{#each TIMELINE_MODES as m (m)}
			<label class="choice">
				<input type="radio" name="mode" value={m} checked={(mode ?? 'world') === m} aria-describedby="mode-{m}-hint" />
				<span>{t('timeline.mode.' + m)}</span>
			</label>
			<p id="mode-{m}-hint" class="hint">{t('timeline.mode.' + m + 'Hint')}</p>
		{/each}
	</fieldset>
{/if}

<style>
	.kind-settings .hint {
		margin: 0 0 0.5rem 1.9rem;
	}
	.kind-settings .field .hint,
	.kind-settings fieldset .hint {
		margin-left: 0;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
	}
	.row input {
		width: 10rem;
	}
</style>
