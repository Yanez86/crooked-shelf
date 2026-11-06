<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import { TIMELINE_MODES } from '../pageKinds.ts';
	import { HEX_ORIENTATIONS } from '../hex.ts';
	import HexTile from './HexTile.svelte';

	/**
	 * Le impostazioni proprie di una pagina «mappa» (immagine, mappa che la contiene, scala), «cronologia» (modo),
	 * «bacheca» (le colonne con cui nasce; dopo si cambiano dalla bacheca) o «mappa a esagoni» (orientamento, scala, set).
	 */
	let {
		kind,
		map,
		mode,
		columns,
		parents = [],
		requireImage = false,
		hex,
		tilesets = [],
		renumber = false
	}: {
		kind: 'map' | 'timeline' | 'board' | 'hexmap';
		hex?: { orientation: string; across: string; unit: string; tileset: string };
		/** Nella modifica: la casella per far ripartire i numeri dall'esagono più in alto a sinistra. */
		renumber?: boolean;
		tilesets?: { id: string; name: string; source: string; license: string; terrains: { id: string; name: string; fill: string; ink: string; glyph: string }[] }[];
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
{:else if kind === 'hexmap' && hex}
	<fieldset class="kind-settings">
		<legend>{t('hex.settings')}</legend>
		<fieldset>
			<legend>{t('hex.orientation')}</legend>
			{#each HEX_ORIENTATIONS as o (o)}
				<label class="choice">
					<input type="radio" name="orientation" value={o} checked={hex.orientation === o} aria-describedby="orientation-hint" />
					<span class="with-tile"><HexTile fill="#e4ecc4" ink="#5b6b2a" orientation={o} width={22} />{t('hex.orientations.' + o)}</span>
				</label>
			{/each}
			<p id="orientation-hint" class="hint">{t('hex.orientationHint')}</p>
			{#if renumber}
				<label class="choice">
					<input type="checkbox" name="renumber" aria-describedby="renumber-hint" />
					<span>{t('hex.renumber')}</span>
				</label>
				<p id="renumber-hint" class="hint">{t('hex.renumberHint')}</p>
			{/if}
		</fieldset>
		<fieldset>
			<legend>{t('maps.scale')}</legend>
			<p class="hint">{t('hex.scaleHint')}</p>
			<div class="row">
				<div class="field">
					<label for="across">{t('hex.across')}</label>
					<input id="across" name="across" type="text" inputmode="decimal" value={hex.across} placeholder="6" />
				</div>
				<div class="field">
					<label for="unit">{t('hex.unit')}</label>
					<input id="unit" name="unit" type="text" maxlength="20" value={hex.unit} placeholder="km" />
				</div>
			</div>
		</fieldset>
		<fieldset>
			<legend>{t('hex.tileset')}</legend>
			<p id="tileset-hint" class="hint">{t('hex.tilesetHint')}</p>
			{#each tilesets as ts (ts.id)}
				<label class="choice tileset">
					<input type="radio" name="tileset" value={ts.id} checked={hex.tileset === ts.id || (!tilesets.some((x) => x.id === hex.tileset) && ts.id === tilesets[0].id)} aria-describedby="tileset-hint" />
					<span class="tileset-text">
						<span class="tiles" aria-hidden="true">{#each ts.terrains as tr (tr.id)}<HexTile fill={tr.fill} ink={tr.ink} glyph={tr.glyph} width={26} />{/each}</span>
						<strong>{ts.name}</strong>
						<span class="muted">{ts.source ? t('hex.fromPlugin', { name: ts.source }) : t('hex.builtin')}{ts.license ? ` · ${ts.license}` : ''}</span>
					</span>
				</label>
			{/each}
		</fieldset>
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
	.with-tile {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.tileset {
		align-items: flex-start;
		margin-bottom: 0.5rem;
	}
	.tileset-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.tiles {
		display: flex;
		gap: 2px;
	}
</style>
