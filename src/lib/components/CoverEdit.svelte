<script lang="ts">
	import { tick } from 'svelte';
	import { getT } from '../i18n/index.ts';
	import { COVER_COLORS, COVER_Y_DEFAULT, type PageCover } from '../covers.ts';
	import Icon from './Icon.svelte';

	/**
	 * La copertina in modifica. Sul lato tre icone: cambia, riposiziona (solo le immagini), togli.
	 * Il pannello sceglie un'immagine della galleria, un colore pieno o un file nuovo.
	 * `picking`: il pannello è aperto (la pagina non sovrappone l'icona alla copertina).
	 */
	let { cover = $bindable(null), picking = $bindable(false) }: { cover?: PageCover | null; picking?: boolean } = $props();
	const t = getT();

	type Tab = 'gallery' | 'colors' | 'upload';
	type GalleryItem = { id: string; url: string; alt: string };
	const TABS: Tab[] = ['gallery', 'colors', 'upload'];

	let tab = $state<Tab>('gallery');
	let gallery = $state<GalleryItem[] | null>(null);
	let galleryError = $state(false);
	let uploading = $state(false);
	let uploadError = $state('');
	let moving = $state(false);
	let frame = $state<HTMLDivElement>();
	let img = $state<HTMLImageElement>();
	let slider = $state<HTMLDivElement>();
	let heading = $state<HTMLHeadingElement>();
	let opener: HTMLElement | null = null;
	let drag: { y: number; from: number } | null = null;

	async function loadGallery() {
		galleryError = false;
		try {
			const r = await fetch('/api/gallery');
			if (!r.ok) throw new Error(String(r.status));
			gallery = await r.json();
		} catch {
			galleryError = true;
		}
	}

	async function openPicker(e: MouseEvent) {
		opener = e.currentTarget as HTMLElement;
		moving = false;
		picking = true;
		if (!gallery) loadGallery();
		await tick();
		heading?.focus();
	}

	async function closePicker() {
		picking = false;
		await tick();
		(opener?.isConnected ? opener : document.getElementById(cover ? 'cover-change' : 'cover-add'))?.focus();
	}

	async function choose(next: PageCover) {
		cover = next;
		picking = false;
		uploadError = '';
		await tick();
		document.getElementById('cover-change')?.focus();
	}

	async function upload(file: File) {
		uploading = true;
		uploadError = '';
		try {
			const body = new FormData();
			body.append('file', file);
			const r = await fetch('/api/files', { method: 'POST', body });
			const res = await r.json().catch(() => ({}));
			if (!r.ok || !res.id) {
				uploadError = res.error ?? 'errors.generic';
				return;
			}
			gallery = [{ id: res.id, url: res.url, alt: file.name }, ...(gallery ?? [])];
			await choose({ image: res.id, color: null, y: COVER_Y_DEFAULT });
		} catch {
			uploadError = 'errors.generic';
		} finally {
			uploading = false;
		}
	}

	async function remove() {
		cover = null;
		moving = false;
		await tick();
		document.getElementById('cover-add')?.focus();
	}

	// --- Riposizionare: si trascina l'immagine, oppure si usa il cursore con le frecce (0 = in alto, 100 = in basso). ---

	async function startMoving() {
		moving = true;
		await tick();
		slider?.focus();
	}

	async function stopMoving() {
		moving = false;
		drag = null;
		await tick();
		document.getElementById('cover-move')?.focus();
	}

	const setY = (y: number) => {
		if (cover) cover = { ...cover, y: Math.min(100, Math.max(0, Math.round(y))) };
	};

	/** Di quanti pixel l'immagine è più alta della fascia (quanto si può spostare). */
	function overflow() {
		if (!img || !frame || !img.naturalWidth) return 0;
		const r = frame.getBoundingClientRect();
		const scale = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
		return img.naturalHeight * scale - r.height;
	}

	function keys(e: KeyboardEvent) {
		if (!cover) return;
		const step = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 20, PageDown: -20 }[e.key];
		if (step !== undefined) setY(cover.y + step);
		else if (e.key === 'Home') setY(0);
		else if (e.key === 'End') setY(100);
		else if (e.key === 'Escape' || e.key === 'Enter') stopMoving();
		else return;
		e.preventDefault();
	}

	function down(e: PointerEvent) {
		if (!cover) return;
		drag = { y: e.clientY, from: cover.y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent) {
		const room = overflow();
		// Trascinando in giù si vede la parte di sopra.
		if (drag && room > 0) setY(drag.from - ((e.clientY - drag.y) / room) * 100);
	}
</script>

<input type="hidden" name="coverImage" value={cover?.image ?? ''} />
<input type="hidden" name="coverColor" value={cover?.color ?? ''} />
<input type="hidden" name="coverY" value={cover?.y ?? COVER_Y_DEFAULT} />

{#if cover}
	<div class="page-cover" class:moving bind:this={frame} style:background-color={cover.color ? COVER_COLORS[cover.color] : null}>
		{#if cover.image}
			<img bind:this={img} src="/files/{cover.image}" alt="" draggable="false" style:object-position="50% {cover.y}%" />
		{/if}
		{#if moving}
			<div
				class="slider"
				role="slider"
				tabindex="0"
				aria-label={t('cover.position')}
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={cover.y}
				aria-valuetext="{cover.y}%"
				bind:this={slider}
				onkeydown={keys}
				onpointerdown={down}
				onpointermove={move}
				onpointerup={() => (drag = null)}
				onpointercancel={() => (drag = null)}
			>
				<span class="hint">{t('cover.repositionHint')}</span>
			</div>
			<button class="btn btn-small done" type="button" onclick={stopMoving}><Icon name="check" />{t('cover.done')}</button>
		{:else}
			<!-- Sul lato, piccole e di un solo colore: il nome nel suggerimento e per chi usa un lettore di schermo. -->
			<div class="tools" role="group" aria-label={t('cover.title')}>
				<button id="cover-change" class="tool" type="button" title={t('cover.change')} aria-expanded={picking} aria-controls="cover-picker" onclick={openPicker}>
					<Icon name="image" /><span class="visually-hidden">{t('cover.change')}</span>
				</button>
				{#if cover.image}
					<button id="cover-move" class="tool" type="button" title={t('cover.reposition')} onclick={startMoving}>
						<Icon name="move" /><span class="visually-hidden">{t('cover.reposition')}</span>
					</button>
				{/if}
				<button id="cover-remove" class="tool" type="button" title={t('cover.remove')} onclick={remove}>
					<Icon name="trash" /><span class="visually-hidden">{t('cover.remove')}</span>
				</button>
			</div>
		{/if}
	</div>
{:else}
	<p class="add-row">
		<button id="cover-add" class="add" type="button" aria-expanded={picking} aria-controls="cover-picker" onclick={openPicker}><Icon name="image" />{t('cover.add')}</button>
	</p>
{/if}

{#if picking}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions (Esc chiude il pannello, come nei menu) -->
	<section id="cover-picker" class="picker" aria-labelledby="cover-picker-title" onkeydown={(e) => e.key === 'Escape' && (e.preventDefault(), closePicker())}>
		<div class="picker-head">
			<h2 id="cover-picker-title" tabindex="-1" bind:this={heading}>{t('cover.title')}</h2>
			<div class="tabs">
				{#each TABS as id (id)}
					<button type="button" aria-pressed={tab === id} onclick={() => (tab = id)}>{t('cover.' + id)}</button>
				{/each}
			</div>
			<button class="close" type="button" title={t('common.close')} onclick={closePicker}><Icon name="close" /><span class="visually-hidden">{t('common.close')}</span></button>
		</div>
		<div class="picker-body">
			{#if tab === 'gallery'}
				<p class="hint">{t('cover.galleryHint')}</p>
				{#if galleryError}
					<p class="alert alert-error" role="alert">{t('cover.galleryError')}</p>
				{:else if !gallery}
					<p class="muted" role="status">{t('cover.galleryLoading')}</p>
				{:else if !gallery.length}
					<p class="muted">{t('cover.galleryEmpty')}</p>
				{:else}
					<ul class="list-plain grid">
						{#each gallery as g (g.id)}
							<li>
								<button class="choice-tile" type="button" aria-pressed={cover?.image === g.id} onclick={() => choose({ image: g.id, color: null, y: COVER_Y_DEFAULT })}>
									<img src={g.url} alt="" loading="lazy" />
									<span>{g.alt}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{:else if tab === 'colors'}
				<p class="hint">{t('cover.colorsHint')}</p>
				<ul class="list-plain grid colors">
					{#each Object.entries(COVER_COLORS) as [name, hex] (name)}
						<li>
							<button class="choice-tile" type="button" aria-pressed={cover?.color === name} onclick={() => choose({ image: null, color: name, y: COVER_Y_DEFAULT })}>
								<span class="swatch" style:background-color={hex}></span>
								<span>{t('cover.colorNames.' + name)}</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="field">
					<label for="cover-file">{t('cover.uploadLabel')}</label>
					<input
						id="cover-file"
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif"
						aria-describedby="cover-file-hint"
						disabled={uploading}
						onchange={(e) => {
							const f = e.currentTarget.files?.[0];
							e.currentTarget.value = '';
							if (f) upload(f);
						}}
					/>
					<span id="cover-file-hint" class="hint">{t('cover.uploadHint')}</span>
				</div>
				{#if uploading}<p class="muted" role="status">{t('cover.uploading')}</p>{/if}
				{#if uploadError}<p class="alert alert-error" role="alert">{t(uploadError)}</p>{/if}
			{/if}
		</div>
	</section>
{/if}

<style>
	.add-row {
		margin: 0.5rem 0 0;
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.5rem;
		padding: 0 0.7rem;
		border: 1px dashed var(--c-border);
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: 600;
		cursor: pointer;
	}
	.add:hover,
	.add[aria-expanded='true'] {
		color: var(--c-text);
		border-color: var(--c-control);
		background: var(--c-surface);
	}
	.tools {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.tool {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface);
		color: var(--c-text);
		font-size: var(--fs-base);
		cursor: pointer;
	}
	.tool:hover,
	.tool[aria-expanded='true'] {
		background: var(--c-surface2);
	}
	.slider {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		cursor: grab;
		touch-action: none;
	}
	.slider:active {
		cursor: grabbing;
	}
	/* Il contorno del focus dentro la fascia: fuori verrebbe tagliato. */
	.slider:focus-visible {
		outline-offset: -5px;
	}
	.slider .hint {
		padding: 0.3rem 0.7rem;
		background: rgb(0 0 0 / 0.7);
		color: #fff;
		font-size: var(--fs-sm);
		font-weight: 600;
		pointer-events: none;
	}
	.done {
		position: absolute;
		right: 0.5rem;
		bottom: 0.5rem;
	}
	.moving img {
		user-select: none;
	}
	.picker {
		margin: 0.5rem 0 0;
		max-width: 40rem;
		background: var(--c-surface);
		border: 1px solid var(--c-control);
		border-radius: var(--radius);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.2);
	}
	.picker-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.25rem 0 0.9rem;
		border-bottom: 1px solid var(--c-border);
	}
	.picker-head h2 {
		margin: 0;
		font-size: var(--fs-base);
	}
	.picker-head h2:focus {
		outline: none;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		margin-left: auto;
		font-size: var(--fs-sm);
	}
	/* Come le linguette dell'albero: quella scelta è sottolineata. */
	.tabs button {
		min-height: 2.75rem;
		padding: 0 0.6rem;
		border: 0;
		border-bottom: 3px solid transparent;
		border-radius: 0;
		background: none;
		color: var(--c-muted);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.tabs button:hover {
		color: var(--c-text);
		border-bottom-color: var(--c-control);
	}
	.tabs button[aria-pressed='true'] {
		color: var(--c-text);
		font-weight: 700;
		border-bottom-color: var(--c-primary);
	}
	.close {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		cursor: pointer;
	}
	.close:hover {
		color: var(--c-text);
		background: var(--c-surface2);
	}
	.picker-body {
		padding: 0.75rem 0.9rem 0.9rem;
		max-height: 22rem;
		overflow-y: auto;
	}
	.picker-body > .hint {
		margin: 0 0 0.6rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.6rem;
	}
	.grid.colors {
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
	}
	.choice-tile {
		display: block;
		width: 100%;
		padding: 0;
		border: 2px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface);
		color: var(--c-text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	.choice-tile:hover {
		border-color: var(--c-control);
	}
	.choice-tile[aria-pressed='true'] {
		border-color: var(--c-primary);
	}
	.choice-tile img,
	.swatch {
		display: block;
		width: 100%;
		height: 5rem;
		object-fit: cover;
	}
	.swatch {
		height: 3.5rem;
	}
	.choice-tile > span:last-child {
		display: block;
		padding: 0.2rem 0.5rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.picker-body .field {
		margin-bottom: 0.5rem;
	}
</style>
