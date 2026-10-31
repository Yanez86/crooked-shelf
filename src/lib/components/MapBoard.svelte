<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { getT } from '../i18n/index.ts';
	import MapView from '../maps/MapView.svelte';
	import PinPage from '../maps/PinPage.svelte';
	import { PIN_ICON } from '../maps/icons.ts';
	import Icon from './Icon.svelte';
	import FormError from './FormError.svelte';
	import type { mapView } from '../server/mapPage.ts';

	// La mappa di una pagina «mappa»: strumenti, pin, livelli e mappe annidate. I moduli vanno alle azioni della pagina.
	let { data, title, form }: { data: NonNullable<ReturnType<typeof mapView>>; title: string; form: { error?: string | null } | null } = $props();
	const t = getT();

	let view: ReturnType<typeof MapView> | undefined = $state();
	let pinPage: ReturnType<typeof PinPage> | undefined = $state();
	// Livelli accesi: 0 = livello base, i pin senza un livello scelto. C'è sempre ed è di tutti.
	let hidden = $state<number[]>([]);
	let showLabels = $state(false);
	let adding = $state(false);
	let addingLayer = $state(false);
	let addLayerBtn = $state<HTMLButtonElement>();
	let layerInput = $state<HTMLInputElement>();
	let measuring = $state(false);
	let distance = $state<number | null>(null);
	let status = $state('');

	interface Draft {
		id: number | null;
		x: number;
		y: number;
		label: string;
		description: string;
		icon: string;
		color: string;
		page: string;
		targetMapId: number | null;
		layerId: number | null;
		visibility: string;
	}
	let draft = $state<Draft | null>(null);
	let pinDialog = $state<HTMLDialogElement>();

	// I popup fatti con <details>: la X li chiude e il fuoco torna sul tasto che li apre.
	function closeMenu(e: MouseEvent) {
		const menu = (e.currentTarget as HTMLElement).closest('details')!;
		menu.open = false;
		menu.querySelector('summary')!.focus();
	}

	// Il popup si apre quando compare; il fuoco va da solo sul primo campo.
	$effect(() => pinDialog?.showModal());
	$effect(() => layerInput?.focus());

	const visiblePins = $derived(data.pins.filter((p) => !hidden.includes(p.layerId ?? 0)));
	// Il pin appena posizionato si vede già sulla mappa, sotto il popup.
	const mapPins = $derived(draft && !draft.id ? [...visiblePins, { ...draft, id: 0, html: '', page: null, target: null }] : visiblePins);
	const layerName = (id: number | null) => (id ? (data.layers.find((l) => l.id === id)?.name ?? '') : t('maps.noLayer'));

	function toggleLayer(id: number, on: boolean) {
		hidden = on ? hidden.filter((h) => h !== id) : [...hidden, id];
	}

	function newDraft(x: number, y: number) {
		adding = false;
		draft = { id: null, x, y, label: '', description: '', icon: 'pin', color: 'red', page: '', targetMapId: null, layerId: null, visibility: 'players' };
		status = t('maps.pinPlaced', { x: Math.round(x), y: Math.round(y) });
	}

	// Col mouse si sceglie il punto sulla mappa; da tastiera (clic con `detail` a 0) il pin nasce al centro della vista.
	function addPin(e: MouseEvent) {
		if (e.detail === 0) {
			const c = view?.center();
			if (c) newDraft(c.x, c.y);
			return;
		}
		adding = !adding;
		measuring = false;
		status = adding ? t('maps.addHint') : '';
	}

	function editPin(id: number) {
		const p = data.pins.find((q) => q.id === id);
		if (!p) return;
		draft = {
			id: p.id,
			x: p.x,
			y: p.y,
			label: p.label,
			description: p.description,
			icon: p.icon,
			color: p.color,
			page: p.pageTitle,
			targetMapId: p.targetMapId,
			layerId: p.layerId,
			visibility: p.visibility
		};
	}

	async function movePin(id: number, x: number, y: number) {
		const r = await fetch(`/api/maps/${data.map.id}/pins/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ x, y })
		});
		status = r.ok ? t('maps.pinMoved') : t('errors.generic');
		if (draft?.id === id) {
			draft.x = x;
			draft.y = y;
		}
	}

	const fmtDistance = (d: number) => `${new Intl.NumberFormat(page.data.locale as string, { maximumFractionDigits: 1 }).format(d)} ${data.map.unit}`;
</script>

{#if data.path.length}
	<nav aria-label={t('maps.path')}>
		<ol class="crumbs">
			{#each data.path as p (p.slug)}<li><a href="/wiki/{p.slug}">{p.title}</a></li>{/each}
			<li aria-current="page">{title}</li>
		</ol>
	</nav>
{/if}

{#if !draft}<FormError error={form?.error ?? null} />{/if}

<div class="tools">
	<div class="buttons">
		<label class="choice"><input type="checkbox" bind:checked={showLabels} /><span>{t('maps.showLabels')}</span></label>
		{#if data.map.scale}
			<button class="btn btn-small btn-ghost" type="button" aria-pressed={measuring} onclick={() => { measuring = !measuring; adding = false; distance = null; status = measuring ? t('maps.measureHint') : ''; }}><Icon name="ruler" />{t('maps.measure')}</button>
		{/if}
	</div>
</div>

<p class="status" role="status">
	{status}
	{#if distance !== null}{t('maps.distance', { d: fmtDistance(distance) })}{/if}
</p>

<div class="map-wrap">
	<MapView
		bind:this={view}
		src="/files/{data.map.fileId}"
		width={data.map.width}
		height={data.map.height}
		{title}
		pins={mapPins}
		editable={data.canEdit}
		{adding}
		{measuring}
		{showLabels}
		scale={data.map.scale}
		unit={data.map.unit}
		onpick={newDraft}
		onmove={movePin}
		onedit={editPin}
		onmeasure={(d) => (distance = d)}
		onopen={(p) => pinPage?.show(p)}
	/>
	<!-- Sulla mappa: chi non può aggiungere pin ha «Livelli» subito sotto lo zoom. -->
	<div class="map-tools">
		{#if data.canEdit}
			<button class="btn add-pin" type="button" title={t('maps.addPin')} aria-label={t('maps.addPin')} aria-pressed={adding} onclick={addPin}><Icon name="markerPlus" /></button>
		{/if}
		<details class="layers-menu">
			<summary class="btn" title={t('maps.layers')}><Icon name="layers" /><span class="visually-hidden">{t('maps.layers')}</span></summary>
			<div class="layers">
				<fieldset>
					<legend class="visually-hidden">{t('maps.layers')}</legend>
					<label class="choice"><input type="checkbox" checked={!hidden.includes(0)} onchange={(e) => toggleLayer(0, e.currentTarget.checked)} /><span>{t('maps.noLayer')}</span></label>
					{#each data.layers as l (l.id)}
						<label class="choice">
							<input type="checkbox" checked={!hidden.includes(l.id)} onchange={(e) => toggleLayer(l.id, e.currentTarget.checked)} />
							<span>{l.name} {#if l.visibility === 'master'}<span class="badge">{t('visibility.master')}</span>{/if}</span>
						</label>
					{/each}
				</fieldset>
				{#if data.canEdit}
					<button
						bind:this={addLayerBtn}
						class="btn btn-small btn-ghost add-layer"
						type="button"
						aria-expanded={addingLayer}
						onclick={() => (addingLayer = !addingLayer)}
					>
						<Icon name="plus" />{t('maps.newLayer')}
					</button>
					{#if addingLayer}
						<form
							method="post"
							action="?/layer"
							class="new-layer"
							use:enhance={() =>
								async ({ result, update }) => {
									await update();
									if (result.type === 'success') {
										addingLayer = false;
										addLayerBtn?.focus();
									}
								}}
						>
							<label class="visually-hidden" for="new-layer">{t('maps.layerName')}</label>
							<input bind:this={layerInput} id="new-layer" name="name" type="text" required maxlength="60" placeholder={t('maps.layerName')} />
							<label class="visually-hidden" for="new-layer-vis">{t('page.visibility')}</label>
							<select id="new-layer-vis" name="visibility">
								<option value="players">{t('visibility.players')}</option>
								<option value="master">{t('visibility.master')}</option>
							</select>
							<button class="btn btn-small" type="submit">{t('categories.add')}</button>
						</form>
					{/if}
				{/if}
				<button class="btn btn-small btn-ghost pin-close" type="button" title={t('common.close')} aria-label={t('common.close')} onclick={closeMenu}><Icon name="close" /></button>
			</div>
		</details>
	</div>
</div>
<p class="hint">{t('maps.keyboardHint')}{#if data.canEdit} {t('maps.keyboardAddHint')}{/if}</p>
<PinPage bind:this={pinPage} editable={data.canEdit} onedit={editPin} />

{#if draft && data.editData}
	<dialog bind:this={pinDialog} class="pin-form" aria-labelledby="pin-form-title" onclose={() => (draft = null)}>
		<h2 id="pin-form-title">{draft.id ? t('maps.editPin') : t('maps.newPin')}</h2>
		<FormError error={form?.error ?? null} />
		<form
			method="post"
			action="?/pin"
			use:enhance={() =>
				async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success') pinDialog?.close();
				}}
		>
			{#if draft.id}<input type="hidden" name="id" value={draft.id} />{/if}
			<div class="cols">
				<div class="field">
					<label for="pin-label">{t('common.name')}</label>
					<input id="pin-label" name="label" type="text" required maxlength="120" bind:value={draft.label} />
				</div>
				<div class="field">
					<label for="pin-page">{t('maps.linkedPage')}</label>
					<input id="pin-page" name="page" type="text" list="pin-pages" autocomplete="off" bind:value={draft.page} aria-describedby="pin-page-hint" />
					<span id="pin-page-hint" class="hint">{t('maps.linkedPageHint')}</span>
					<datalist id="pin-pages">{#each data.editData.pageTitles as p, i (i)}<option value={p}></option>{/each}</datalist>
				</div>
			</div>
			<div class="field">
				<label for="pin-desc">{t('common.description')}</label>
				<textarea id="pin-desc" name="description" rows="2" maxlength="1000" bind:value={draft.description}></textarea>
			</div>
			<div class="cols">
				<div class="field">
					<label for="pin-icon">{t('maps.icon')}</label>
					<select id="pin-icon" name="icon" bind:value={draft.icon}>
						{#each data.editData.icons as i (i)}<option value={i}>{t('maps.icons.' + i)}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="pin-color">{t('tags.color')}</label>
					<select id="pin-color" name="color" bind:value={draft.color}>
						{#each data.editData.colors as c (c)}<option value={c}>{t('colors.' + c)}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="pin-layer">{t('maps.layer')}</label>
					<select id="pin-layer" name="layerId" bind:value={draft.layerId}>
						<option value={null}>{t('maps.noLayer')}</option>
						{#each data.layers as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="pin-target">{t('maps.targetMap')}</label>
					<select id="pin-target" name="targetMapId" bind:value={draft.targetMapId}>
						<option value={null}>—</option>
						{#each data.editData.maps as m (m.id)}<option value={m.id}>{m.title}</option>{/each}
					</select>
				</div>
			</div>
			<div class="cols">
				<div class="field">
					<label for="pin-x">{t('maps.x')}</label>
					<input id="pin-x" name="x" type="number" step="0.1" min="0" max={data.map.width} bind:value={draft.x} />
				</div>
				<div class="field">
					<label for="pin-y">{t('maps.y')}</label>
					<input id="pin-y" name="y" type="number" step="0.1" min="0" max={data.map.height} bind:value={draft.y} />
				</div>
				<fieldset>
					<legend>{t('page.visibility')}</legend>
					<label class="choice"><input type="radio" name="visibility" value="players" bind:group={draft.visibility} /><span>{t('visibility.players')}</span></label>
					<label class="choice"><input type="radio" name="visibility" value="master" bind:group={draft.visibility} /><span>{t('visibility.master')}</span></label>
				</fieldset>
			</div>
			<div class="actions">
				<button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button>
			</div>
		</form>
		{#if draft.id}
			<form method="post" action="?/deletePin" use:enhance={() => async ({ update }) => { await update(); pinDialog?.close(); }}>
				<input type="hidden" name="id" value={draft.id} />
				<button class="btn btn-danger btn-small" type="submit">{t('maps.deletePin')}</button>
			</form>
		{/if}
		<!-- In fondo al codice, in alto a destra a schermo: così il fuoco parte dal primo campo. -->
		<button class="btn btn-small btn-ghost pin-close" type="button" title={t('common.close')} aria-label={t('common.close')} onclick={() => pinDialog?.close()}><Icon name="close" /></button>
	</dialog>
{/if}

<section aria-labelledby="pins-title">
	<h2 id="pins-title">{t('maps.pins')} ({visiblePins.length})</h2>
	{#if visiblePins.length}
		<div class="scroll">
			<table class="data">
				<thead>
					<tr>
						<th scope="col">{t('common.name')}</th>
						{#if data.layers.length}<th scope="col">{t('maps.layer')}</th>{/if}
						<th scope="col">{t('maps.links')}</th>
						<th scope="col"><span class="visually-hidden">{t('common.actions')}</span></th>
					</tr>
				</thead>
				<tbody>
					{#each visiblePins as p (p.id)}
						<tr>
							<th scope="row">
								<Icon name={PIN_ICON[p.icon] ?? 'dot'} /> {p.label}
								{#if p.visibility === 'master'}<span class="badge">{t('visibility.master')}</span>{/if}
								{#if p.html}<br /><span class="muted small">{@html p.html}</span>{/if}
							</th>
							{#if data.layers.length}<td>{layerName(p.layerId)}</td>{/if}
							<td>
								{#if p.page && !p.page.missing}<a href="/wiki/{p.page.slug}">{p.page.title}</a>{/if}
								{#if p.target}<a href="/wiki/{p.target.slug}"><Icon name="map" /> {p.target.title}</a>{/if}
							</td>
							<td class="row-actions">
								<button class="btn btn-small btn-ghost" type="button" onclick={() => view?.openPin(p.id)}>{t('maps.showOnMap')}<span class="visually-hidden">: {p.label}</span></button>
								{#if data.canEdit}<button class="btn btn-small btn-ghost" type="button" title={t('page.edit')} onclick={() => editPin(p.id)}><Icon name="edit" /><span class="visually-hidden">{t('page.edit')}: {p.label}</span></button>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="muted">{t('maps.noPins')}</p>
	{/if}
</section>

{#if data.children.length || data.canEdit}
	<section aria-labelledby="children-title">
		<h2 id="children-title">{t('maps.children')}</h2>
		{#if data.children.length}
			<ul>{#each data.children as c (c.slug)}<li><a href="/wiki/{c.slug}">{c.title}</a></li>{/each}</ul>
		{:else}<p class="muted">{t('maps.noChildren')}</p>{/if}
		{#if data.canEdit}<a class="btn btn-small" href="/wiki/new?kind=map&amp;parent={data.map.id}"><Icon name="plus" />{t('maps.newChild')}</a>{/if}
	</section>
{/if}

{#if data.canEdit && data.layers.length}
	<details class="disclosure layers-admin">
		<summary class="btn"><Icon name="cog" />{t('maps.manageLayers')}</summary>
		{#each data.layers as l (l.id)}
			<div class="layer-row">
				<form method="post" action="?/layer" use:enhance class="inline">
					<input type="hidden" name="id" value={l.id} />
					<label class="visually-hidden" for="layer-{l.id}">{t('maps.layerName')}</label>
					<input id="layer-{l.id}" name="name" type="text" required maxlength="60" value={l.name} />
					<label class="visually-hidden" for="layer-vis-{l.id}">{t('page.visibility')}: {l.name}</label>
					<select id="layer-vis-{l.id}" name="visibility">
						<option value="players" selected={l.visibility === 'players'}>{t('visibility.players')}</option>
						<option value="master" selected={l.visibility === 'master'}>{t('visibility.master')}</option>
					</select>
					<button class="btn btn-small" type="submit"><Icon name="save" />{t('common.save')}<span class="visually-hidden">: {l.name}</span></button>
				</form>
				<form method="post" action="?/deleteLayer" use:enhance>
					<input type="hidden" name="id" value={l.id} />
					<button class="btn btn-small btn-danger" type="submit">{t('common.delete')}<span class="visually-hidden">: {l.name}</span></button>
				</form>
			</div>
		{/each}
	</details>
{/if}

<style>
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.crumbs {
		margin-bottom: 0.75rem;
		font-size: var(--fs-sm);
	}
	.crumbs li + li::before {
		content: '›';
		padding: 0 0.5rem;
		color: var(--c-muted);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		align-items: flex-start;
	}
	/* L'elenco si apre a sinistra del tasto: sotto, su una mappa bassa, uscirebbe dal riquadro. */
	.layers {
		position: absolute;
		top: 0;
		right: calc(100% + 0.25rem);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: max-content;
		min-width: 12rem;
		max-width: min(18rem, 70vw);
		margin: 0;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--c-border);
		background: var(--c-surface);
	}
	.layers fieldset {
		margin: 0;
		padding: 0 2.75rem 0 0;
		border: 0;
	}
	.add-layer {
		align-self: flex-start;
	}
	.new-layer {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.map-wrap {
		position: relative;
	}
	/* Sulla mappa, sotto i due tasti dello zoom e grandi come uno di loro (2.75rem, a 14px dal bordo con la cornice della barra). */
	.map-tools {
		position: absolute;
		z-index: 1;
		top: 7rem;
		right: 14px;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.add-pin,
	.layers-menu summary {
		width: 2.75rem;
		height: 2.75rem;
		padding: 0;
	}
	.layers-menu {
		position: relative;
	}
	.layers-menu summary {
		list-style: none;
	}
	.layers-menu summary::-webkit-details-marker {
		display: none;
	}
	.layers-menu[open] summary,
	.btn[aria-pressed='true'] {
		background: var(--c-primary);
		border-color: var(--c-primary);
		color: var(--c-on-primary);
	}
	.status {
		min-height: 1.6em;
		margin: 0.5rem 0;
		font-weight: 600;
	}
	.pin-form {
		width: min(100% - 2rem, 40rem);
		max-width: none;
		max-height: calc(100dvh - 2rem);
		padding: 1.25rem;
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
		overscroll-behavior: contain;
	}
	.pin-form::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	.pin-form h2 {
		margin-top: 0;
	}
	.pin-close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0 1rem;
	}
	.scroll {
		overflow-x: auto;
	}
	.small {
		font-size: var(--fs-sm);
		font-weight: 400;
	}
	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.layer-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	section,
	.layers-admin {
		margin-top: 1.5rem;
	}
</style>
