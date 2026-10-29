<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { getT } from '#lib/i18n/index.ts';
	import MapView from '#lib/maps/MapView.svelte';
	import { PIN_SYMBOL } from '#lib/maps/icons.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();

	let view: ReturnType<typeof MapView> | undefined = $state();
	// Livelli accesi: 0 = pin senza livello.
	let hidden = $state<number[]>([]);
	let showLabels = $state(false);
	let adding = $state(false);
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

	const visiblePins = $derived(data.pins.filter((p) => !hidden.includes(p.layerId ?? 0)));
	const layerName = (id: number | null) => (id ? (data.layers.find((l) => l.id === id)?.name ?? '') : t('maps.noLayer'));

	function toggleLayer(id: number, on: boolean) {
		hidden = on ? hidden.filter((h) => h !== id) : [...hidden, id];
	}

	function newDraft(x: number, y: number) {
		adding = false;
		draft = { id: null, x, y, label: '', description: '', icon: 'pin', color: 'red', page: '', targetMapId: null, layerId: null, visibility: 'players' };
		status = t('maps.pinPlaced', { x: Math.round(x), y: Math.round(y) });
		queueMicrotask(() => document.getElementById('pin-label')?.focus());
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
		queueMicrotask(() => document.getElementById('pin-label')?.focus());
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

<svelte:head><title>{data.map.title} · {page.data.siteName}</title></svelte:head>

{#if data.path.length}
	<nav aria-label={t('maps.path')}>
		<ol class="crumbs">
			<li><a href="/maps">{t('nav.maps')}</a></li>
			{#each data.path as p (p.slug)}<li><a href="/maps/{p.slug}">{p.title}</a></li>{/each}
		</ol>
	</nav>
{/if}

<div class="head">
	<h1>{data.map.title}</h1>
	{#if data.canEdit}<a class="btn" href="/maps/{data.map.slug}/edit">⚙ {t('maps.settings')}</a>{/if}
</div>
{#if data.map.description}<p>{data.map.description}</p>{/if}

<FormOk message={form && 'ok' in form ? form.ok : null} />
<FormError error={form && 'error' in form ? form.error : null} />

<div class="tools">
	{#if data.layers.length}
		<fieldset class="layers">
			<legend>{t('maps.layers')}</legend>
			<label class="choice"><input type="checkbox" checked={!hidden.includes(0)} onchange={(e) => toggleLayer(0, e.currentTarget.checked)} /><span>{t('maps.noLayer')}</span></label>
			{#each data.layers as l (l.id)}
				<label class="choice">
					<input type="checkbox" checked={!hidden.includes(l.id)} onchange={(e) => toggleLayer(l.id, e.currentTarget.checked)} />
					<span>{l.name} {#if l.visibility === 'master'}<span class="badge">{t('visibility.master')}</span>{/if}</span>
				</label>
			{/each}
		</fieldset>
	{/if}
	<div class="buttons">
		<label class="choice"><input type="checkbox" bind:checked={showLabels} /><span>{t('maps.showLabels')}</span></label>
		{#if data.map.scale}
			<button class="btn btn-small btn-ghost" type="button" aria-pressed={measuring} onclick={() => { measuring = !measuring; adding = false; distance = null; status = measuring ? t('maps.measureHint') : ''; }}>📏 {t('maps.measure')}</button>
		{/if}
		{#if data.canEdit}
			<button class="btn btn-small" type="button" aria-pressed={adding} onclick={() => { adding = !adding; measuring = false; status = adding ? t('maps.addHint') : ''; }}>📍 {t('maps.addPin')}</button>
			<button class="btn btn-small btn-ghost" type="button" onclick={() => { const c = view?.center(); if (c) newDraft(c.x, c.y); }}>{t('maps.addCenter')}</button>
		{/if}
	</div>
</div>

<p class="status" role="status">
	{status}
	{#if distance !== null}{t('maps.distance', { d: fmtDistance(distance) })}{/if}
</p>

<MapView
	bind:this={view}
	src="/files/{data.map.fileId}"
	width={data.map.width}
	height={data.map.height}
	title={data.map.title}
	pins={visiblePins}
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
/>
<p class="hint">{t('maps.keyboardHint')}</p>

{#if draft && data.editData}
	<section class="card pin-form" aria-labelledby="pin-form-title">
		<h2 id="pin-form-title">{draft.id ? t('maps.editPin') : t('maps.newPin')}</h2>
		<form
			method="post"
			action="?/pin"
			use:enhance={() =>
				async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success') draft = null;
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
					<datalist id="pin-pages">{#each data.editData.pageTitles as p (p)}<option value={p}></option>{/each}</datalist>
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
						{#each data.editData.icons as i (i)}<option value={i}>{PIN_SYMBOL[i]} {t('maps.icons.' + i)}</option>{/each}
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
				<button class="btn btn-primary" type="submit">{t('common.save')}</button>
				<button class="btn" type="button" onclick={() => (draft = null)}>{t('common.cancel')}</button>
			</div>
		</form>
		{#if draft.id}
			<form method="post" action="?/deletePin" use:enhance={() => async ({ update }) => { await update(); draft = null; }}>
				<input type="hidden" name="id" value={draft.id} />
				<button class="btn btn-danger btn-small" type="submit">{t('maps.deletePin')}</button>
			</form>
		{/if}
	</section>
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
								<span aria-hidden="true">{PIN_SYMBOL[p.icon]}</span> {p.label}
								{#if p.visibility === 'master'}<span class="badge">{t('visibility.master')}</span>{/if}
								{#if p.html}<br /><span class="muted small">{@html p.html}</span>{/if}
							</th>
							{#if data.layers.length}<td>{layerName(p.layerId)}</td>{/if}
							<td>
								{#if p.page && !p.page.missing}<a href="/wiki/{p.page.slug}">{p.page.title}</a>{/if}
								{#if p.target}<a href="/maps/{p.target.slug}">🗺 {p.target.title}</a>{/if}
							</td>
							<td class="row-actions">
								<button class="btn btn-small btn-ghost" type="button" onclick={() => view?.openPin(p.id)}>{t('maps.showOnMap')}<span class="visually-hidden">: {p.label}</span></button>
								{#if data.canEdit}<button class="btn btn-small btn-ghost" type="button" onclick={() => editPin(p.id)}>{t('page.edit')}<span class="visually-hidden">: {p.label}</span></button>{/if}
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
			<ul>{#each data.children as c (c.slug)}<li><a href="/maps/{c.slug}">{c.title}</a></li>{/each}</ul>
		{:else}<p class="muted">{t('maps.noChildren')}</p>{/if}
		{#if data.canEdit}<a class="btn btn-small" href="/maps/new?parent={data.map.id}">+ {t('maps.newChild')}</a>{/if}
	</section>
{/if}

{#if data.canEdit}
	<details class="disclosure layers-admin">
		<summary class="btn">⚙ {t('maps.manageLayers')}</summary>
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
					<button class="btn btn-small" type="submit">{t('common.save')}<span class="visually-hidden">: {l.name}</span></button>
				</form>
				<form method="post" action="?/deleteLayer" use:enhance>
					<input type="hidden" name="id" value={l.id} />
					<button class="btn btn-small btn-danger" type="submit">{t('common.delete')}<span class="visually-hidden">: {l.name}</span></button>
				</form>
			</div>
		{/each}
		<form method="post" action="?/layer" use:enhance class="inline card">
			<label for="new-layer">{t('maps.newLayer')}</label>
			<input id="new-layer" name="name" type="text" required maxlength="60" />
			<label class="visually-hidden" for="new-layer-vis">{t('page.visibility')}</label>
			<select id="new-layer-vis" name="visibility">
				<option value="players">{t('visibility.players')}</option>
				<option value="master">{t('visibility.master')}</option>
			</select>
			<button class="btn btn-small" type="submit">{t('categories.add')}</button>
		</form>
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
	.crumbs li + li::before {
		content: '›';
		padding: 0 0.5rem;
		color: var(--c-muted);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem 1rem;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		align-items: flex-start;
	}
	.layers {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
		margin: 0;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
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
		margin: 1.5rem 0;
		border: 2px solid var(--c-primary);
	}
	.pin-form h2 {
		margin-top: 0;
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
