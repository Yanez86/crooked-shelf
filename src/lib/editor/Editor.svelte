<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { Editor } from '@tiptap/core';
	import {
		blockAt,
		buildExtensions,
		reroll,
		rollAt,
		selectedBlocks,
		tableAt,
		unlinkRoll,
		type RollAnswer,
		type RollChoice,
		type RollDeps,
		type SuggestItem,
		type RuleItem
	} from './extensions.ts';
	import { dieLabel, newRollTable, problemMessage, readRollTable } from '../content/rollTables.ts';
	import { RULE_KINDS } from '../rules/index.ts';
	import { getT } from '../i18n/index.ts';
	import type { DocNode } from '../content/types.ts';
	import Icon from '../components/Icon.svelte';
	import PromptDialog from '../components/PromptDialog.svelte';

	let {
		content,
		canSecret = false,
		name = 'content',
		labelId,
		describedBy,
		inline = false
	}: {
		content: DocNode;
		canSecret?: boolean;
		name?: string;
		labelId: string;
		describedBy?: string;
		/** Modifica sul posto: niente riquadro, il testo resta com'è nella pagina e i blocchi si illuminano. */
		inline?: boolean;
	} = $props();

	const t = getT();

	let host: HTMLDivElement;
	let toolbar: HTMLDivElement;
	let editor = $state.raw<Editor | null>(null);
	// Aumenta a ogni modifica, così la barra si aggiorna (pulsanti attivi).
	let tick = $state(0);
	// Il contenuto iniziale serve solo all'avvio: poi comanda l'editor.
	const initial = untrack(() => content);
	let json = $state(JSON.stringify(initial));

	async function suggest(q: string, signal: AbortSignal): Promise<SuggestItem[]> {
		const r = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal });
		return r.ok ? r.json() : [];
	}

	async function searchRules(q: string, signal: AbortSignal): Promise<RuleItem[]> {
		const r = await fetch(`/api/rules/search?q=${encodeURIComponent(q)}`, { signal });
		return r.ok ? r.json() : [];
	}

	async function searchRollTables(q: string, signal: AbortSignal): Promise<RollChoice[]> {
		const r = await fetch(`/api/roll-tables?q=${encodeURIComponent(q)}`, { signal });
		return r.ok ? r.json() : [];
	}

	// Tabelle di tiro: il server tira (vedi server/rollTables.ts), il messaggio sotto la barra dice cos'è uscito.
	const rollDeps: RollDeps = {
		async roll(page, block): Promise<RollAnswer> {
			const r = await fetch(`/api/roll-tables/${page}/${block}`, { method: 'POST' }).catch(() => null);
			if (!r || (!r.ok && r.status !== 422)) return null;
			const data = await r.json().catch(() => null);
			return data ? { ...data, ok: r.ok } : null;
		},
		notify(a) {
			if (!a) status = t('rollTables.gone');
			else if (!a.ok) status = t('rollTables.cant', { name: a.name }) + ' ' + t(...problemMessage(a.problem));
			else status = t(a.content.length ? 'rollTables.rolled' : 'rollTables.emptyRow', { name: a.name, value: a.value, die: a.die });
		}
	};

	onMount(() => {
		editor = new Editor({
			element: host,
			content: initial,
			extensions: buildExtensions({
				canSecret,
				suggest,
				searchRules,
				searchRollTables,
				rollDeps,
				labels: {
					note: t('editor.note'),
					tip: t('editor.tip'),
					warning: t('editor.warning'),
					secret: t('editor.secret'),
					suggestions: t('editor.suggestions'),
					createLink: t('editor.createLink'),
					noResults: t('editor.noResults'),
					rules: t('rules.suggestions'),
					kinds: Object.fromEntries(RULE_KINDS.map((k) => [k, t('rules.kinds.' + k)])),
					rollTables: t('rollTables.suggestions')
				}
			}),
			editorProps: {
				// Un clic su un collegamento dentro l'editor non deve uscire dalla pagina (si perderebbe il lavoro).
				handleDOMEvents: {
					click: (_view, e) => {
						if ((e.target as HTMLElement).closest('a')) e.preventDefault();
						return false;
					}
				},
				attributes: {
					class: 'prose editor-content',
					role: 'textbox',
					'aria-multiline': 'true',
					'aria-labelledby': labelId,
					...(describedBy ? { 'aria-describedby': describedBy } : {}),
					spellcheck: 'true'
				}
			},
			onTransaction: () => tick++,
			onUpdate: ({ editor }) => {
				json = JSON.stringify(editor.getJSON());
				hovered = null;
			}
		});
	});

	onDestroy(() => editor?.destroy());

	function active(n: string, attrs?: Record<string, unknown>) {
		void tick;
		return editor?.isActive(n, attrs) ?? false;
	}
	function can(fn: (e: Editor) => boolean) {
		void tick;
		return editor ? fn(editor) : false;
	}
	const chain = () => editor!.chain().focus();

	// Il blocco dove si sta scrivendo è oscurato (per il pulsante della barra).
	const hiddenHere = $derived.by(() => {
		void tick;
		return !!editor && selectedBlocks(editor.state).some((b) => b.node.attrs.visibility);
	});

	// Il cursore è su un tiro: si può ritirare o fissare.
	const rollHere = $derived.by(() => {
		void tick;
		return !!editor && !!rollAt(editor.state);
	});

	// La tabella dove sta il cursore, e se è di tiro com'è messa (pronta da tirare, o cosa manca).
	const tableHere = $derived.by(() => {
		void tick;
		const node = editor ? tableAt(editor.state) : null;
		if (!node) return null;
		const roll = node.attrs.roll === true;
		if (!roll) return { roll, status: '' };
		const r = readRollTable(node.toJSON());
		if (r.ok) return { roll, status: t('rollTables.ready', { name: r.table.name, die: dieLabel(r.table.die), n: r.table.rows.length }) };
		return { roll, status: t(...problemMessage(r.problem)) };
	});

	function insertRollTable() {
		chain().insertContent(newRollTable(t('rollTables.newName'))).run();
	}

	const blockType = $derived.by(() => {
		void tick;
		if (!editor) return 'paragraph';
		for (const l of [2, 3, 4]) if (editor.isActive('heading', { level: l })) return `h${l}`;
		if (editor.isActive('codeBlock')) return 'code';
		return 'paragraph';
	});

	function setBlock(v: string) {
		const c = chain();
		if (v === 'paragraph') c.setParagraph().run();
		else if (v === 'code') c.setCodeBlock().run();
		else c.setHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 }).run();
	}

	let asking = $state.raw<{ label: string; value: string; done: (answer: string | null) => void } | null>(null);
	const ask = (label: string, value: string) => new Promise<string | null>((done) => (asking = { label, value, done }));

	async function setLink() {
		const prev = editor!.getAttributes('link').href ?? 'https://';
		const url = await ask(t('editor.linkPrompt'), prev);
		if (url === null) return;
		if (url.trim() === '') chain().extendMarkRange('link').unsetLink().run();
		else chain().extendMarkRange('link').setLink({ href: url.trim() }).run();
	}

	let showTips = $state(false);
	// Scorciatoie che l'editor trasforma mentre si scrive: cosa scrivere → risultato.
	const tips = $derived.by(() => {
		const x = t('editor.tipSample');
		return [
			['## ', t('editor.heading', { n: 2 })],
			['### ', t('editor.heading', { n: 3 })],
			[`**${x}**`, t('editor.bold')],
			[`*${x}*`, t('editor.italic')],
			[`~~${x}~~`, t('editor.strike')],
			[`\`${x}\``, t('editor.code')],
			['- ', t('editor.bulletList')],
			['1. ', t('editor.orderedList')],
			['> ', t('editor.quote')],
			['```', t('editor.codeBlock')],
			['---', t('editor.rule')],
			['[[', t('editor.wikiLinkHint')],
			['@', t('editor.ruleHint')],
			['/', t('rollTables.hint')]
		];
	});

	let fileInput: HTMLInputElement;
	let status = $state('');

	async function uploadImage(file: File) {
		status = t('editor.uploading');
		const body = new FormData();
		body.append('file', file);
		const r = await fetch('/api/files', { method: 'POST', body }).catch(() => null);
		const data = r ? await r.json().catch(() => ({})) : {};
		if (!r?.ok || !data.url) {
			status = t(data.error ?? 'errors.generic');
			return;
		}
		const alt = (await ask(t('editor.altPrompt'), '')) ?? '';
		chain().setImage({ src: data.url, alt: alt.trim() }).run();
		status = t('editor.uploaded');
	}

	async function editAlt() {
		const cur = editor!.getAttributes('image').alt ?? '';
		const alt = await ask(t('editor.altPrompt'), cur);
		if (alt !== null) chain().updateAttributes('image', { alt: alt.trim() }).run();
	}

	// Il blocco sotto il mouse, con il punto dov'è il suo angolo in alto a destra.
	let hovered = $state.raw<{ el: HTMLElement; top: number; left: number } | null>(null);
	// Il menu del «+» sul blocco: aggiunge un blocco di testo o un'immagine dopo di lui.
	let adding = $state(false);

	function trackBlock(e: MouseEvent) {
		// Il nome sopra i blocchi oscurati non è un blocco.
		const blocks = [...(editor?.view.dom.children ?? [])].filter((b) => !b.classList.contains('hidden-label')) as HTMLElement[];
		const el = blocks.find((b) => b.contains(e.target as Node));
		// Tra un blocco e l'altro, o sui pulsanti, resta quello di prima.
		if (!el || el === hovered?.el) return;
		const box = el.getBoundingClientRect();
		const area = (e.currentTarget as HTMLElement).getBoundingClientRect();
		hovered = { el, top: box.top - area.top, left: box.right - area.left };
		adding = false;
	}

	/** Dove comincia il blocco sotto il mouse (vedi blockAt). */
	const hoveredPos = () => editor!.view.posAtDOM(hovered!.el, 0);

	const hoveredHidden = $derived.by(() => {
		void tick;
		return !!editor && !!hovered && !!blockAt(editor.state.doc, hoveredPos())?.node.attrs.visibility;
	});

	function addText() {
		adding = false;
		chain().insertBlockAfter(hoveredPos()).run();
	}

	function addImage() {
		adding = false;
		// Il cursore va in un paragrafo nuovo dopo il blocco: l'immagine caricata prende il suo posto.
		chain().insertBlockAfter(hoveredPos()).run();
		fileInput.click();
	}

	/** Elimina il blocco di primo livello che contiene pos (un'immagine o una linea non hanno interno: pos è subito prima). */
	function deleteBlock(pos: number) {
		const at = editor!.state.doc.resolve(pos);
		const from = at.depth ? at.before(1) : pos;
		const to = at.depth ? at.after(1) : pos + (at.nodeAfter?.nodeSize ?? 0);
		chain().deleteRange({ from, to }).run();
	}

	function wikiLink() {
		chain().insertContent('[[').run();
	}

	function ruleRef() {
		chain().insertContent(' @').run();
	}

	// Barra degli strumenti: frecce sinistra/destra tra i comandi, Tab per uscire.
	function toolbarKeys(e: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
		if ((e.target as HTMLElement).tagName === 'SELECT') return;
		const items = [...toolbar.querySelectorAll<HTMLElement>('button:not([disabled]), select')];
		const i = items.indexOf(document.activeElement as HTMLElement);
		const next =
			e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
		items.forEach((el, j) => (el.tabIndex = j === next ? 0 : -1));
		items[next]?.focus();
		e.preventDefault();
	}

	// Un clic sui pulsanti non toglie il focus all'editor: selezione e testo restano dove sono
	// (altrimenti i primi tasti premuti subito dopo finiscono sul pulsante). La tendina invece deve aprirsi.
	function keepFocus(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('button')) e.preventDefault();
	}

	$effect(() => {
		void tick;
		if (!toolbar) return;
		// Un solo comando raggiungibile con Tab (quello attivo o il primo).
		const items = [...toolbar.querySelectorAll<HTMLElement>('button:not([disabled]), select')];
		if (!items.some((el) => el.tabIndex === 0)) items.forEach((el, j) => (el.tabIndex = j === 0 ? 0 : -1));
	});
</script>

<!-- Pulsante della barra: solo l'icona, il nome nel suggerimento e per chi usa un lettore di schermo. -->
{#snippet btn(icon: string, label: string, onclick: () => void, pressed?: boolean, disabled = false)}
	<button type="button" aria-pressed={pressed} title={label} {onclick} {disabled}>
		<Icon name={icon} /><span class="visually-hidden">{label}</span>
	</button>
{/snippet}

<div class="editor" class:inline>
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="toolbar" role="toolbar" aria-label={t('editor.toolbar')} aria-controls="{labelId}-area" bind:this={toolbar} onkeydown={toolbarKeys} onmousedown={keepFocus}>
		{@render btn('undo', t('editor.undo'), () => chain().undo().run(), undefined, !can((e) => e.can().undo()))}
		{@render btn('redo', t('editor.redo'), () => chain().redo().run(), undefined, !can((e) => e.can().redo()))}
		<span class="sep" aria-hidden="true"></span>
		<select aria-label={t('editor.blockType')} title={t('editor.blockType')} value={blockType} onchange={(e) => setBlock(e.currentTarget.value)} disabled={!editor}>
			<option value="paragraph">¶</option>
			<option value="h2">H2</option>
			<option value="h3">H3</option>
			<option value="h4">H4</option>
			<option value="code">{'{ }'}</option>
		</select>
		<span class="sep" aria-hidden="true"></span>
		{@render btn('bold', t('editor.bold') + ' (Ctrl+B)', () => chain().toggleBold().run(), active('bold'))}
		{@render btn('italic', t('editor.italic') + ' (Ctrl+I)', () => chain().toggleItalic().run(), active('italic'))}
		{@render btn('underline', t('editor.underline') + ' (Ctrl+U)', () => chain().toggleUnderline().run(), active('underline'))}
		{@render btn('strike', t('editor.strike'), () => chain().toggleStrike().run(), active('strike'))}
		{@render btn('code', t('editor.code'), () => chain().toggleCode().run(), active('code'))}
		<span class="sep" aria-hidden="true"></span>
		{@render btn('link', t('editor.link'), setLink, active('link'))}
		{@render btn('wikiLink', t('editor.wikiLinkHint'), wikiLink)}
		{@render btn('book', t('editor.ruleHint'), ruleRef)}
		<span class="sep" aria-hidden="true"></span>
		{@render btn('listBullet', t('editor.bulletList'), () => chain().toggleBulletList().run(), active('bulletList'))}
		{@render btn('listNumber', t('editor.orderedList'), () => chain().toggleOrderedList().run(), active('orderedList'))}
		{@render btn('quote', t('editor.quote'), () => chain().toggleBlockquote().run(), active('blockquote'))}
		<span class="sep" aria-hidden="true"></span>
		{@render btn('note', t('editor.note'), () => chain().toggleWrap('callout', { kind: 'note' }).run(), active('callout', { kind: 'note' }))}
		{@render btn('tip', t('editor.tip'), () => chain().toggleWrap('callout', { kind: 'tip' }).run(), active('callout', { kind: 'tip' }))}
		{@render btn('warning', t('editor.warning'), () => chain().toggleWrap('callout', { kind: 'warning' }).run(), active('callout', { kind: 'warning' }))}
		{#if canSecret}
			{@render btn('lock', t('editor.secret'), () => chain().toggleHidden().run(), hiddenHere)}
		{/if}
		<span class="sep" aria-hidden="true"></span>
		{@render btn('table', t('editor.table'), () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), undefined, active('table'))}
		{#if canSecret}
			{@render btn('dice', t('rollTables.insert'), insertRollTable, undefined, active('table'))}
		{/if}
		{@render btn('rule', t('editor.rule'), () => chain().setHorizontalRule().run())}
		{@render btn('image', t('editor.image'), () => fileInput.click())}
		{#if active('image')}
			<button type="button" title={t('editor.altEdit')} onclick={editAlt}>Alt</button>
		{/if}
		<!-- Il blocco dove si sta scrivendo: per chi non ha il mouse, che non vede il pulsante sul blocco. -->
		{@render btn('trash', t('editor.deleteBlock'), () => deleteBlock(editor!.state.selection.from))}
		<span class="sep" aria-hidden="true"></span>
		<button type="button" title={t('editor.tips')} aria-expanded={showTips} aria-controls="{labelId}-tips" onclick={() => (showTips = !showTips)}>
			<Icon name="markdown" /><span class="visually-hidden">{t('editor.tips')}</span>
		</button>
	</div>

	{#if showTips}
		<section class="tips" id="{labelId}-tips" aria-label={t('editor.tips')}>
			<p class="hint">{t('editor.tipsIntro')}</p>
			<dl>
				{#each tips as [code, what] (code)}
					<dt><code>{code}</code></dt>
					<dd>{what}</dd>
				{/each}
			</dl>
		</section>
	{/if}

	{#if active('table')}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions (mousedown solo per non togliere il focus all'editor; i comandi sono i pulsanti) -->
		<div class="toolbar table-tools" role="group" aria-label={t('editor.tableTools')} onmousedown={keepFocus}>
			<button type="button" onclick={() => chain().addRowAfter().run()}><Icon name="plus" />{t('editor.addRow')}</button>
			<button type="button" onclick={() => chain().addColumnAfter().run()}><Icon name="plus" />{t('editor.addCol')}</button>
			<button type="button" onclick={() => chain().deleteRow().run()}><Icon name="minus" />{t('editor.delRow')}</button>
			<button type="button" onclick={() => chain().deleteColumn().run()}><Icon name="minus" />{t('editor.delCol')}</button>
			<button type="button" onclick={() => chain().toggleHeaderRow().run()}>{t('editor.headerRow')}</button>
			{#if canSecret && tableHere}
				<button type="button" aria-pressed={tableHere.roll} title={t('rollTables.toggleHint')} onclick={() => chain().updateAttributes('table', { roll: !tableHere.roll }).run()}>
					<Icon name="dice" />{t('rollTables.toggle')}
				</button>
			{/if}
			<button type="button" class="danger" onclick={() => chain().deleteTable().run()}>{t('editor.delTable')}</button>
		</div>
		{#if tableHere?.roll}
			<p class="roll-status">{tableHere.status}</p>
		{/if}
	{/if}

	{#if rollHere}
		<!-- Il cursore è su un tiro: un altro risultato dalla stessa tabella, o testo normale per sempre. -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions (mousedown solo per non togliere il focus all'editor; i comandi sono i pulsanti) -->
		<div class="toolbar table-tools" role="group" aria-label={t('rollTables.tools')} onmousedown={keepFocus}>
			<button type="button" title={t('rollTables.reroll')} onclick={() => reroll(editor!, rollDeps)}><Icon name="dice" />{t('rollTables.rerollShort')}</button>
			<button type="button" title={t('rollTables.unlink')} onclick={() => unlinkRoll(editor!)}><Icon name="check" />{t('rollTables.unlinkShort')}</button>
		</div>
	{/if}

	{#if asking}
		<PromptDialog
			label={asking.label}
			value={asking.value}
			ondone={(answer) => {
				asking?.done(answer);
				asking = null;
			}}
		/>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		accept="image/png,image/jpeg,image/webp,image/gif"
		hidden
		onchange={(e) => {
			const f = e.currentTarget.files?.[0];
			if (f) uploadImage(f);
			e.currentTarget.value = '';
		}}
	/>
	<p class="upload-status" role="status">{status}</p>
	<!-- svelte-ignore a11y_no_static_element_interactions (il mouse mostra solo il pulsante; da tastiera c'è quello nella barra) -->
	<div
		class="area"
		id="{labelId}-area"
		bind:this={host}
		onmousemove={trackBlock}
		onmouseleave={() => {
			hovered = null;
			adding = false;
		}}
	>
		{#if hovered}
			<!-- Sull'angolo del blocco: aggiungi dopo, oscura o mostra (il Master), elimina. -->
			<div class="block-tools" style:top="{hovered.top}px" style:left="{hovered.left}px">
				<button
					type="button"
					class="block-add"
					title={t('editor.addBlock')}
					tabindex="-1"
					aria-expanded={adding}
					onmousedown={(e) => e.preventDefault()}
					onclick={() => (adding = !adding)}
				>
					<Icon name="plus" /><span class="visually-hidden">{t('editor.addBlock')}</span>
				</button>
				{#if canSecret}
					{@const label = hoveredHidden ? t('editor.showBlock') : t('editor.hideBlock')}
					<button
						type="button"
						class="block-hide"
						title={label}
						tabindex="-1"
						aria-pressed={hoveredHidden}
						onmousedown={(e) => e.preventDefault()}
						onclick={() => chain().toggleHidden(hoveredPos()).run()}
					>
						<Icon name={hoveredHidden ? 'eye' : 'eyeOff'} /><span class="visually-hidden">{label}</span>
					</button>
				{/if}
				<button
					type="button"
					class="block-delete"
					title={t('editor.deleteBlock')}
					tabindex="-1"
					onmousedown={(e) => e.preventDefault()}
					onclick={() => deleteBlock(hoveredPos())}
				>
					<Icon name="trash" /><span class="visually-hidden">{t('editor.deleteBlock')}</span>
				</button>
				{#if adding}
					<div class="block-menu" role="group" aria-label={t('editor.addBlock')}>
						<button type="button" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={addText}><Icon name="doc" />{t('editor.addText')}</button>
						<button type="button" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={addImage}><Icon name="image" />{t('editor.image')}</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
	<input type="hidden" {name} value={json} />
	<noscript><p class="alert alert-error">{t('editor.noscript')}</p></noscript>
</div>

<style>
	.editor {
		border: 2px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface);
	}
	.editor:focus-within {
		outline: var(--focus-width) solid var(--c-focus);
		outline-offset: 2px;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: center;
		padding: 0.4rem;
		border-bottom: 1px solid var(--c-border);
		background: var(--c-surface2);
		position: sticky;
		top: var(--sticky-top);
		z-index: 2;
	}
	.table-tools {
		position: static;
	}
	.toolbar button,
	.toolbar select {
		font: inherit;
		font-size: var(--fs-field);
		min-height: 2.5rem;
		min-width: 2.5rem;
		padding: 0.2rem 0.55rem;
		border: 1px solid var(--c-control);
		border-radius: var(--radius);
		background-color: var(--c-surface);
		color: var(--c-text);
		cursor: pointer;
	}
	/* Spazio per la freccia disegnata in app.css. */
	.toolbar select {
		padding-right: 1.75rem;
	}
	/* I pulsanti sono raggruppati dai separatori: il bordo compare solo al passaggio. */
	.toolbar button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		border-color: transparent;
		background: transparent;
	}
	.toolbar button:not(:disabled):hover {
		background: var(--c-surface);
		border-color: var(--c-border);
	}
	.toolbar button[aria-pressed='true'] {
		background: var(--c-primary);
		border-color: var(--c-primary);
		color: var(--c-on-primary);
	}
	.toolbar button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.toolbar .danger {
		color: var(--c-danger);
		border-color: var(--c-danger);
	}
	.upload-status:empty {
		display: none;
	}
	.upload-status {
		margin: 0;
		padding: 0.3rem 0.75rem;
		font-size: var(--fs-sm);
		border-bottom: 1px solid var(--c-border);
	}
	.sep {
		width: 1px;
		align-self: stretch;
		background: var(--c-border);
		margin: 0 0.2rem;
	}
	.tips {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--c-border);
		background: var(--c-surface2);
		font-size: var(--fs-sm);
	}
	.tips p {
		margin: 0 0 0.5rem;
	}
	.tips dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 1rem;
		margin: 0;
	}
	.tips dd {
		margin: 0;
	}
	.area {
		position: relative;
	}
	/* Sull'angolo del blocco: non coprono il testo e ci si arriva senza uscire dal blocco. Il cestino resta sull'angolo. */
	.block-tools {
		position: absolute;
		z-index: 1;
		display: flex;
		gap: 0.25rem;
		transform: translate(calc(-100% + 0.875rem), -50%);
	}
	.block-tools > button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface);
		color: var(--c-text);
		cursor: pointer;
	}
	.block-tools > button:hover,
	.block-tools > button[aria-expanded='true'] {
		background: var(--c-text);
		color: var(--c-surface);
	}
	.block-tools > .block-hide[aria-pressed='true'] {
		border-color: var(--c-secret-border);
	}
	.block-tools > .block-delete {
		border-color: var(--c-danger);
		color: var(--c-danger);
	}
	.block-tools > .block-delete:hover {
		background: var(--c-danger);
		color: var(--c-surface);
	}
	.block-menu {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		display: flex;
		flex-direction: column;
		min-width: 9rem;
		padding: 0.25rem;
		border: 2px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
	}
	.block-menu button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.25rem;
		padding: 0.25rem 0.6rem;
		border: 0;
		border-radius: var(--radius);
		background: transparent;
		color: var(--c-text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	.block-menu button:hover {
		background: var(--c-primary);
		color: var(--c-on-primary);
	}
	.area :global(.editor-content) {
		min-height: 18rem;
		padding: 1rem 1.25rem;
		max-width: none;
	}
	.area :global(.editor-content:focus) {
		outline: none;
	}
	.area :global(.editor-content > :first-child) {
		margin-top: 0;
	}
	.area :global(aside[data-label]::before) {
		content: attr(data-label);
		display: block;
		font-weight: 700;
		margin: 0.25rem 0;
	}
	/*
	 * Blocchi oscurati: i colori del segreto nella pagina, il bordo a sinistra e, sopra il primo di quelli di fila,
	 * il lucchetto col nome (non solo il colore). Uno dopo l'altro sembrano un riquadro solo.
	 */
	.area :global(.editor-content > [data-visibility]),
	.inline .area :global(.editor-content > [data-visibility]:hover),
	.inline .area :global(.editor-content.ProseMirror-focused > [data-visibility].has-focus) {
		margin-top: 0;
		margin-bottom: 0;
		padding: 0.5rem 1rem;
		background: var(--c-secret-bg);
		color: var(--c-secret-text);
		border-left: 6px solid var(--c-secret-border);
	}
	.area :global(.editor-content > [data-visibility] + :not([data-visibility])) {
		margin-top: 1.25rem;
	}
	.area :global(.editor-content > img[data-visibility]) {
		box-sizing: border-box;
		outline: 2px dashed var(--c-secret-border);
		outline-offset: -2px;
	}
	.area :global(.hidden-label) {
		display: flex;
		align-items: center;
		gap: 0.35em;
		margin: 1.25rem 0 0;
		padding: 0.5rem 1rem 0;
		background: var(--c-secret-bg);
		color: var(--c-secret-text);
		border-left: 6px solid var(--c-secret-border);
		font-weight: 700;
		user-select: none;
	}
	.area :global(.editor-content > .hidden-label:first-child) {
		margin-top: 0;
	}
	.area :global(.hidden-label::before) {
		content: '';
		width: 1.1em;
		height: 1.1em;
		flex: none;
		background: currentColor;
		-webkit-mask: var(--icon-lock) center / contain no-repeat;
		mask: var(--icon-lock) center / contain no-repeat;
		forced-color-adjust: none;
	}
	@media (forced-colors: active) {
		.area :global(.editor-content > [data-visibility]),
		.area :global(.hidden-label) {
			border-left: 6px solid CanvasText;
		}
	}
	.area :global(.wikilink) {
		cursor: text;
	}
	.area :global(img) {
		max-width: 100%;
		height: auto;
	}
	.area :global(.ProseMirror-selectednode) {
		outline: 2px solid var(--c-focus);
	}
	.area :global(.selectedCell) {
		background: var(--c-surface2);
	}
	.area :global(.suggestion) {
		background: var(--c-surface2);
		border-radius: 2px;
	}
	:global(.suggest-popup) {
		position: absolute;
		z-index: 50;
		min-width: 16rem;
		max-width: 24rem;
		background: var(--c-surface);
		color: var(--c-text);
		border: 2px solid var(--c-control);
		border-radius: var(--radius);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
		font-family: var(--font-body);
	}
	:global(.suggest-popup ul) {
		list-style: none;
		margin: 0;
		padding: 0.25rem;
	}
	:global(.suggest-popup li) {
		padding: 0.45rem 0.6rem;
		border-radius: var(--radius);
		cursor: pointer;
	}
	:global(.suggest-popup li[aria-selected='true']) {
		background: var(--c-primary);
		color: var(--c-on-primary);
	}
	:global(.suggest-popup .detail) {
		display: block;
		font-size: var(--fs-sm);
		opacity: 0.85;
	}
	.area :global(.ruleref) {
		border-bottom: 2px dotted currentColor;
	}
	/* Un tiro su una tabella: nell'editor si riconosce (dado e sottolineatura), nella pagina è testo normale. */
	.area :global(.roll-result) {
		border-bottom: 2px dashed currentColor;
	}
	.area :global(.roll-result::before) {
		content: '';
		display: inline-block;
		width: 1em;
		height: 1em;
		margin-right: 0.2em;
		vertical-align: -0.15em;
		background: currentColor;
		-webkit-mask: var(--icon-dice) center / contain no-repeat;
		mask: var(--icon-dice) center / contain no-repeat;
		forced-color-adjust: none;
	}
	.area :global(table[data-roll-table] tr:first-child > *:first-child) {
		width: 4.5rem;
	}
	/* Sotto gli strumenti della tabella di tiro: pronta da tirare, o che cosa manca. */
	.roll-status {
		margin: 0;
		padding: 0.3rem 0.75rem;
		font-size: var(--fs-sm);
		border-bottom: 1px solid var(--c-border);
	}
	.inline .roll-status {
		margin: -0.5rem 0 1rem;
		padding: 0;
		border: 0;
	}
	.area :global(.ruleref::before) {
		content: '';
		display: inline-block;
		width: 1.1em;
		height: 1.1em;
		margin-right: 0.25em;
		vertical-align: -0.2em;
		background: currentColor;
		-webkit-mask: var(--icon-book) center / contain no-repeat;
		mask: var(--icon-book) center / contain no-repeat;
		forced-color-adjust: none;
	}
	:global(.suggest-popup li.create) {
		font-style: italic;
	}
	:global(.suggest-popup li.empty) {
		color: var(--c-muted);
		cursor: default;
	}

	/* --- Modifica sul posto --- */
	.inline {
		border: 0;
		background: none;
	}
	.inline:focus-within {
		outline: none;
	}
	/* Una riga sola: quello che non ci sta si raggiunge scorrendo. */
	.inline .toolbar {
		flex-wrap: nowrap;
		overflow-x: auto;
		scrollbar-width: thin;
		white-space: nowrap;
		gap: 0.1rem;
		padding: 0.2rem;
		margin-bottom: 1rem;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
	}
	.inline .toolbar > * {
		flex-shrink: 0;
	}
	.inline .toolbar button,
	.inline .toolbar select {
		min-height: 2rem;
		min-width: 2rem;
		padding: 0.1rem 0.4rem;
	}
	.inline .toolbar select {
		padding-right: 1.75rem;
	}
	.inline .tips {
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		margin-bottom: 1rem;
	}
	.inline .area :global(.editor-content) {
		min-height: 12rem;
		padding: 0;
		max-width: var(--measure);
	}
	/* Ogni blocco si illumina: si vede cosa si può toccare. Quello in cui si scrive di più. */
	.inline .area :global(.editor-content > *) {
		border-radius: var(--radius);
		outline: 1px dashed var(--c-border);
		outline-offset: 0.35rem;
		transition: background-color 0.15s, outline-color 0.15s;
	}
	.inline .area :global(.editor-content > *:hover) {
		outline-color: var(--c-control);
		background: var(--c-surface);
	}
	.inline .area :global(.editor-content.ProseMirror-focused > .has-focus) {
		outline: 2px solid var(--c-primary);
		background: var(--c-surface);
	}
	/* Col dito non c'è il passaggio del mouse, e una pagina intera di tratteggi si legge male: si vede solo il blocco in cui si scrive. */
	@media (max-width: 48rem) {
		.inline .area :global(.editor-content > *) {
			outline-color: transparent;
		}
	}
	@media (max-width: 48rem), (pointer: coarse) {
		.inline .toolbar button,
		.inline .toolbar select {
			min-height: 2.5rem;
			min-width: 2.5rem;
		}
	}
</style>
