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
		describedBy
	}: {
		content: DocNode;
		canSecret?: boolean;
		name?: string;
		labelId: string;
		describedBy?: string;
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

	$effect(() => {
		void tick;
		if (!toolbar) return;
		// Un solo comando raggiungibile con Tab (quello attivo o il primo).
		const items = [...toolbar.querySelectorAll<HTMLElement>('button:not([disabled]), select')];
		if (!items.some((el) => el.tabIndex === 0)) items.forEach((el, j) => (el.tabIndex = j === 0 ? 0 : -1));
	});
</script>

<div class="editor">
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="toolbar" role="toolbar" aria-label={t('editor.toolbar')} aria-controls="{labelId}-area" bind:this={toolbar} onkeydown={toolbarKeys}>
		<select aria-label={t('editor.blockType')} value={blockType} onchange={(e) => setBlock(e.currentTarget.value)} disabled={!editor}>
			<option value="paragraph">{t('editor.paragraph')}</option>
			<option value="h2">{t('editor.heading', { n: 2 })}</option>
			<option value="h3">{t('editor.heading', { n: 3 })}</option>
			<option value="h4">{t('editor.heading', { n: 4 })}</option>
			<option value="code">{t('editor.codeBlock')}</option>
		</select>
		<span class="sep" aria-hidden="true"></span>
		<button type="button" aria-pressed={active('bold')} title="{t('editor.bold')} (Ctrl+B)" onclick={() => chain().toggleBold().run()}>
			<b aria-hidden="true">B</b><span class="visually-hidden">{t('editor.bold')}</span>
		</button>
		<button type="button" aria-pressed={active('italic')} title="{t('editor.italic')} (Ctrl+I)" onclick={() => chain().toggleItalic().run()}>
			<i aria-hidden="true">I</i><span class="visually-hidden">{t('editor.italic')}</span>
		</button>
		<button type="button" aria-pressed={active('underline')} title="{t('editor.underline')} (Ctrl+U)" onclick={() => chain().toggleUnderline().run()}>
			<u aria-hidden="true">U</u><span class="visually-hidden">{t('editor.underline')}</span>
		</button>
		<button type="button" aria-pressed={active('strike')} title={t('editor.strike')} onclick={() => chain().toggleStrike().run()}>
			<s aria-hidden="true">S</s><span class="visually-hidden">{t('editor.strike')}</span>
		</button>
		<button type="button" aria-pressed={active('code')} title={t('editor.code')} onclick={() => chain().toggleCode().run()}>
			<code aria-hidden="true">&lt;/&gt;</code><span class="visually-hidden">{t('editor.code')}</span>
		</button>
		<span class="sep" aria-hidden="true"></span>
		<button type="button" aria-pressed={active('link')} onclick={setLink}>{t('editor.link')}</button>
		<button type="button" onclick={wikiLink} title={t('editor.wikiLinkHint')}>[[ {t('editor.wikiLink')} ]]</button>
		<button type="button" onclick={ruleRef} title={t('editor.ruleHint')}>📖 {t('editor.ruleRef')}</button>
		<span class="sep" aria-hidden="true"></span>
		<button type="button" aria-pressed={active('bulletList')} onclick={() => chain().toggleBulletList().run()}>• {t('editor.bulletList')}</button>
		<button type="button" aria-pressed={active('orderedList')} onclick={() => chain().toggleOrderedList().run()}>1. {t('editor.orderedList')}</button>
		<button type="button" aria-pressed={active('blockquote')} onclick={() => chain().toggleBlockquote().run()}>❝ {t('editor.quote')}</button>
		<span class="sep" aria-hidden="true"></span>
		<button type="button" aria-pressed={active('callout', { kind: 'note' })} onclick={() => chain().toggleWrap('callout', { kind: 'note' }).run()}>{t('editor.note')}</button>
		<button type="button" aria-pressed={active('callout', { kind: 'tip' })} onclick={() => chain().toggleWrap('callout', { kind: 'tip' }).run()}>{t('editor.tip')}</button>
		<button type="button" aria-pressed={active('callout', { kind: 'warning' })} onclick={() => chain().toggleWrap('callout', { kind: 'warning' }).run()}>{t('editor.warning')}</button>
		{#if canSecret}
			<button type="button" class="secret-btn" aria-pressed={active('secret')} onclick={() => chain().toggleWrap('secret').run()}>🔒 {t('editor.secret')}</button>
		{/if}
		<span class="sep" aria-hidden="true"></span>
		<button type="button" onclick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={active('table')}>{t('editor.table')}</button>
		<button type="button" onclick={() => chain().setHorizontalRule().run()}>― {t('editor.rule')}</button>
		<button type="button" onclick={() => fileInput.click()}>🖼 {t('editor.image')}</button>
		{#if active('image')}
			<button type="button" onclick={editAlt}>{t('editor.altEdit')}</button>
		{/if}
		<span class="sep" aria-hidden="true"></span>
		<button type="button" onclick={() => chain().undo().run()} disabled={!can((e) => e.can().undo())}>↶ {t('editor.undo')}</button>
		<button type="button" onclick={() => chain().redo().run()} disabled={!can((e) => e.can().redo())}>↷ {t('editor.redo')}</button>
	</div>

	{#if active('table')}
		<div class="toolbar table-tools" role="group" aria-label={t('editor.tableTools')}>
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
		font-size: 0.9rem;
		min-height: 2.5rem;
		min-width: 2.5rem;
		padding: 0.2rem 0.55rem;
		border: 1px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface);
		color: var(--c-text);
		cursor: pointer;
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
		font-size: 0.9rem;
		border-bottom: 1px solid var(--c-border);
	}
	.sep {
		width: 1px;
		align-self: stretch;
		background: var(--c-border);
		margin: 0 0.2rem;
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
		font-size: 0.85rem;
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
</style>
