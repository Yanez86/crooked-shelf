<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import Icon from './Icon.svelte';

	/**
	 * Una domanda con un campo, al posto di window.prompt: si chiude con la X come gli altri popup.
	 * `ondone` riceve il testo, o null se si chiude senza salvare. Sta dentro il modulo della pagina: niente <form>, Invio si ascolta qui.
	 */
	let { label, value, ondone }: { label: string; value: string; ondone: (answer: string | null) => void } = $props();
	const t = getT();
	let dlg = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let saved = false;

	$effect(() => dlg?.showModal());

	function save() {
		saved = true;
		dlg?.close();
	}

	function keys(e: KeyboardEvent) {
		// Esc chiude questa finestra e basta, non anche il popup che può contenerla.
		if (e.key === 'Escape') e.stopPropagation();
		if (e.key === 'Enter' && e.target === input) {
			e.preventDefault();
			save();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dlg} aria-labelledby="prompt-label" onkeydown={keys} onclose={() => ondone(saved ? input!.value : null)}>
	<div class="field">
		<label id="prompt-label" for="prompt-input">{label}</label>
		<input bind:this={input} id="prompt-input" type="text" {value} />
	</div>
	<div class="actions">
		<button class="btn btn-primary" type="button" onclick={save}><Icon name="save" />{t('common.save')}</button>
	</div>
	<!-- In fondo al codice, in alto a destra a schermo: così il fuoco parte dal campo. -->
	<button class="btn btn-small btn-ghost close" type="button" title={t('common.close')} aria-label={t('common.close')} onclick={() => dlg?.close()}><Icon name="close" /></button>
</dialog>

<style>
	dialog {
		width: min(100% - 2rem, 28rem);
		max-width: none;
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
	label {
		padding-right: 2.75rem;
	}
	.close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0;
	}
</style>
