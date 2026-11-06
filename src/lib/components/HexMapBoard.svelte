<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, tick, untrack } from 'svelte';
	import { getT } from '../i18n/index.ts';
	import Icon from './Icon.svelte';
	import FormError from './FormError.svelte';
	import HexTile from './HexTile.svelte';
	import { PIN_ICON } from '../maps/icons.ts';
	import { iconPath } from '../icons.ts';
	import { HEX_RANGE, HEX_SHAPE, glyphTransform, hatchPath, hexBox, hexCenter, hexKey, hexLabel, neighbors, topLeft, type HexState } from '../hex.ts';
	import type { hexView } from '../server/hexPage.ts';

	/**
	 * La mappa di una pagina «mappa a esagoni». Il Master costruisce (terreno), riempie (elementi), decide cosa sanno i
	 * giocatori (scoperta) e sposta il gruppo; gli altri vedono solo quello che il server ha mandato loro.
	 * Ogni esagono è un pulsante ritagliato a esagono: si usa col mouse, col dito e da tastiera (frecce tra gli esagoni,
	 * un solo esagono nell'ordine del Tab). Le modifiche agli esagoni si vedono subito e vanno all'API dietro;
	 * elementi e note passano dalle azioni della pagina.
	 */
	type Data = ReturnType<typeof hexView>;
	type Cell = Data['cells'][number];
	type Feature = Data['features'][number];
	type Look = Data['terrains'][string];
	interface Item {
		key: string;
		q: number;
		r: number;
		x: number;
		y: number;
		left: number;
		top: number;
		ghost: boolean;
	}

	let { data, title, slug, form }: { data: Data; title: string; slug: string; form: { error?: string | null } | null } = $props();
	const t = getT();
	const locale = $derived(page.data.locale as string);
	const o = $derived(data.map.orientation);
	const shape = $derived(HEX_SHAPE[o]);
	const hatch = $derived(hatchPath(o));
	const master = $derived(data.canEdit);

	const byKey = (list: Cell[]) => Object.fromEntries(list.map((c) => [hexKey(c.q, c.r), c])) as Record<string, Cell>;
	// Gli esagoni come li sa il browser: quelli del server più le modifiche appena fatte. Quando la pagina si ricarica
	// (un elemento salvato, un errore) si riparte da quelli del server.
	let cells = $derived(byKey(data.cells));
	let party = $derived(data.party);
	// La numerazione: ferma (dal server) oppure, finché i giocatori non hanno scoperto niente, dall'angolo in alto a sinistra.
	let numbering = $derived(data.numbering);
	const origin = $derived(numbering ?? topLeft(Object.values(cells), data.map.orientation));
	const featsAt = $derived.by(() => {
		const out: Record<string, Feature[]> = {};
		for (const f of data.features) (out[hexKey(f.q, f.r)] ??= []).push(f);
		return out;
	});

	type Mode = 'terrain' | 'features' | 'fog' | 'party';
	const MODES: { id: Mode; icon: string }[] = [
		{ id: 'terrain', icon: 'hexagon' },
		{ id: 'features', icon: 'marker' },
		{ id: 'fog', icon: 'eye' },
		{ id: 'party', icon: 'flag' }
	];
	const FOG: { state: HexState; overlay: 'none' | 'glimpsed' | 'hidden' }[] = [
		{ state: 'explored', overlay: 'none' },
		{ state: 'glimpsed', overlay: 'glimpsed' },
		{ state: 'hidden', overlay: 'hidden' }
	];
	const SIZES = [20, 28, 36, 48, 64];

	let mode = $state<Mode>(untrack(() => (data.cells.length <= 1 ? 'terrain' : 'features')));
	let brush = $state<string>(untrack(() => data.palette[0] ?? 'plains'));
	let fogBrush = $state<HexState>('explored');
	let view = $state<'map' | 'list'>('map');
	let size = $state(36);
	let showLabels = $state(true);
	let status = $state('');
	let scroller = $state<HTMLDivElement>();

	function firstKey(): string | null {
		if (data.party) return hexKey(data.party.q, data.party.r);
		const f = data.features[0];
		if (f) return hexKey(f.q, f.r);
		const c = data.cells[0];
		return c ? hexKey(c.q, c.r) : null;
	}
	let selected = $state<string | null>(untrack(firstKey));
	let focusKey = $state<string | null>(null);

	const fallbackLook = (id: string): Look => ({ id, name: id, fill: '#dcdfe5', ink: '#3d4350', glyph: '', fallback: true });
	const lookOf = (terrain: string) => data.terrains[terrain] ?? fallbackLook(terrain);
	const label = (h: { q: number; r: number }) => hexLabel(h, o, origin);
	const stateName = (s: string) => t('hex.states.' + s);
	const isParty = (k: string) => !!party && hexKey(party.q, party.r) === k;

	// I posti accanto alla mappa dove il Master può aggiungere un esagono (col terreno scelto).
	const ghosts = $derived.by(() => {
		if (!master || mode !== 'terrain' || brush === 'erase' || view !== 'map') return [];
		const out = new Map<string, { q: number; r: number }>();
		for (const c of Object.values(cells))
			for (const n of neighbors(c)) {
				const k = hexKey(n.q, n.r);
				if (!cells[k] && Math.abs(n.q) <= HEX_RANGE && Math.abs(n.r) <= HEX_RANGE) out.set(k, n);
			}
		return [...out.values()];
	});

	const box = $derived(hexBox(o, size));
	// Mentre un pulsante è premuto la mappa sta ferma, anche se cresce a sinistra o in alto: così il clic (o la
	// pennellata) finisce sull'esagono dove è cominciato. Si rimette in pari quando si rilascia.
	let frozen = $state<{ minX: number; minY: number; offX: number; offY: number; height: number } | null>(null);
	const layout = $derived.by(() => {
		const list = [...Object.values(cells).map((c) => ({ q: c.q, r: c.r, ghost: false })), ...ghosts.map((g) => ({ ...g, ghost: true }))];
		const pts = list.map((h) => ({ ...h, key: hexKey(h.q, h.r), ...hexCenter(h, o, size) }));
		const pad = 16;
		const minX = frozen?.minX ?? Math.min(...pts.map((p) => p.x));
		const minY = frozen?.minY ?? Math.min(...pts.map((p) => p.y));
		const maxX = Math.max(...pts.map((p) => p.x));
		const maxY = Math.max(...pts.map((p) => p.y));
		const items: Item[] = pts
			.map((p) => ({ ...p, left: p.x - minX + pad, top: p.y - minY + pad }))
			.sort((a, b) => a.top - b.top || a.left - b.left);
		return {
			items,
			keys: new Set(items.map((i) => i.key)),
			minX,
			minY,
			width: pts.length ? maxX - minX + box.w + 2 * pad : 0,
			height: pts.length ? maxY - minY + box.h + 2 * pad : 0
		};
	});
	// Il disegno è sempre un po' più grande della finestra, con la mappa al centro: così si può sempre scorrere.
	let viewW = $state(0);
	let viewH = $state(0);
	const canvasW = $derived(Math.max(layout.width, viewW + 2 * box.w));
	const canvasH = $derived(Math.max(layout.height, viewH + 2 * box.h));
	const offX = $derived(frozen?.offX ?? (canvasW - layout.width) / 2);
	const offY = $derived(frozen?.offY ?? (canvasH - layout.height) / 2);
	// Alta quanto serve, fino al 70% della finestra: una mappa piccola non lascia un grande vuoto.
	const scrollH = $derived(frozen?.height ?? Math.round(layout.height + box.h));

	function freeze() {
		frozen ??= { minX: layout.minX, minY: layout.minY, offX, offY, height: scrollH };
		window.addEventListener('pointerup', thaw);
		window.addEventListener('pointercancel', thaw);
	}
	function thaw() {
		window.removeEventListener('pointerup', thaw);
		window.removeEventListener('pointercancel', thaw);
		// Dopo il clic che segue il rilascio.
		setTimeout(() => (frozen = null));
	}
	// Quando la mappa cresce (o la finestra cambia) tutto si sposta: la vista si sposta con un esagono di riferimento,
	// così sotto il puntatore resta lo stesso esagono, anche mentre si dipinge trascinando. Con lo zoom ci pensa centerOn.
	let anchor: { key: string; left: number; top: number; size: number } | null = null;
	$effect(() => {
		const items = layout.items;
		const ox = offX;
		const oy = offY;
		const ref = anchor ? items.find((i) => i.key === anchor!.key) : undefined;
		if (scroller && anchor && ref && anchor.size === size) {
			scroller.scrollLeft += ref.left + ox - anchor.left;
			scroller.scrollTop += ref.top + oy - anchor.top;
		}
		const first = items.find((i) => !i.ghost) ?? items[0];
		anchor = first ? { key: first.key, left: first.left + ox, top: first.top + oy, size } : null;
	});
	// Un solo esagono nell'ordine del Tab: quello col fuoco, altrimenti lo scelto, altrimenti il primo.
	const rover = $derived(
		focusKey && layout.keys.has(focusKey) ? focusKey : selected && layout.keys.has(selected) ? selected : (layout.items[0]?.key ?? null)
	);
	const hid = (k: string) => 'hex-' + k.replace(',', '_');

	function cellLabel(c: Cell, fs: Feature[]) {
		const parts = [t('hex.cell', { label: label(c) }), lookOf(c.terrain).name, stateName(c.state).toLowerCase()];
		for (const f of fs) parts.push(f.visibility === 'master' && master ? `${f.name} (${t('hex.secretFeature')})` : f.name);
		if (isParty(hexKey(c.q, c.r))) parts.push(t('hex.partyHere'));
		return parts.join(', ');
	}

	// --- Modifiche: subito nel browser, poi all'API ---

	type Tool = 'paint' | 'erase' | 'state' | 'party' | 'select';
	const tool = (): Tool => (!master ? 'select' : mode === 'terrain' ? (brush === 'erase' ? 'erase' : 'paint') : mode === 'fog' ? 'state' : mode === 'party' ? 'party' : 'select');

	/** Manda la modifica e rimette in pari gli esagoni toccati; se non va, ricarica la mappa dal server. */
	async function send(body: Record<string, unknown>): Promise<boolean> {
		const r = await fetch(`/api/pages/${encodeURIComponent(slug)}/hexes`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}).catch(() => null);
		const res = r ? await r.json().catch(() => null) : null;
		if (!r?.ok || !res || res.error) {
			status = t(res?.error ?? 'hex.errSave');
			await invalidateAll();
			return false;
		}
		const next = { ...cells };
		for (const c of res.cells as (Cell | { q: number; r: number; terrain: null })[]) {
			const k = hexKey(c.q, c.r);
			if (c.terrain === null) delete next[k];
			else next[k] = c as Cell;
		}
		cells = next;
		party = res.party;
		numbering = res.numbering ?? null;
		if (res.kept?.length) status = t('hex.errKept');
		return true;
	}

	/** Cambia un esagono nel browser (`state`: cosa sanno i giocatori); restituisce falso se non c'era niente da cambiare. */
	function applyLocal(op: Tool, h: { q: number; r: number; ghost?: boolean }, state: HexState = fogBrush): boolean {
		const k = hexKey(h.q, h.r);
		const c = cells[k];
		if (op === 'paint') {
			if (c?.terrain === brush) return false;
			cells = { ...cells, [k]: c ? { ...c, terrain: brush } : { q: h.q, r: h.r, terrain: brush, state: 'hidden', revealedAt: null, note: '' } };
			status = c ? t('hex.painted', { label: label(h), terrain: lookOf(brush).name }) : t('hex.added', { label: label(h) });
			return true;
		}
		if (!c) return false;
		if (op === 'erase') {
			// Con dentro qualcosa o il gruppo resta: lo dice il server, qui non lo togliamo neanche per un attimo.
			if (featsAt[k]?.length || isParty(k) || Object.keys(cells).length <= 1) {
				status = t('hex.errKept');
				return false;
			}
			const next = { ...cells };
			delete next[k];
			cells = next;
			if (selected === k) selected = null;
			status = t('hex.removed', { label: label(h) });
			return true;
		}
		if (op === 'state') {
			if (c.state === state) return false;
			cells = { ...cells, [k]: { ...c, state, revealedAt: state === 'hidden' ? null : (c.revealedAt ?? Date.now()) } };
			status = t('hex.stateSet', { label: label(h), state: stateName(state) });
			return true;
		}
		return false;
	}

	// Col mouse si dipinge anche trascinando: si raccolgono gli esagoni e si mandano tutti insieme alla fine.
	let stroke: { op: Tool; keys: Map<string, { q: number; r: number }> } | null = null;
	// Col mouse il lavoro lo fa pointerdown: il clic che segue va saltato. Col dito e da tastiera conta il clic.
	let lastPointer = '';
	const strokeTool = (op: Tool) => op === 'paint' || op === 'erase' || op === 'state';

	function strokeOver(h: Item) {
		if (!stroke || stroke.keys.has(h.key)) return;
		if (h.ghost && stroke.op !== 'paint') return;
		if (applyLocal(stroke.op, h)) stroke.keys.set(h.key, { q: h.q, r: h.r });
	}

	function down(e: PointerEvent, h: Item) {
		lastPointer = e.pointerType;
		freeze();
		const op = tool();
		if (e.button !== 0 || e.pointerType === 'touch' || !strokeTool(op)) return;
		// Una pennellata rimasta aperta (il mouse si è alzato fuori dalla finestra) si chiude prima.
		if (stroke) endStroke();
		stroke = { op, keys: new Map() };
		selected = h.key;
		strokeOver(h);
		window.addEventListener('pointerup', endStroke, { once: true });
	}

	function endStroke() {
		const s = stroke;
		stroke = null;
		window.removeEventListener('pointerup', endStroke);
		if (!s || !s.keys.size) return;
		const list = [...s.keys.values()];
		if (s.op === 'paint') send({ op: 'paint', terrain: brush, cells: list });
		else if (s.op === 'erase') send({ op: 'erase', cells: list });
		else send({ op: 'state', state: fogBrush, cells: list });
	}

	function clickHex(e: MouseEvent, h: Item) {
		const op = tool();
		// Il clic che chiude una pennellata col mouse: l'esagono è già fatto.
		if (e.detail > 0 && lastPointer !== 'touch' && lastPointer !== '' && strokeTool(op)) return;
		selected = h.key;
		if (op === 'select') return;
		if (op === 'party') {
			if (h.ghost) return;
			party = { q: h.q, r: h.r };
			status = t('hex.partyMoved', { label: label(h) });
			send({ op: 'party', at: { q: h.q, r: h.r }, reveal: true });
			return;
		}
		if (!applyLocal(op, h)) return;
		if (op === 'paint') send({ op: 'paint', terrain: brush, cells: [{ q: h.q, r: h.r }] });
		else if (op === 'erase') send({ op: 'erase', cells: [{ q: h.q, r: h.r }] });
		else send({ op: 'state', state: fogBrush, cells: [{ q: h.q, r: h.r }] });
	}

	/** Dalla scheda dell'esagono: cosa ne sanno i giocatori. */
	function setState(k: string, s: HexState) {
		const c = cells[k];
		if (c && applyLocal('state', c, s)) send({ op: 'state', state: s, cells: [{ q: c.q, r: c.r }] });
	}

	// --- Tastiera: le frecce portano all'esagono più vicino in quella direzione ---

	const DIRS: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

	function keys(e: KeyboardEvent, h: Item) {
		const dir = DIRS[e.key];
		if (!dir) return;
		e.preventDefault();
		let best: Item | null = null;
		let score = Infinity;
		for (const p of layout.items) {
			if (p.key === h.key) continue;
			const vx = p.left - h.left;
			const vy = p.top - h.top;
			const d = Math.hypot(vx, vy);
			const cos = (vx * dir[0] + vy * dir[1]) / d;
			if (cos < 0.45) continue;
			const s = d * (2 - cos);
			if (s < score) {
				score = s;
				best = p;
			}
		}
		if (!best) return;
		focusKey = best.key;
		document.getElementById(hid(best.key))?.focus();
	}

	/** Porta l'esagono al centro della vista. */
	async function centerOn(k: string | null) {
		await tick();
		const it = k ? layout.items.find((i) => i.key === k) : undefined;
		if (!it || !scroller) return;
		scroller.scrollLeft = it.left + offX + box.w / 2 - scroller.clientWidth / 2;
		scroller.scrollTop = it.top + offY + box.h / 2 - scroller.clientHeight / 2;
	}
	onMount(() => centerOn(selected));

	function zoom(step: number) {
		const i = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(size) + step));
		size = SIZES[i];
		centerOn(selected);
	}

	// --- La scheda dell'esagono scelto ---

	const sel = $derived(selected ? cells[selected] : undefined);
	const selFeats = $derived(selected ? (featsAt[selected] ?? []) : []);
	const dateFmt = $derived(new Intl.DateTimeFormat(locale, { dateStyle: 'long' }));
	function revealedText(c: Cell) {
		if (c.state === 'hidden') return t('hex.notRevealed');
		if (!master && c.state === 'glimpsed') return t('hex.glimpsedHint');
		return c.revealedAt ? t('hex.revealedOn', { date: dateFmt.format(new Date(c.revealedAt)) }) : '';
	}

	const known = $derived(Object.values(cells).filter((c) => c.state !== 'hidden').length);
	const total = $derived(Object.keys(cells).length);
	const scaleText = $derived(
		data.map.scale ? t('hex.scaleLabel', { d: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(data.map.scale)} ${data.map.unit}`.trim() }) : ''
	);

	const rows = $derived(
		Object.entries(cells)
			.map(([k, c]) => ({ key: k, c, label: label(c), feats: featsAt[k] ?? [] }))
			.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
	);

	// --- Il popup degli elementi ---

	interface Draft {
		id: number | null;
		q: number;
		r: number;
		name: string;
		icon: string;
		description: string;
		page: string;
		visibility: 'players' | 'master';
	}
	let draft = $state<Draft | null>(null);
	let dialog = $state<HTMLDialogElement>();
	let opener: HTMLElement | null = null;
	$effect(() => dialog?.showModal());

	function newFeature(c: Cell, e: MouseEvent) {
		opener = e.currentTarget as HTMLElement;
		draft = { id: null, q: c.q, r: c.r, name: '', icon: 'city', description: '', page: '', visibility: 'players' };
	}
	function editFeature(f: Feature, e: MouseEvent) {
		opener = e.currentTarget as HTMLElement;
		draft = { id: f.id, q: f.q, r: f.r, name: f.name, icon: f.icon, description: f.description, page: f.pageTitle, visibility: f.visibility };
	}
	function closed() {
		draft = null;
		opener?.focus();
	}
</script>

{#snippet tileFor(terrain: string, width: number, overlay: 'none' | 'glimpsed' | 'hidden' = 'none')}
	{@const l = lookOf(terrain)}
	<HexTile fill={l.fill} ink={l.ink} glyph={l.glyph} fallback={l.fallback} orientation={o} {width} {overlay} />
{/snippet}

<div class="hexmap">
	<p class="summary muted">
		{#if scaleText}<span>{scaleText}</span>{/if}
		<span>{master ? t('hex.summaryMaster', { total, known }) : t('hex.summaryPlayer', { n: total })}</span>
		{#if master}<span>{t('hex.tileset')}: {data.tileset.name}</span>{/if}
	</p>
	{#if data.tileset.missing}<p class="warning-note" role="note">{t('hex.tilesetMissing', { name: data.tileset.missing })}</p>{/if}

	{#if !draft}<FormError error={form?.error ?? null} />{/if}

	{#if master}
		<section class="tools" aria-label={t('hex.modes.label')}>
			<div class="tool-row">
				<div class="segmented" role="group" aria-label={t('hex.modes.label')}>
					{#each MODES as m (m.id)}
						<button class="btn btn-small" type="button" aria-pressed={mode === m.id} onclick={() => (mode = m.id)}><Icon name={m.icon} />{t('hex.modes.' + m.id)}</button>
					{/each}
				</div>
				<form method="post" action="/campaign?/asPlayer" class="as-player">
					<input type="hidden" name="next" value={page.url.pathname} />
					<button class="btn btn-small btn-ghost" type="submit"><Icon name="eye" />{t('hex.asPlayer')}</button>
				</form>
			</div>

			{#if mode === 'terrain'}
				<div class="tool-row palette" role="group" aria-label={t('hex.cols.terrain')}>
					{#each data.palette as id (id)}
						<button class="btn btn-small tool" type="button" aria-pressed={brush === id} onclick={() => (brush = id)}>{@render tileFor(id, 26)}{lookOf(id).name}</button>
					{/each}
					<button class="btn btn-small tool" type="button" aria-pressed={brush === 'erase'} onclick={() => (brush = 'erase')}><Icon name="trash" />{t('hex.erase')}</button>
				</div>
			{:else if mode === 'fog'}
				<div class="tool-row" role="group" aria-label={t('hex.whatPlayersKnow')}>
					{#each FOG as f (f.state)}
						<button class="btn btn-small tool" type="button" aria-pressed={fogBrush === f.state} onclick={() => (fogBrush = f.state)}>
							{@render tileFor(data.palette[0] ?? 'plains', 26, f.overlay)}{t('hex.brush.' + f.state)}
						</button>
					{/each}
					<button class="btn btn-small" type="button" disabled={!party} onclick={async () => { if (await send({ op: 'reveal' })) status = t('hex.revealed'); }}><Icon name="flag" />{t('hex.revealAround')}</button>
				</div>
			{:else if mode === 'party' && party}
				<div class="tool-row">
					<button
						class="btn btn-small"
						type="button"
						onclick={() => {
							party = null;
							send({ op: 'party', at: null, reveal: false });
						}}><Icon name="close" />{t('hex.removeParty')}</button
					>
				</div>
			{/if}
			<p class="hint">{t('hex.hints.' + (mode === 'terrain' && brush === 'erase' ? 'erase' : mode))}</p>
		</section>
	{/if}

	<div class="view-row">
		<div class="segmented" role="group" aria-label={t('hex.views.label')}>
			<button class="btn btn-small" type="button" aria-pressed={view === 'map'} onclick={() => (view = 'map')}>{t('hex.views.map')}</button>
			<button class="btn btn-small" type="button" aria-pressed={view === 'list'} onclick={() => (view = 'list')}>{t('hex.views.list')}</button>
		</div>
		{#if view === 'map'}
			<div class="zoom">
				<button class="btn btn-small btn-ghost" type="button" title={t('hex.zoomOut')} aria-label={t('hex.zoomOut')} disabled={size === SIZES[0]} onclick={() => zoom(-1)}><Icon name="minus" /></button>
				<button class="btn btn-small btn-ghost" type="button" title={t('hex.zoomIn')} aria-label={t('hex.zoomIn')} disabled={size === SIZES[SIZES.length - 1]} onclick={() => zoom(1)}><Icon name="plus" /></button>
			</div>
			<label class="choice"><input type="checkbox" bind:checked={showLabels} /><span>{t('hex.showLabels')}</span></label>
		{/if}
	</div>

	<p class="status" role="status">{status}</p>

	<div class="layout">
		<div class="main">
			{#if view === 'map'}
				<div class="scroll" bind:this={scroller} bind:clientWidth={viewW} bind:clientHeight={viewH} style="height: min({scrollH}px, 70vh, 46rem)">
					<div class="canvas" role="group" aria-label={t('hex.mapLabel', { title })} style="width: {canvasW}px; height: {canvasH}px">
						{#each layout.items as h (h.key)}
							{@const c = h.ghost ? undefined : cells[h.key]}
							{@const look = c ? lookOf(c.terrain) : undefined}
							{@const fs = c ? (featsAt[h.key] ?? []) : []}
							<!-- Lo stesso pulsante resta quando il «+» diventa un esagono: il clic finisce dove è cominciato. -->
							<button
								type="button"
								class="hex"
								class:ghost={!c}
								id={hid(h.key)}
								style="left: {h.left + offX}px; top: {h.top + offY}px; width: {box.w}px; height: {box.h}px; clip-path: {shape.clip}"
								tabindex={h.key === rover ? 0 : -1}
								aria-label={c ? cellLabel(c, fs) : t('hex.addCell', { label: label(h) })}
								aria-pressed={c ? selected === h.key : undefined}
								onclick={(e) => clickHex(e, h)}
								onpointerdown={(e) => down(e, h)}
								onpointerenter={() => strokeOver(h)}
								onkeydown={(e) => keys(e, h)}
								onfocus={() => (focusKey = h.key)}
							>
								<svg viewBox={shape.viewBox} preserveAspectRatio="none" aria-hidden="true" focusable="false">
									{#if !c || !look}
										<polygon points={shape.points} class="cell" />
										<path d="M{shape.center[0]} {shape.center[1] - 9}v18M{shape.center[0] - 9} {shape.center[1]}h18" class="plus" />
									{:else}
										<polygon points={shape.points} fill={look.fill} class="cell" class:fallback={look.fallback} />
										{#if look.glyph}
											{#each shape.spots as [x, y], i (i)}<path d={look.glyph} stroke={look.ink} transform={glyphTransform(x, y, 0.95)} class="glyph" />{/each}
											{#if !fs.length}<path d={look.glyph} stroke={look.ink} transform={glyphTransform(shape.center[0], shape.center[1] + 2, 0.95)} class="glyph" />{/if}
										{:else if look.fallback && size >= 36}
											<text x={shape.center[0]} y={shape.center[1] + 4} class="fb-name">{look.name}</text>
										{/if}
										{#if c.state === 'glimpsed' && !master}<polygon points={shape.points} class="pale" />{/if}
										{#if c.state === 'hidden'}
											<polygon points={shape.points} class="fog" />
											<path d={hatch} class="hatch" />
										{:else if c.state === 'glimpsed'}
											<polygon points={shape.inset} class="dots" />
										{/if}
										{#if showLabels && size >= 36}<text x={shape.label[0]} y={shape.label[1]} class="coord">{label(c)}</text>{/if}
										{#if fs.length}
											<!-- Più elementi: un secondo cerchio dietro il primo (i nomi sono tutti nell'etichetta del pulsante). -->
											{#if fs.length > 1}<circle cx={shape.badge[0] + 7} cy={shape.badge[1] - 5} r="15" class={fs[1].visibility === 'master' && master ? 'badge secret' : 'badge'} />{/if}
											<circle cx={shape.badge[0]} cy={shape.badge[1]} r="15" class={fs[0].visibility === 'master' && master ? 'badge secret' : 'badge'} />
											<svg x={shape.badge[0] - 11} y={shape.badge[1] - 11} width="22" height="22" viewBox="0 0 24 24"><path d={iconPath(PIN_ICON[fs[0].icon] ?? 'dot')} class="ico" /></svg>
										{/if}
										{#if isParty(h.key)}
											<circle cx={shape.party[0]} cy={shape.party[1]} r="11" class="party" />
											<svg x={shape.party[0] - 7.5} y={shape.party[1] - 7.5} width="15" height="15" viewBox="0 0 24 24"><path d={iconPath('flag')} class="party-ico" /></svg>
										{/if}
										{#if selected === h.key}
											<polygon points={shape.inset} class="sel-out" />
											<polygon points={shape.inset} class="sel" />
										{/if}
									{/if}
									<polygon points={shape.inset} class="ring-out" />
									<polygon points={shape.inset} class="ring" />
								</svg>
							</button>
						{/each}
					</div>
				</div>
				<p class="hint keys">{t('hex.keyboardHint')}</p>
				<ul class="list-plain legend" aria-label={t('hex.legend.label')}>
					<li>{@render tileFor(data.palette[0] ?? 'plains', 28)}{t('hex.legend.explored')}</li>
					<li>{@render tileFor(data.palette[0] ?? 'plains', 28, 'glimpsed')}{t('hex.legend.glimpsed')}</li>
					{#if master}
						<li>{@render tileFor(data.palette[0] ?? 'plains', 28, 'hidden')}{t('hex.legend.hidden')}</li>
						<li><svg class="legend-icon" viewBox="0 0 40 40" width="22" height="22" aria-hidden="true"><circle cx="20" cy="20" r="15" class="badge secret" /></svg>{t('hex.legend.secret')}</li>
					{/if}
					<li><svg class="legend-icon" viewBox="0 0 30 30" width="22" height="22" aria-hidden="true"><circle cx="15" cy="15" r="12" class="party" /><svg x="7.5" y="7.5" width="15" height="15" viewBox="0 0 24 24"><path d={iconPath('flag')} class="party-ico" /></svg></svg>{t('hex.legend.party')}</li>
				</ul>
			{:else if rows.length}
				<div class="table-scroll">
					<table class="data">
						<caption class="visually-hidden">{t('hex.mapLabel', { title })}</caption>
						<thead>
							<tr>
								<th scope="col">{t('hex.cols.hex')}</th>
								<th scope="col">{t('hex.cols.terrain')}</th>
								<th scope="col">{t('hex.cols.state')}</th>
								<th scope="col">{t('hex.cols.contents')}</th>
							</tr>
						</thead>
						<tbody>
							{#each rows as row (row.key)}
								<tr>
									<th scope="row">
										<button class="btn btn-small btn-ghost" type="button" aria-pressed={selected === row.key} onclick={() => (selected = row.key)}>{row.label}</button>
									</th>
									<td>{lookOf(row.c.terrain).name}</td>
									<td>{stateName(row.c.state)}</td>
									<td>
										{#each row.feats as f, i (f.id)}{i ? ', ' : ''}{f.name}{#if f.visibility === 'master' && master}{' '}<span class="muted">({t('hex.secretFeature')})</span>{/if}{:else}—{/each}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="muted">{t('hex.listEmpty')}</p>
			{/if}
		</div>

		<aside class="panel card" aria-labelledby="hex-panel-title">
			{#if sel && selected}
				<div class="panel-head">
					{@render tileFor(sel.terrain, 46)}
					<div>
						<h2 id="hex-panel-title">{t('hex.cell', { label: label(sel) })}</h2>
						<p class="muted">{lookOf(sel.terrain).name} · {stateName(sel.state)}</p>
					</div>
				</div>
				{#if revealedText(sel)}<p class="muted small">{revealedText(sel)}</p>{/if}
				{#if view === 'list'}
					<button class="btn btn-small" type="button" onclick={() => { view = 'map'; centerOn(selected); }}><Icon name="map" />{t('hex.showOnMap')}</button>
				{/if}

				{#if master}
					<fieldset class="know">
						<legend>{t('hex.whatPlayersKnow')}</legend>
						<div class="segmented">
							{#each FOG as f (f.state)}
								<button class="btn btn-small" type="button" aria-pressed={sel.state === f.state} onclick={() => setState(selected!, f.state)}>{stateName(f.state)}</button>
							{/each}
						</div>
					</fieldset>
				{/if}

				<section aria-labelledby="hex-feats-title">
					<h3 id="hex-feats-title">{t('hex.features')}</h3>
					{#if selFeats.length}
						<ul class="list-plain feats">
							{#each selFeats as f (f.id)}
								<li class="feat">
									<span class="feat-icon" class:secret={f.visibility === 'master' && master}><Icon name={PIN_ICON[f.icon] ?? 'dot'} /></span>
									<div class="feat-body">
										<strong>{f.name}</strong>
										<span class="muted small">
											{t('maps.icons.' + f.icon)}
											{#if master}<span class="badge">{#if f.visibility === 'master'}<Icon name="lock" />{/if}{t('visibility.' + f.visibility)}</span>{/if}
										</span>
										{#if f.html}<p class="small">{@html f.html}</p>{/if}
										{#if f.page && !f.page.missing}<a href="/wiki/{f.page.slug}">{t('maps.openPage', { title: f.page.title })}</a>{/if}
										{#if f.page?.missing}<a class="wikilink missing" href="/wiki/new?{new URLSearchParams({ title: f.name, slug: f.page.slug }).toString()}">{t('maps.createPage')}</a>{/if}
										{#if master && f.visibility === 'players' && sel.state !== 'explored'}<span class="muted small">{t('hex.waitExplored')}</span>{/if}
									</div>
									{#if master}
										<button class="btn btn-small btn-ghost" type="button" title={t('hex.editFeature')} onclick={(e) => editFeature(f, e)}><Icon name="edit" /><span class="visually-hidden">{t('hex.editFeature')}: {f.name}</span></button>
									{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<p class="muted small">{!master && sel.state === 'glimpsed' ? t('hex.noFeaturesGlimpsed') : t('hex.noFeatures')}</p>
					{/if}
					{#if master}
						<button class="btn btn-small" type="button" onclick={(e) => newFeature(sel, e)}><Icon name="plus" />{t('hex.addFeature')}</button>
					{/if}
				</section>

				{#if master}
					{#key selected + sel.note}
						<form
							class="secret note"
							method="post"
							action="?/hexNote"
							use:enhance={() =>
								async ({ update }) => {
									await update({ reset: false });
								}}
						>
							<input type="hidden" name="q" value={sel.q} />
							<input type="hidden" name="r" value={sel.r} />
							<label class="secret-title" for="hex-note">{t('hex.note')}</label>
							<textarea id="hex-note" name="note" rows="3" maxlength="2000" aria-describedby="hex-note-hint">{sel.note}</textarea>
							<span id="hex-note-hint" class="hint">{t('hex.noteHint')}</span>
							<button class="btn btn-small" type="submit"><Icon name="save" />{t('hex.saveNote')}</button>
						</form>
					{/key}
				{/if}
			{:else}
				<h2 id="hex-panel-title">{t('hex.noSelection')}</h2>
				<p class="muted">{t('hex.noSelectionHint')}</p>
			{/if}
		</aside>
	</div>
</div>

{#if draft && data.editData}
	<dialog bind:this={dialog} class="feature-form" aria-labelledby="feature-form-title" onclose={closed}>
		<h2 id="feature-form-title">{draft.id ? t('hex.editFeature') : t('hex.newFeature', { label: label(draft) })}</h2>
		<FormError error={form?.error ?? null} />
		<form
			method="post"
			action="?/hexFeature"
			use:enhance={() =>
				async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success') dialog?.close();
				}}
		>
			{#if draft.id}<input type="hidden" name="id" value={draft.id} />{/if}
			<input type="hidden" name="q" value={draft.q} />
			<input type="hidden" name="r" value={draft.r} />
			<div class="cols">
				<div class="field">
					<label for="feat-name">{t('common.name')}</label>
					<input id="feat-name" name="name" type="text" required maxlength="120" bind:value={draft.name} />
				</div>
				<div class="field">
					<label for="feat-icon">{t('hex.kind')}</label>
					<select id="feat-icon" name="icon" bind:value={draft.icon}>
						{#each data.editData.icons as i (i)}<option value={i}>{t('maps.icons.' + i)}</option>{/each}
					</select>
				</div>
			</div>
			<div class="field">
				<label for="feat-page">{t('maps.linkedPage')}</label>
				<input id="feat-page" name="page" type="text" list="feat-pages" autocomplete="off" bind:value={draft.page} aria-describedby="feat-page-hint" />
				<span id="feat-page-hint" class="hint">{t('maps.linkedPageHint')}</span>
				<datalist id="feat-pages">{#each data.editData.pageTitles as p, i (i)}<option value={p}></option>{/each}</datalist>
			</div>
			<div class="field">
				<label for="feat-desc">{t('common.description')}</label>
				<textarea id="feat-desc" name="description" rows="3" maxlength="1000" bind:value={draft.description}></textarea>
			</div>
			<fieldset>
				<legend>{t('page.visibility')}</legend>
				<label class="choice"><input type="radio" name="visibility" value="players" bind:group={draft.visibility} /><span>{t('visibility.players')}</span></label>
				<label class="choice"><input type="radio" name="visibility" value="master" bind:group={draft.visibility} /><span>{t('visibility.master')}</span></label>
			</fieldset>
			<div class="actions">
				<button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button>
			</div>
		</form>
		{#if draft.id}
			<form method="post" action="?/deleteHexFeature" use:enhance={() => async ({ update }) => { await update(); dialog?.close(); }}>
				<input type="hidden" name="id" value={draft.id} />
				<button class="btn btn-danger btn-small" type="submit"><Icon name="trash" />{t('hex.deleteFeature')}</button>
			</form>
		{/if}
		<button class="btn btn-small btn-ghost dialog-close" type="button" title={t('common.close')} aria-label={t('common.close')} onclick={() => dialog?.close()}><Icon name="close" /></button>
	</dialog>
{/if}

<style>
	.hexmap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
		margin: 0;
		font-size: var(--fs-sm);
	}
	.warning-note {
		margin: 0;
		padding: 0.5rem 0.75rem;
		border-left: 4px solid var(--c-warning-border);
		background: var(--c-surface);
		box-shadow: inset 0 0 0 1px var(--c-border);
		border-radius: var(--radius);
	}
	.tools {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.75rem;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface);
	}
	.tool-row,
	.view-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.75rem;
	}
	.as-player {
		margin-left: auto;
	}
	.segmented {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.btn[aria-pressed='true'] {
		background: var(--c-primary);
		border-color: var(--c-primary);
		color: var(--c-on-primary);
	}
	.tool {
		gap: 0.45rem;
		padding-left: 0.4rem;
	}
	.palette {
		gap: 0.3rem;
	}
	.hint {
		margin: 0;
	}
	.zoom {
		display: inline-flex;
		gap: 0.15rem;
	}
	.status {
		min-height: 1.4em;
		margin: 0;
		font-weight: 600;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
		gap: 1.25rem;
		align-items: start;
	}
	@container (max-width: 52rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.scroll {
		overflow: auto;
		min-height: 12rem;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface2);
		overscroll-behavior: contain;
	}
	.canvas {
		position: relative;
	}
	/* Ogni esagono è un pulsante ritagliato a esagono: il clic vale solo dentro la sua forma. */
	.hex {
		position: absolute;
		display: block;
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.hex svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.hex:focus {
		outline: none;
	}
	.hex .cell {
		stroke: #16181d;
		stroke-opacity: 0.3;
		stroke-width: 1.5px;
		vector-effect: non-scaling-stroke;
	}
	.hex .fallback {
		stroke: #3d4350;
		stroke-opacity: 1;
		stroke-dasharray: 4 3;
	}
	.glyph {
		fill: none;
		stroke-width: 1.3px;
		vector-effect: non-scaling-stroke;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.fb-name,
	.coord {
		font-family: var(--font-ui, system-ui, sans-serif);
		fill: #16181d;
		text-anchor: middle;
	}
	.fb-name {
		font-size: 12px;
		font-weight: 600;
	}
	.coord {
		font-size: 11px;
		font-weight: 600;
		fill-opacity: 0.7;
	}
	.pale {
		fill: #ffffff;
		fill-opacity: 0.4;
	}
	.fog {
		fill: #ffffff;
		fill-opacity: 0.55;
	}
	.hatch {
		fill: none;
		stroke: #555b69;
		stroke-width: 1px;
		vector-effect: non-scaling-stroke;
	}
	.dots {
		fill: none;
		stroke: #16181d;
		stroke-width: 2.6px;
		stroke-dasharray: 0.1 5;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.badge {
		fill: #ffffff;
		stroke: #16181d;
		stroke-width: 1.5px;
		vector-effect: non-scaling-stroke;
	}
	.badge.secret {
		stroke: #8a4fbf;
		stroke-width: 2.5px;
		stroke-dasharray: 4 2.5;
	}
	.ico {
		fill: none;
		stroke: #16181d;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.party {
		fill: #3b4fd8;
		stroke: #ffffff;
		stroke-width: 2px;
		vector-effect: non-scaling-stroke;
	}
	.party-ico {
		fill: none;
		stroke: #ffffff;
		stroke-width: 2.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* Scelto: blu scuro su bianco; col fuoco della tastiera: arancione su bianco. Si vedono su ogni terreno. */
	.sel-out,
	.ring-out {
		fill: none;
		stroke: #ffffff;
		stroke-width: 7px;
		vector-effect: non-scaling-stroke;
	}
	.sel {
		fill: none;
		stroke: #1e2a8a;
		stroke-width: 3.5px;
		vector-effect: non-scaling-stroke;
	}
	.ring-out,
	.ring {
		display: none;
	}
	.ring {
		fill: none;
		stroke: #c2410c;
		stroke-width: 4px;
		vector-effect: non-scaling-stroke;
	}
	.hex:focus-visible .ring-out,
	.hex:focus-visible .ring {
		display: inline;
	}
	.ghost .cell {
		fill: #ffffff;
		fill-opacity: 0;
		stroke: #767c8c;
		stroke-opacity: 1;
		stroke-dasharray: 5 4;
	}
	.ghost .plus {
		fill: none;
		stroke: #555b69;
		stroke-width: 2px;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.ghost:hover .cell,
	.ghost:focus-visible .cell {
		fill-opacity: 0.85;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.25rem;
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	.legend li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.legend-icon {
		flex: 0 0 auto;
	}
	/* I tasti della mappa, dove la tastiera non c'è. */
	@media (hover: none) {
		.keys {
			display: none;
		}
	}
	.table-scroll {
		overflow-x: auto;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.panel h2 {
		margin: 0;
		font-size: var(--fs-md);
	}
	.panel h3 {
		margin: 0 0 0.4rem;
		font-size: var(--fs-base);
	}
	.panel p {
		margin: 0;
	}
	.panel-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.small {
		font-size: var(--fs-sm);
	}
	.know {
		margin: 0;
		padding: 0;
		border: 0;
	}
	.know legend {
		font-weight: 600;
		margin-bottom: 0.4rem;
	}
	.feats {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.6rem;
	}
	.feat {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
	}
	.feat-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		border: 1.5px solid currentColor;
	}
	.feat-icon.secret {
		border: 2px dashed var(--c-secret-border);
		color: var(--c-secret-text);
	}
	.feat-body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex: 1 1 auto;
		min-width: 0;
	}
	.feat-body .badge {
		margin-left: 0.35rem;
	}
	.note {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0;
	}
	.note textarea {
		width: 100%;
		box-sizing: border-box;
	}
	.note .btn {
		align-self: flex-start;
	}
	.feature-form {
		width: min(100% - 2rem, 36rem);
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
	.feature-form::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	.feature-form h2 {
		margin-top: 0;
		padding-right: 2.5rem;
	}
	.dialog-close {
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
	.actions {
		margin: 0.75rem 0;
	}
</style>
