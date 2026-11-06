<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';
	import { getT } from '../i18n/index.ts';
	import Icon from './Icon.svelte';
	import { GEOM, fitPpu, layoutLine, ticksFor, type TickGen } from '../timelineScale.ts';

	/**
	 * La linea del tempo in scala: gli eventi (già in ordine) con la loro posizione `t` in giorni.
	 * I salti lunghi si accorciano; lo zoom va dai pulsanti, da Ctrl + rotella e dal pizzico; si trascina per
	 * spostarsi e la panoramica in alto porta in un punto. Le frecce passano da un evento all'altro.
	 * Le schede le disegna chi la usa (`card`), così come i dettagli dell'evento scelto.
	 */
	let {
		items,
		selected,
		onselect,
		onpick,
		ticks: tickGen,
		maxPpu,
		todayT,
		todayLabel,
		gapLabel,
		labelAt,
		card
	}: {
		items: { id: number; t: number; kind: 'event' | 'master' | 'session' }[];
		selected: number | null;
		onselect: (id: number) => void;
		/** Doppio clic in un punto vuoto: la posizione e lo zoom, per proporre un evento lì. */
		onpick?: (t: number, ppu: number) => void;
		ticks: TickGen;
		maxPpu: number;
		todayT: number | null;
		todayLabel: string;
		gapLabel: (days: number) => string;
		labelAt: (t: number, ppu: number) => string;
		card: Snippet<[number]>;
	} = $props();
	const t = getT();

	const MIN_PPU = 1e-9;
	let scroller = $state<HTMLDivElement>();
	let visible = $state(0);
	let scrollLeft = $state(0);
	/** Pixel per giorno scelti con lo zoom; null = «Adatta», tutto in vista. */
	let zoom = $state<number | null>(null);

	// Prima di conoscere la larghezza (sul server) si dispone per uno schermo medio.
	const room = $derived(visible || 900);
	const fit = $derived(fitPpu(items, room, MIN_PPU, maxPpu));
	const ppu = $derived(zoom === null ? fit : Math.min(maxPpu, Math.max(fit, zoom)));
	const L = $derived(layoutLine(items, ppu, room));
	const tickList = $derived(ticksFor(L, tickGen));
	const kinds = $derived(new Map(items.map((i) => [i.id, i.kind])));
	const placed = $derived(new Map(L.cards.map((c) => [c.id, c])));
	// Un solo evento si raggiunge con Tab: quello scelto, o il primo; poi le frecce.
	const tabStop = $derived(selected !== null && placed.has(selected) ? selected : (L.cards[0]?.id ?? null));
	const todayX = $derived(todayT === null ? null : L.xOf(todayT));
	const maxScroll = $derived(Math.max(0, L.width - visible));
	const pct = (x: number) => `${(x / L.width) * 100}%`;
	const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	async function zoomTo(next: number | null, anchor?: number) {
		if (!scroller) return;
		const px = anchor ?? scroller.clientWidth / 2;
		const at = L.tOf(scroller.scrollLeft + px);
		zoom = next === null || next <= fit * 1.001 ? null : Math.min(maxPpu, next);
		await tick();
		scroller.scrollLeft = L.xOf(at) - px;
		scrollLeft = scroller.scrollLeft;
	}

	/** Porta in vista la scheda di un evento, se non lo è già. */
	function reveal(id: number | null, smooth: boolean) {
		const c = id === null ? undefined : placed.get(id);
		if (!c || !scroller) return;
		const left = c.x - GEOM.pin;
		if (left >= scroller.scrollLeft + 8 && left + GEOM.cardW <= scroller.scrollLeft + scroller.clientWidth - 8) return;
		scroller.scrollTo({ left: left + GEOM.cardW / 2 - scroller.clientWidth / 2, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
	}
	let firstReveal = true;
	$effect(() => {
		const id = selected;
		untrack(() => {
			reveal(id, !firstReveal);
			firstReveal = false;
		});
	});

	async function onCardKey(ev: KeyboardEvent, id: number) {
		const i = L.cards.findIndex((c) => c.id === id);
		const to = ({ ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: L.cards.length - 1 } as Record<string, number>)[ev.key];
		if (to === undefined) return;
		ev.preventDefault();
		const next = L.cards[Math.max(0, Math.min(L.cards.length - 1, to))];
		onselect(next.id);
		await tick();
		document.getElementById(`event-${next.id}`)?.focus({ preventScroll: true });
	}

	// Ctrl + rotella (e il pizzico sul trackpad, che arriva come rotella con Ctrl): zoom attorno al puntatore.
	$effect(() => {
		const el = scroller;
		if (!el) return;
		const wheel = (ev: WheelEvent) => {
			if (!ev.ctrlKey) return;
			ev.preventDefault();
			zoomTo(ppu * Math.exp(-ev.deltaY * 0.01), ev.clientX - el.getBoundingClientRect().left);
		};
		el.addEventListener('wheel', wheel, { passive: false });
		return () => el.removeEventListener('wheel', wheel);
	});

	// Trascinare col mouse sposta la striscia; due dita sul touch fanno lo zoom.
	let drag = $state<{ x: number; s: number; id: number; moved: boolean } | null>(null);
	const touches = new Map<number, number>();
	let pinch: { d: number; ppu: number } | null = null;
	function down(ev: PointerEvent) {
		if (!scroller) return;
		if (ev.pointerType === 'touch') {
			touches.set(ev.pointerId, ev.clientX);
			if (touches.size === 2) {
				const [a, b] = [...touches.values()];
				pinch = { d: Math.abs(a - b) || 1, ppu };
			}
			return;
		}
		if (ev.button === 0 && !(ev.target as Element).closest('button')) drag = { x: ev.clientX, s: scroller.scrollLeft, id: ev.pointerId, moved: false };
	}
	function move(ev: PointerEvent) {
		if (!scroller) return;
		if (touches.has(ev.pointerId)) {
			touches.set(ev.pointerId, ev.clientX);
			if (pinch && touches.size === 2) {
				const [a, b] = [...touches.values()];
				const target = (pinch.ppu * Math.abs(a - b)) / pinch.d;
				if (Math.abs(target / ppu - 1) > 0.04) zoomTo(target, (a + b) / 2 - scroller.getBoundingClientRect().left);
			}
			return;
		}
		if (!drag) return;
		const dx = ev.clientX - drag.x;
		if (!drag.moved && Math.abs(dx) > 4) {
			drag.moved = true;
			scroller.setPointerCapture(drag.id);
		}
		if (drag.moved) scroller.scrollLeft = drag.s - dx;
	}
	function up(ev: PointerEvent) {
		touches.delete(ev.pointerId);
		if (touches.size < 2) pinch = null;
		drag = null;
	}
	function pick(ev: MouseEvent) {
		if (!onpick || !scroller || (ev.target as Element).closest('button')) return;
		onpick(L.tOf(ev.clientX - scroller.getBoundingClientRect().left + scroller.scrollLeft), ppu);
	}

	// La panoramica: un cursore che porta la striscia nel punto scelto.
	let miniDrag = false;
	function miniTo(ev: PointerEvent) {
		if (!scroller) return;
		const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
		scroller.scrollLeft = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * L.width - scroller.clientWidth / 2;
	}
	function miniKey(ev: KeyboardEvent) {
		if (!scroller) return;
		const w = scroller.clientWidth;
		const by = ({ ArrowRight: w / 4, ArrowUp: w / 4, ArrowLeft: -w / 4, ArrowDown: -w / 4, PageDown: w, PageUp: -w } as Record<string, number>)[ev.key];
		if (by !== undefined) scroller.scrollLeft += by;
		else if (ev.key === 'Home') scroller.scrollLeft = 0;
		else if (ev.key === 'End') scroller.scrollLeft = L.width;
		else return;
		ev.preventDefault();
	}
</script>

<div class="line-tools">
	<div
		class="mini"
		role="slider"
		tabindex="0"
		aria-label={t('timeline.overview')}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={maxScroll ? Math.round((scrollLeft / maxScroll) * 100) : 0}
		aria-valuetext={t('timeline.overviewAt', { date: labelAt(L.tOf(scrollLeft + visible / 2), ppu) })}
		onkeydown={miniKey}
		onpointerdown={(e) => {
			miniDrag = true;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			miniTo(e);
		}}
		onpointermove={(e) => miniDrag && miniTo(e)}
		onpointerup={() => (miniDrag = false)}
		onpointercancel={() => (miniDrag = false)}
	>
		{#if todayX !== null}<span class="mini-today" style:left={pct(todayX)}></span>{/if}
		{#each L.cards as c (c.id)}<span class="mini-dot {kinds.get(c.id)}" style:left={pct(c.x)}></span>{/each}
		<span class="mini-win" style:left={pct(scrollLeft)} style:width={pct(Math.min(visible || L.width, L.width))}></span>
	</div>
	<div class="zoom" role="group" aria-label={t('timeline.zoom')}>
		<button type="button" class="btn btn-small" onclick={() => zoomTo(ppu / 1.8)} disabled={zoom === null} title={t('timeline.zoomOut')}><Icon name="minus" /><span class="visually-hidden">{t('timeline.zoomOut')}</span></button>
		<button type="button" class="btn btn-small" onclick={() => zoomTo(ppu * 1.8)} disabled={ppu >= maxPpu} title={t('timeline.zoomIn')}><Icon name="plus" /><span class="visually-hidden">{t('timeline.zoomIn')}</span></button>
		<button type="button" class="btn btn-small" onclick={() => zoomTo(null)} aria-pressed={zoom === null}><Icon name="fullscreen" />{t('timeline.zoomFit')}</button>
	</div>
</div>

<!-- svelte-ignore a11y_no_static_element_interactions (trascinare e il doppio clic sono scorciatoie: tutto si fa anche coi pulsanti e la tastiera) -->
<div
	class="scroller"
	class:dragging={drag?.moved}
	role="region"
	aria-label={t('timeline.viewLine')}
	bind:this={scroller}
	bind:clientWidth={visible}
	onscroll={() => (scrollLeft = scroller?.scrollLeft ?? 0)}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	ondblclick={pick}
>
	<div class="track" style:width="{L.width}px" style:height="{L.height}px">
		{#if todayX !== null}<div class="today" style:left="{todayX}px"><span>{todayLabel}</span></div>{/if}
		<div class="axis" style:top="{L.axisY}px"></div>
		{#each tickList as k (k.t)}
			<div class="tick" class:major={k.major} style:left="{k.x}px" style:top="{L.axisY}px"><span>{k.label}</span></div>
		{/each}
		{#each L.gaps as g (g.x)}
			<div class="gap" style:left="{g.x}px" style:top="{L.axisY}px">{gapLabel(g.days)}</div>
		{/each}
		{#each L.cards as c (c.id)}
			<div class="stem" class:sel={c.id === selected} style:left="{c.x}px" style:top="{c.bottom}px" style:height="{L.axisY - c.bottom}px"></div>
			<div class="pin {kinds.get(c.id)}" class:sel={c.id === selected} style:left="{c.x}px" style:top="{L.axisY}px"></div>
		{/each}
		<ol class="list-plain cards">
			{#each L.cards as c (c.id)}
				<li>
					<button
						type="button"
						id="event-{c.id}"
						class="card {kinds.get(c.id)}"
						aria-current={c.id === selected ? 'true' : undefined}
						tabindex={c.id === tabStop ? 0 : -1}
						style:left="{c.x - GEOM.pin}px"
						style:top="{c.top}px"
						style:width="{GEOM.cardW}px"
						style:height="{GEOM.cardH}px"
						onclick={() => onselect(c.id)}
						onkeydown={(e) => onCardKey(e, c.id)}>{@render card(c.id)}</button
					>
				</li>
			{/each}
		</ol>
	</div>
</div>

<div class="foot">
	<p class="legend" aria-hidden="true">
		<span><i class="mark event"></i>{t('timeline.legendEvent')}</span>
		{#if items.some((i) => i.kind === 'session')}<span><i class="mark session"></i>{t('timeline.session')}</span>{/if}
		{#if items.some((i) => i.kind === 'master')}<span><i class="mark master"></i>{t('visibility.master')}</span>{/if}
		{#if todayT !== null}<span><i class="mark today"></i>{t('timeline.legendToday')}</span>{/if}
	</p>
	<p class="hint">{t('timeline.lineHint')}{#if onpick}{' ' + t('timeline.lineHintAdd')}{/if}</p>
</div>

<style>
	.line-tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1rem;
		align-items: center;
		margin-bottom: 0.6rem;
	}
	.mini {
		position: relative;
		flex: 1 1 12rem;
		height: 2rem;
		border: 1px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface2);
		cursor: pointer;
		touch-action: none;
		overflow: hidden;
	}
	.mini-dot,
	.mini-today {
		position: absolute;
		top: 50%;
	}
	.mini-dot {
		width: 7px;
		height: 7px;
		margin: -3.5px 0 0 -3.5px;
		background: var(--c-primary);
		transform: rotate(45deg);
	}
	.mini-dot.master {
		background: var(--c-surface);
		border: 1.5px solid var(--c-secret-border);
	}
	.mini-today {
		top: 3px;
		bottom: 3px;
		border-left: 2px dashed var(--c-warning-border);
	}
	.mini-win {
		position: absolute;
		top: 0;
		bottom: 0;
		min-width: 14px;
		border: 2px solid var(--c-primary);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--c-primary) 10%, transparent);
		pointer-events: none;
	}
	.zoom {
		display: flex;
		gap: 0.35rem;
	}
	.zoom button[aria-pressed='true'] {
		border-color: var(--c-primary);
	}

	.scroller {
		position: relative;
		overflow-x: auto;
		overflow-y: hidden;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface);
		cursor: grab;
		touch-action: pan-x;
		overscroll-behavior-x: contain;
	}
	.scroller.dragging {
		cursor: grabbing;
		user-select: none;
	}
	.track {
		position: relative;
	}
	.axis {
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		margin-top: -1px;
		background: var(--c-control);
	}
	.today {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 2px dashed var(--c-warning-border);
	}
	.today span {
		position: absolute;
		top: 0.4rem;
		left: 0.3rem;
		padding: 0 0.3rem;
		font-size: var(--fs-sm);
		font-weight: 600;
		white-space: nowrap;
		background: var(--c-surface);
	}
	.tick {
		position: absolute;
		width: 1px;
		height: 6px;
		background: var(--c-control);
	}
	.tick.major {
		width: 2px;
		height: 10px;
		margin-top: -4px;
	}
	.tick span {
		position: absolute;
		top: 0.6rem;
		left: 0;
		transform: translateX(-50%);
		font-size: var(--fs-sm);
		color: var(--c-muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.tick.major span {
		top: 0.85rem;
		color: var(--c-text);
		font-weight: 600;
	}
	.gap {
		position: absolute;
		transform: translate(-50%, -50%);
		padding: 0 0.5rem;
		border: 1px dashed var(--c-control);
		border-radius: 999px;
		background: var(--c-surface);
		font-size: var(--fs-sm);
		color: var(--c-muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.stem {
		position: absolute;
		width: 2px;
		margin-left: -1px;
		background: var(--c-border);
	}
	.stem.sel {
		background: var(--c-primary);
		z-index: 3;
	}
	/* Lo stesso segno dell'elenco: rombo vuoto, pieno per le sessioni, tratteggiato per il Master. */
	.pin,
	.mark {
		position: absolute;
		width: 0.8rem;
		height: 0.8rem;
		margin: -0.4rem 0 0 -0.4rem;
		border: 3px solid var(--c-primary);
		border-radius: var(--radius);
		background: var(--c-surface);
		transform: rotate(45deg);
		z-index: 1;
	}
	.pin.session,
	.mark.session {
		background: var(--c-primary);
	}
	.pin.master,
	.mark.master {
		border: 2px dashed var(--c-secret-border);
	}
	.pin.sel {
		box-shadow: 0 0 0 3px var(--c-surface), 0 0 0 5px var(--c-primary);
		z-index: 4;
	}
	.cards {
		position: absolute;
		inset: 0;
	}
	.cards li {
		min-height: 0;
	}
	.card {
		position: absolute;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.45rem 0.65rem;
		overflow: hidden;
		text-align: left;
		font: inherit;
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		cursor: pointer;
		z-index: 2;
	}
	.card:hover {
		border-color: var(--c-control);
	}
	.card.master {
		background: var(--c-secret-bg);
		color: var(--c-secret-text);
		border-color: var(--c-secret-border);
	}
	.card[aria-current='true'] {
		border: 2px solid var(--c-primary);
		padding: calc(0.45rem - 1px) calc(0.65rem - 1px);
		z-index: 5;
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.25rem 1.5rem;
		margin-top: 0.5rem;
	}
	.foot p {
		margin: 0;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		font-size: var(--fs-sm);
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.mark {
		position: static;
		margin: 0;
		width: 0.65rem;
		height: 0.65rem;
		border-width: 2px;
	}
	.mark.today {
		width: 0;
		height: 0.9rem;
		border: 0;
		border-left: 2px dashed var(--c-warning-border);
		border-radius: 0;
		transform: none;
		background: none;
	}
</style>
