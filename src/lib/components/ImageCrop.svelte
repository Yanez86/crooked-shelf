<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import Icon from './Icon.svelte';

	/**
	 * Ritaglio di un'immagine (colonna a lato, testo, copertina). Si trascina il riquadro per spostarlo, l'angolo per cambiarne la misura,
	 * o se ne disegna uno nuovo fuori; da tastiera le frecce (con Maiusc la misura). `ondone` riceve il file ritagliato,
	 * o null se si chiude senza ritagliare: il file nuovo si carica come un'immagine scelta, l'originale non si tocca.
	 */
	let { src, ondone }: { src: string; ondone: (file: File | null) => void } = $props();
	const t = getT();
	let dlg = $state<HTMLDialogElement>();
	let img = $state<HTMLImageElement>();
	let area = $state<HTMLElement>();
	// La parte da tenere, in frazioni dell'immagine (0–1).
	let r = $state({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
	let drag: { mode: 'move' | 'size' | 'draw'; px: number; py: number; start: typeof r } | null = null;
	let file: File | null = null;
	const MIN = 0.05;

	$effect(() => dlg?.showModal());

	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

	function point(e: PointerEvent) {
		const b = area!.getBoundingClientRect();
		return { px: clamp((e.clientX - b.left) / b.width, 0, 1), py: clamp((e.clientY - b.top) / b.height, 0, 1) };
	}

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		area!.setPointerCapture(e.pointerId);
		const p = point(e);
		const el = e.target as HTMLElement;
		drag = { mode: el.classList.contains('handle') ? 'size' : el.classList.contains('sel') ? 'move' : 'draw', ...p, start: { ...r } };
	}

	function move(e: PointerEvent) {
		if (!drag) return;
		const { px, py } = point(e);
		const { start: s } = drag;
		if (drag.mode === 'move') {
			r.x = clamp(s.x + px - drag.px, 0, 1 - s.w);
			r.y = clamp(s.y + py - drag.py, 0, 1 - s.h);
		} else if (drag.mode === 'size') {
			r.w = clamp(s.w + px - drag.px, MIN, 1 - s.x);
			r.h = clamp(s.h + py - drag.py, MIN, 1 - s.y);
		} else r = { x: Math.min(px, drag.px), y: Math.min(py, drag.py), w: Math.abs(px - drag.px), h: Math.abs(py - drag.py) };
	}

	// Un clic fuori dal riquadro non disegna niente: torna quello di prima.
	function up() {
		if (drag?.mode === 'draw' && (r.w < MIN || r.h < MIN)) r = drag.start;
		drag = null;
	}

	function keys(e: KeyboardEvent) {
		const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
		if (!d) return;
		e.preventDefault();
		const [dx, dy] = d.map((v) => v * 0.02);
		if (e.shiftKey) {
			r.w = clamp(r.w + dx, MIN, 1 - r.x);
			r.h = clamp(r.h + dy, MIN, 1 - r.y);
		} else {
			r.x = clamp(r.x + dx, 0, 1 - r.w);
			r.y = clamp(r.y + dy, 0, 1 - r.h);
		}
	}

	// Alla misura vera dell'immagine, non a quella sullo schermo. WebP dove il browser lo sa scrivere, se no PNG.
	function crop() {
		const W = img!.naturalWidth;
		const H = img!.naturalHeight;
		const c = document.createElement('canvas');
		c.width = Math.max(1, Math.round(r.w * W));
		c.height = Math.max(1, Math.round(r.h * H));
		c.getContext('2d')!.drawImage(img!, Math.round(r.x * W), Math.round(r.y * H), c.width, c.height, 0, 0, c.width, c.height);
		c.toBlob(
			(b) => {
				if (b) file = new File([b], `crop.${b.type.split('/')[1]}`, { type: b.type });
				dlg?.close();
			},
			'image/webp',
			0.92
		);
	}

	const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dlg} aria-labelledby="crop-title" onkeydown={(e) => e.key === 'Escape' && e.stopPropagation()} onclose={() => ondone(file)}>
	<h2 id="crop-title">{t('fields.cropTitle')}</h2>
	<p id="crop-hint" class="hint">{t('fields.cropHint')}</p>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="area" bind:this={area} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
		<img bind:this={img} {src} alt="" draggable="false" />
		<button
			class="sel"
			type="button"
			style:left={pct(r.x)}
			style:top={pct(r.y)}
			style:width={pct(r.w)}
			style:height={pct(r.h)}
			aria-label={t('fields.cropArea')}
			aria-describedby="crop-hint"
			onkeydown={keys}
		>
			<span class="handle" aria-hidden="true"></span>
		</button>
	</div>
	<div class="actions">
		<button class="btn" type="button" onclick={() => dlg?.close()}>{t('common.cancel')}</button>
		<button class="btn btn-primary" type="button" onclick={crop}><Icon name="crop" />{t('fields.crop')}</button>
	</div>
</dialog>

<style>
	dialog {
		width: fit-content;
		max-width: calc(100% - 2rem);
		padding: 1.25rem;
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	h2 {
		margin: 0 0 0.25rem;
		font-size: var(--fs-md);
	}
	.hint {
		margin: 0 0 0.75rem;
		max-width: 36rem;
	}
	/* Fuori dal riquadro l'immagine si scurisce; col dito si ritaglia, non si scorre la pagina. */
	.area {
		position: relative;
		width: fit-content;
		overflow: hidden;
		touch-action: none;
		user-select: none;
		cursor: crosshair;
	}
	img {
		display: block;
		max-width: min(100%, 60rem);
		max-height: 65vh;
	}
	.sel {
		position: absolute;
		padding: 0;
		border: 0;
		background: none;
		box-shadow: 0 0 0 100vmax rgb(0 0 0 / 0.55);
		outline: 2px solid #fff;
		cursor: move;
	}
	.sel:focus-visible {
		outline: 3px solid var(--c-primary);
		outline-offset: 0;
	}
	.handle {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 1.5rem;
		height: 1.5rem;
		background: #fff;
		border: 2px solid var(--c-primary);
		border-radius: 50%;
		cursor: nwse-resize;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1rem;
	}
</style>
