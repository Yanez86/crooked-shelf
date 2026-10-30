<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { Editor } from '@tiptap/core';
	import { buildExtensions, type SuggestItem, type RuleItem } from './extensions.ts';
	import { RULE_KINDS } from '../rules/index.ts';
	import { getT } from '../i18n/index.ts';
	import type { DocNode } from '../content/types.ts';

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

	onMount(() => {
		editor = new Editor({
			element: host,
			content: initial,
			extensions: buildExtensions({
				canSecret,
				suggest,
				searchRules,
				labels: {
					note: t('editor.note'),
					tip: t('editor.tip'),
					warning: t('editor.warning'),
					secret: t('editor.secret'),
					suggestions: t('editor.suggestions'),
					createLink: t('editor.createLink'),
					noResults: t('editor.noResults'),
					rules: t('rules.suggestions'),
					kinds: Object.fromEntries(RULE_KINDS.map((k) => [k, t('rules.kinds.' + k)]))
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
			onUpdate: ({ editor }) => (json = JSON.stringify(editor.getJSON()))
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

	function setLink() {
		const prev = editor!.getAttributes('link').href ?? 'https://';
		const url = window.prompt(t('editor.linkPrompt'), prev);
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
			['@', t('editor.ruleHint')]
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
		const alt = window.prompt(t('editor.altPrompt'), '') ?? '';
		chain().setImage({ src: data.url, alt: alt.trim() }).run();
		status = t('editor.uploaded');
	}

	function editAlt() {
		const cur = editor!.getAttributes('image').alt ?? '';
		const alt = window.prompt(t('editor.altPrompt'), cur);
		if (alt !== null) chain().updateAttributes('image', { alt: alt.trim() }).run();
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

<!-- Pulsante della barra: solo il simbolo, il nome nel suggerimento e per chi usa un lettore di schermo. -->
{#snippet btn(icon: string, label: string, onclick: () => void, pressed?: boolean, disabled = false)}
	<button type="button" aria-pressed={pressed} title={label} {onclick} {disabled}>
		<span aria-hidden="true">{icon}</span><span class="visually-hidden">{label}</span>
	</button>
{/snippet}

<div class="editor" class:inline>
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="toolbar" role="toolbar" aria-label={t('editor.toolbar')} aria-controls="{labelId}-area" bind:this={toolbar} onkeydown={toolbarKeys} onmousedown={keepFocus}>
		<select aria-label={t('editor.blockType')} title={t('editor.blockType')} value={blockType} onchange={(e) => setBlock(e.currentTarget.value)} disabled={!editor}>
			<option value="paragraph">¶</option>
			<option value="h2">H2</option>
			<option value="h3">H3</option>
			<option value="h4">H4</option>
			<option value="code">{'{ }'}</option>
		</select>
		<span class="sep" aria-hidden="true"></span>
		{@render btn('B', t('editor.bold') + ' (Ctrl+B)', () => chain().toggleBold().run(), active('bold'))}
		{@render btn('I', t('editor.italic') + ' (Ctrl+I)', () => chain().toggleItalic().run(), active('italic'))}
		{@render btn('U', t('editor.underline') + ' (Ctrl+U)', () => chain().toggleUnderline().run(), active('underline'))}
		{@render btn('S', t('editor.strike'), () => chain().toggleStrike().run(), active('strike'))}
		{@render btn('</>', t('editor.code'), () => chain().toggleCode().run(), active('code'))}
		<span class="sep" aria-hidden="true"></span>
		{@render btn('🔗', t('editor.link'), setLink, active('link'))}
		{@render btn('[[ ]]', t('editor.wikiLinkHint'), wikiLink)}
		{@render btn('📖', t('editor.ruleHint'), ruleRef)}
		<span class="sep" aria-hidden="true"></span>
		{@render btn('•', t('editor.bulletList'), () => chain().toggleBulletList().run(), active('bulletList'))}
		{@render btn('1.', t('editor.orderedList'), () => chain().toggleOrderedList().run(), active('orderedList'))}
		{@render btn('❝', t('editor.quote'), () => chain().toggleBlockquote().run(), active('blockquote'))}
		<span class="sep" aria-hidden="true"></span>
		{@render btn('ℹ︎', t('editor.note'), () => chain().toggleWrap('callout', { kind: 'note' }).run(), active('callout', { kind: 'note' }))}
		{@render btn('💡', t('editor.tip'), () => chain().toggleWrap('callout', { kind: 'tip' }).run(), active('callout', { kind: 'tip' }))}
		{@render btn('⚠︎', t('editor.warning'), () => chain().toggleWrap('callout', { kind: 'warning' }).run(), active('callout', { kind: 'warning' }))}
		{#if canSecret}
			{@render btn('🔒', t('editor.secret'), () => chain().toggleWrap('secret').run(), active('secret'))}
		{/if}
		<span class="sep" aria-hidden="true"></span>
		{@render btn('▦', t('editor.table'), () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), undefined, active('table'))}
		{@render btn('―', t('editor.rule'), () => chain().setHorizontalRule().run())}
		{@render btn('🖼', t('editor.image'), () => fileInput.click())}
		{#if active('image')}
			{@render btn('Alt', t('editor.altEdit'), editAlt)}
		{/if}
		<span class="sep" aria-hidden="true"></span>
		{@render btn('↶', t('editor.undo'), () => chain().undo().run(), undefined, !can((e) => e.can().undo()))}
		{@render btn('↷', t('editor.redo'), () => chain().redo().run(), undefined, !can((e) => e.can().redo()))}
		<span class="sep" aria-hidden="true"></span>
		<button type="button" title={t('editor.tips')} aria-expanded={showTips} aria-controls="{labelId}-tips" onclick={() => (showTips = !showTips)}>
			<span aria-hidden="true">M↓</span><span class="visually-hidden">{t('editor.tips')}</span>
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
			<button type="button" onclick={() => chain().addRowAfter().run()}>+ {t('editor.addRow')}</button>
			<button type="button" onclick={() => chain().addColumnAfter().run()}>+ {t('editor.addCol')}</button>
			<button type="button" onclick={() => chain().deleteRow().run()}>− {t('editor.delRow')}</button>
			<button type="button" onclick={() => chain().deleteColumn().run()}>− {t('editor.delCol')}</button>
			<button type="button" onclick={() => chain().toggleHeaderRow().run()}>{t('editor.headerRow')}</button>
			<button type="button" class="danger" onclick={() => chain().deleteTable().run()}>{t('editor.delTable')}</button>
		</div>
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
	<div class="area" id="{labelId}-area" bind:this={host}></div>
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
		outline: 3px solid var(--c-focus);
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
		top: 0;
		z-index: 2;
	}
	.table-tools {
		position: static;
	}
	.toolbar button,
	.toolbar select {
		font: inherit;
		font-size: var(--fs-sm);
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
	.area :global(aside.secret[data-label]::before) {
		content: '🔒 ' attr(data-label);
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
</style>
