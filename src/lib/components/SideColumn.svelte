<script lang="ts">
	import { flushSync, tick, untrack, type Snippet } from 'svelte';
	import { flip } from 'svelte/animate';
	import { getT } from '../i18n/index.ts';
	import type { PageField } from '../content/types.ts';
	import Icon from './Icon.svelte';

	/**
	 * La colonna a lato in modifica. Di base non c'è: il «+» la aggiunge. Dentro, riquadri modificati sul posto:
	 * di testo (un titolo e un testo breve) o immagine (un titoletto, l'immagine, la didascalia). L'immagine si carica subito,
	 * la pagina la tiene quando si salva. `fixed` = ci sono riquadri fissi (il resoconto di sessione, in `children`):
	 * allora la colonna resta aperta.
	 */
	let { fields, fixed = false, children }: { fields: PageField[]; fixed?: boolean; children?: Snippet } = $props();
	const t = getT();

	interface Box extends PageField {
		key: number;
		// Solo per i riquadri immagine: caricamento ed esito.
		busy?: boolean;
		message?: string;
		failed?: boolean;
		over?: boolean;
	}

	let next = 0;
	let rows = $state<Box[]>(untrack(() => fields.map((f) => ({ ...f, key: next++ }))));
	let open = $state(untrack(() => fixed || fields.length > 0));
	let announce = $state('');
	// Un riquadro immagine ancora senza immagine non si salva.
	const json = $derived(
		JSON.stringify(
			rows.flatMap(({ label, value, image, title }) =>
				image !== undefined
					? image
						? [{ label, value: '', image, title: title ?? '' }]
						: []
					: label.trim() || value.trim()
						? [{ label, value }]
						: []
			)
		)
	);

	async function focus(id: string) {
		await tick();
		document.getElementById(id)?.focus();
	}

	function openColumn() {
		open = true;
		focus('side-add-text');
	}
	function closeColumn() {
		open = false;
		focus('side-open');
	}
	function addText() {
		rows.push({ key: next++, label: '', value: '' });
		announce = t('fields.added');
		focus(`field-label-${rows.length - 1}`);
	}
	function addImage() {
		rows.push({ key: next++, label: '', value: '', image: '', title: '' });
		announce = t('fields.added');
		focus(`field-pick-${rows.length - 1}`);
	}
	function remove(i: number) {
		rows.splice(i, 1);
		announce = t('fields.removed');
		focus('side-add-text');
	}
	// La prima immagine è anche quella della pagina (galleria, anteprime): l'ordine conta.
	function move(i: number, d: -1 | 1) {
		const j = i + d;
		const [row] = rows.splice(i, 1);
		rows.splice(j, 0, row);
		announce = t('fields.moved');
		// Il fuoco resta sulla freccia, o passa all'altra se in cima o in fondo questa non serve più.
		const dir = (d < 0 && j > 0) || j === rows.length - 1 ? 'up' : 'down';
		focus(`field-${dir}-${j}`);
	}
	const isImage = (row: Box) => row.image !== undefined;
	const boxName = (row: Box, i: number) => (isImage(row) ? t('fields.image', { n: i + 1 }) : t('fields.label', { n: i + 1 }));

	/*
	 * Trascinare un riquadro dalla maniglia: col mouse, col dito e con la penna (eventi del puntatore, non il drag and drop
	 * del browser, che sul telefono non va). Il riquadro segue il puntatore e prende il posto degli altri appena ne supera la metà.
	 * Le frecce fanno lo stesso da tastiera.
	 */
	let list = $state<HTMLElement>();
	let drag = $state<{ key: number; pointer: number; from: number; startY: number; startTop: number; y: number; dy: number; moved: boolean } | null>(null);
	let scroller: HTMLElement | null = null;
	let frame = 0;

	// Le coordinate sono quelle della colonna: valgono anche se nel frattempo la pagina (o la colonna) scorre.
	const boxes = () => [...list!.querySelectorAll<HTMLElement>(':scope > [data-box]')];
	const inList = (clientY: number) => clientY - list!.getBoundingClientRect().top - list!.clientTop;

	// Il movimento si ascolta sulla finestra: spostato tra gli altri, il riquadro esce e rientra nella pagina, e la maniglia può perdere il puntatore.
	function grab(e: PointerEvent, row: Box) {
		if (e.button !== 0 || drag || !list) return;
		e.preventDefault();
		const grip = e.currentTarget as HTMLElement;
		grip.setPointerCapture(e.pointerId);
		drag = { key: row.key, pointer: e.pointerId, from: e.clientY, startY: inList(e.clientY), startTop: grip.closest<HTMLElement>('[data-box]')!.offsetTop, y: e.clientY, dy: 0, moved: false };
		scroller = scrollParent(list);
		frame = requestAnimationFrame(autoscroll);
		addEventListener('pointermove', pointerMove);
		addEventListener('pointerup', drop);
		addEventListener('pointercancel', drop);
	}

	function pointerMove(e: PointerEvent) {
		if (e.pointerId !== drag?.pointer) return;
		drag.y = e.clientY;
		follow();
	}

	function follow() {
		if (!drag || !list) return;
		const y = inList(drag.y);
		const i = rows.findIndex((r) => r.key === drag!.key);
		const els = boxes();
		const mid = (el: HTMLElement) => el.offsetTop + el.offsetHeight / 2;
		let j = i;
		while (j > 0 && y < mid(els[j - 1])) j--;
		if (j === i) while (j < rows.length - 1 && y > mid(els[j + 1])) j++;
		if (j !== i) {
			const [row] = rows.splice(i, 1);
			rows.splice(j, 0, row);
			drag.moved = true;
			flushSync();
		}
		// Dove il riquadro starebbe da solo, e dove lo porta il puntatore.
		drag.dy = drag.startTop + (y - drag.startY) - boxes()[j].offsetTop;
	}

	function drop(e: PointerEvent) {
		if (e.pointerId !== drag?.pointer) return;
		cancelAnimationFrame(frame);
		removeEventListener('pointermove', pointerMove);
		removeEventListener('pointerup', drop);
		removeEventListener('pointercancel', drop);
		if (drag.moved) announce = t('fields.moved');
		drag = null;
	}

	function scrollParent(el: HTMLElement): HTMLElement {
		for (let p = el.parentElement; p; p = p.parentElement) {
			const o = getComputedStyle(p).overflowY;
			if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
		}
		return document.scrollingElement as HTMLElement;
	}

	// Vicino al bordo dello schermo (o della colonna, se scorre da sola) la pagina scorre: si arriva anche ai riquadri fuori vista.
	// Solo dopo che il puntatore si è mosso: un riquadro preso vicino al bordo non fa scorrere niente.
	function autoscroll() {
		if (!drag || !scroller) return;
		const r = scroller === document.scrollingElement ? { top: 0, bottom: innerHeight } : scroller.getBoundingClientRect();
		const top = Math.max(r.top, 0) + 48;
		const bottom = Math.min(r.bottom, innerHeight) - 48;
		const going = Math.abs(drag.y - drag.from) > 12;
		const step = !going ? 0 : drag.y < top ? (drag.y - top) / 4 : drag.y > bottom ? (drag.y - bottom) / 4 : 0;
		if (step) {
			scroller.scrollBy(0, step);
			follow();
		}
		frame = requestAnimationFrame(autoscroll);
	}

	// Chi ha chiesto meno movimento vede i riquadri cambiare posto senza scivolare.
	const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';

	async function upload(box: Box, file: File) {
		box.busy = true;
		box.failed = false;
		box.message = t('fields.uploading');
		const body = new FormData();
		body.append('file', file);
		const r = await fetch('/api/files', { method: 'POST', body }).catch(() => null);
		const data = r ? await r.json().catch(() => ({})) : {};
		box.busy = false;
		if (r?.ok && data.id) {
			box.image = data.id;
			box.message = t('fields.uploaded');
		} else {
			box.failed = true;
			box.message = t(data.error ?? 'errors.generic');
		}
	}

	function dragover(e: DragEvent, box: Box) {
		if (!isImage(box) || !e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		box.over = true;
	}
	function dragleave(e: DragEvent, box: Box) {
		if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) box.over = false;
	}
	function dropFile(e: DragEvent, box: Box) {
		const file = e.dataTransfer?.files[0];
		if (!isImage(box) || !file) return;
		e.preventDefault();
		box.over = false;
		if (!box.busy) upload(box, file);
	}
</script>

<input type="hidden" name="fields" value={json} />

{#snippet removeButton(row: Box, i: number, cls: string)}
	<button class="{cls} remove" type="button" title={t('common.delete')} onclick={() => remove(i)}>
		<Icon name="close" /><span class="visually-hidden">{t('common.delete')}: {boxName(row, i)}</span>
	</button>
{/snippet}

<!--
	La riga in cima a ogni riquadro: maniglia, titolo, e a destra elimina e frecce. Sta sopra l'immagine, mai sull'immagine:
	lì ci sono già la matita e la crocetta.
-->
{#snippet head(row: Box, i: number)}
	<!-- Solo per il puntatore: da tastiera e coi lettori di schermo si sposta con le frecce. -->
	<span class="grip" title={t('fields.drag')} aria-hidden="true" onpointerdown={(e) => grab(e, row)}>
		<Icon name="grip" />
	</span>
	{#if isImage(row)}
		<label class="visually-hidden" for="field-title-{i}">{t('fields.imageTitle', { n: i + 1 })}</label>
		<input id="field-title-{i}" class="box-label" type="text" maxlength="60" placeholder={t('fields.titlePlaceholder')} bind:value={row.title} />
	{:else}
		<label class="visually-hidden" for="field-label-{i}">{t('fields.label', { n: i + 1 })}</label>
		<input id="field-label-{i}" class="box-label" type="text" maxlength="60" placeholder={t('fields.labelPlaceholder')} bind:value={row.label} />
	{/if}
	<div class="tools">
		<!-- Con l'immagine, la crocetta sta sull'immagine stessa: qui restano le frecce. -->
		{#if !row.image}{@render removeButton(row, i, 'tool')}{/if}
		<button id="field-up-{i}" class="tool" type="button" title={t('fields.moveUp')} disabled={i === 0} onclick={() => move(i, -1)}>
			<Icon name="arrowUp" /><span class="visually-hidden">{t('fields.moveUp')}: {boxName(row, i)}</span>
		</button>
		<button id="field-down-{i}" class="tool" type="button" title={t('fields.moveDown')} disabled={i === rows.length - 1} onclick={() => move(i, 1)}>
			<Icon name="arrowDown" /><span class="visually-hidden">{t('fields.moveDown')}: {boxName(row, i)}</span>
		</button>
	</div>
{/snippet}

{#if open}
	<section class="side panel" aria-label={t('fields.column')} bind:this={list}>
		{@render children?.()}
		{#each rows as row, i (row.key)}
			<div
				class="box"
				class:image-box={isImage(row)}
				class:over={row.over}
				class:dragging={drag?.key === row.key}
				style:transform={drag?.key === row.key ? `translateY(${drag.dy}px)` : null}
				data-box
				role="group"
				aria-label={isImage(row) ? t('fields.image', { n: i + 1 }) : t('fields.box', { n: i + 1 })}
				aria-busy={row.busy}
				ondragover={(e) => dragover(e, row)}
				ondragleave={(e) => dragleave(e, row)}
				ondrop={(e) => dropFile(e, row)}
				animate:flip={{ duration: drag?.key === row.key || still() ? 0 : 150 }}
			>
				{@render head(row, i)}
				{#if !isImage(row)}
					<label class="visually-hidden" for="field-value-{i}">{t('fields.value', { n: i + 1 })}</label>
					<input id="field-value-{i}" class="box-value" type="text" maxlength="500" placeholder={t('fields.valuePlaceholder')} bind:value={row.value} />
				{:else}
					{#if row.image}
						<div class="frame">
							<img src="/files/{row.image}" alt="" draggable="false" />
							<!-- Come la matita della pagina: si cambia e si cancella dall'immagine stessa. -->
							<div class="on-image">
								<button id="field-pick-{i}" class="on-tool" type="button" title={t('fields.changeImage')} disabled={row.busy} onclick={() => document.getElementById(`field-file-${i}`)?.click()}>
									<Icon name="edit" /><span class="visually-hidden">{t('fields.changeImage')}: {boxName(row, i)}</span>
								</button>
								{@render removeButton(row, i, 'on-tool')}
							</div>
						</div>
					{:else}
						<p class="drop">{t('fields.drop')}</p>
						<button id="field-pick-{i}" class="btn btn-small pick" type="button" disabled={row.busy} onclick={() => document.getElementById(`field-file-${i}`)?.click()}>
							{t('fields.chooseImage')}
						</button>
					{/if}
					<input
						id="field-file-{i}"
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif"
						aria-label={t('fields.file', { n: i + 1 })}
						hidden
						onchange={(e) => {
							const f = e.currentTarget.files?.[0];
							e.currentTarget.value = '';
							if (f) upload(row, f);
						}}
					/>
					<p class="status" class:failed={row.failed} role="status">{row.message ?? ''}</p>
					<label class="visually-hidden" for="field-caption-{i}">{t('fields.caption', { n: i + 1 })}</label>
					<input id="field-caption-{i}" class="caption" type="text" maxlength="200" placeholder={t('fields.captionPlaceholder')} bind:value={row.label} />
				{/if}
			</div>
		{/each}
		<div class="adds" role="group" aria-labelledby="side-add-label">
			<span id="side-add-label" class="adds-label">{t('fields.add')}</span>
			<button id="side-add-text" class="add" type="button" onclick={addText}><Icon name="plus" />{t('fields.text')}</button>
			<button class="add" type="button" onclick={addImage}><Icon name="plus" />{t('fields.imageBox')}</button>
		</div>
		{#if !fixed && !rows.length}
			<button class="btn btn-small btn-ghost close" type="button" onclick={closeColumn}>{t('fields.removeColumn')}</button>
		{/if}
		<p class="visually-hidden" aria-live="polite">{announce}</p>
	</section>
{:else}
	<button id="side-open" class="open" type="button" title={t('fields.addColumn')} onclick={openColumn}>
		<Icon name="plus" /><span class="visually-hidden">{t('fields.addColumn')}</span>
	</button>
{/if}

<style>
	/* Come la colonna della pagina: un riquadro a sé, staccato dal testo. */
	.side {
		position: relative;
		width: var(--side-col);
		max-width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.open {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		font: inherit;
		font-size: 1.5rem;
		line-height: 1;
		border: 1px dashed var(--c-control);
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		cursor: pointer;
	}
	.open:hover,
	.open:focus-visible {
		color: var(--c-primary);
		border-color: var(--c-primary);
		background: var(--c-surface);
	}
	/* In cima la riga con maniglia, titolo e comandi; sotto il resto, allineato al titolo (l'immagine prende tutta la larghezza). */
	.box {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		column-gap: 0.25rem;
		padding: 0.25rem 0.25rem 0.4rem 0.1rem;
		border-radius: var(--radius);
		outline: 1px dashed var(--c-border);
	}
	.box > * {
		grid-column: 2 / -1;
	}
	.box > .grip {
		grid-column: 1;
		grid-row: 1;
	}
	.box > .box-label {
		grid-column: 2;
		grid-row: 1;
	}
	.box > .tools {
		grid-column: 3;
		grid-row: 1;
	}
	.box:hover {
		outline-color: var(--c-control);
		background: var(--c-surface2);
	}
	.box:focus-within {
		outline: 2px solid var(--c-primary);
		background: var(--c-surface2);
	}
	/* Il riquadro che si trascina sta sopra gli altri. */
	.box.dragging {
		z-index: 5;
		outline: 2px solid var(--c-primary);
		background: var(--c-surface);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.3);
	}
	.grip {
		display: inline-grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--radius);
		color: var(--c-muted);
		cursor: grab;
		/* Col dito la maniglia trascina il riquadro, non la pagina; e niente selezione né menu del telefono. */
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.grip:hover {
		color: var(--c-primary);
		background: var(--c-surface);
	}
	.dragging .grip {
		cursor: grabbing;
		color: var(--c-primary);
	}
	/* Gli input sembrano testo: si scrive dove si legge. */
	.box input[type='text'] {
		border: 0;
		background: none;
		padding: 0.1rem 0;
		min-height: 0;
		width: 100%;
	}
	.box input:focus {
		outline: none;
	}
	.box-label {
		font-weight: 700;
	}
	.image-box {
		row-gap: 0.4rem;
	}
	.image-box > :is(.frame, .drop, .status, .caption) {
		grid-column: 1 / -1;
	}
	.image-box.over {
		outline: 3px dashed var(--c-primary);
		outline-offset: 2px;
	}
	.frame {
		position: relative;
	}
	.image-box img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 28rem;
		object-fit: contain;
		background: var(--c-surface2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
	}
	.on-image {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		display: flex;
		gap: 0.25rem;
	}
	/* Stessa misura della matita della pagina; con un fondo pieno, perché si vedano su qualsiasi immagine. */
	.on-tool {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface);
		color: var(--c-muted);
		font: inherit;
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
	}
	.on-tool:hover:not(:disabled),
	.on-tool:focus-visible {
		color: var(--c-primary);
	}
	.on-tool.remove:hover,
	.on-tool.remove:focus-visible {
		color: var(--c-danger);
	}
	.on-tool:disabled {
		cursor: progress;
		opacity: 0.6;
	}
	.drop {
		margin: 0;
		padding: 1.5rem 0.75rem;
		text-align: center;
		font-size: var(--fs-sm);
		color: var(--c-muted);
		border: 2px dashed var(--c-control);
		border-radius: var(--radius);
	}
	.over .drop {
		border-style: solid;
		border-color: var(--c-primary);
	}
	.pick {
		justify-self: start;
	}
	.status {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	.status:empty {
		display: none;
	}
	.status.failed {
		color: var(--c-danger);
		font-weight: 600;
	}
	.caption {
		font-size: var(--fs-field);
	}
	.tools {
		display: flex;
	}
	.tool {
		display: inline-grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}
	.tool:hover:not(:disabled),
	.tool:focus-visible {
		color: var(--c-primary);
		background: var(--c-surface);
	}
	.tool:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.remove {
		font-size: 1.1rem;
	}
	.remove:hover,
	.remove:focus-visible {
		color: var(--c-danger);
	}
	.adds {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.adds-label {
		flex-basis: 100%;
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	.add {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		font: inherit;
		font-size: var(--fs-sm);
		padding: 0.5rem;
		border: 1px dashed var(--c-control);
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		cursor: pointer;
	}
	.add:hover,
	.add:focus-visible {
		color: var(--c-primary);
		border-color: var(--c-primary);
	}
	.close {
		align-self: flex-start;
	}
	/* Col dito comandi e maniglia crescono; restano nella riga del titolo, sopra l'immagine. */
	@media (max-width: 48rem), (pointer: coarse) {
		.grip {
			width: 2rem;
			height: 2.25rem;
		}
		.tool {
			width: 2.25rem;
			height: 2.25rem;
		}
		.on-tool {
			width: 2.5rem;
			height: 2.5rem;
		}
		.add {
			min-height: 2.75rem;
		}
	}
</style>
