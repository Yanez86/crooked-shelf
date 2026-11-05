<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import Icon from './Icon.svelte';

	/**
	 * «Elimina la campagna»: un pulsante rosso che apre un popup con l'avviso e il nome da riscrivere per conferma
	 * (lo controlla anche il server). Esc, la X o «Annulla» lo chiudono senza toccare niente. `query` si aggiunge all'azione, come in Invites.
	 */
	let { id, name, query = '' }: { id: number; name: string; query?: string } = $props();
	const t = getT();
	let dlg = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();

	function open() {
		dlg?.showModal();
		input?.focus();
	}

	function close() {
		dlg?.close();
		if (input) input.value = '';
	}
</script>

<button class="btn btn-delete" type="button" aria-haspopup="dialog" onclick={open}><Icon name="trash" />{t('campaign.delete')}<span class="visually-hidden"> {name}</span></button>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<dialog bind:this={dlg} aria-labelledby="delete-{id}-title" aria-describedby="delete-{id}-warning" onclick={(e) => e.target === dlg && close()} onclose={() => input && (input.value = '')}>
	<h2 id="delete-{id}-title">{t('campaign.deleteTitle', { name })}</h2>
	<p id="delete-{id}-warning">{t('campaign.deleteWarning')}</p>
	<!-- _top: anche dal popup, per non lasciare sotto la pagina di una campagna che non c'è più. -->
	<form method="post" action="?/delete{query}" target="_top">
		<input type="hidden" name="id" value={id} />
		<div class="field">
			<label for="delete-{id}">{t('campaign.deleteConfirm', { name })}</label>
			<input bind:this={input} id="delete-{id}" name="confirm" type="text" required maxlength="80" autocomplete="off" />
		</div>
		<div class="actions">
			<button class="btn btn-delete" type="submit"><Icon name="trash" />{t('campaign.deleteSubmit')}<span class="visually-hidden"> {name}</span></button>
			<button class="btn" type="button" onclick={close}>{t('common.cancel')}</button>
		</div>
	</form>
	<!-- In fondo al codice, in alto a destra a schermo: così il fuoco parte dal campo. -->
	<button class="btn btn-small btn-ghost close" type="button" title={t('common.close')} aria-label={t('common.close')} onclick={close}><Icon name="close" /></button>
</dialog>

<style>
	/* Rosso pieno: si vede subito che è l'azione che non si può annullare. Il testo ha il colore dello sfondo,
	   quindi lo stesso contrasto del rosso sullo sfondo (vedi themes.ts). */
	.btn-delete {
		border-color: var(--c-danger);
		background: var(--c-danger);
		color: var(--c-bg);
	}
	.btn-delete:hover {
		border-color: var(--c-text);
		background: var(--c-danger);
		color: var(--c-bg);
	}
	dialog {
		width: min(100% - 2rem, 32rem);
		max-width: none;
		padding: 1.25rem;
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-danger);
		border-radius: var(--radius);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	h2 {
		margin-top: 0;
		padding-right: 2.75rem;
		font-size: var(--fs-lg, 1.25rem);
	}
	.actions {
		margin-bottom: 0;
	}
	.close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0;
	}
	@media (forced-colors: active) {
		.btn-delete {
			border: 2px solid ButtonText;
		}
	}
</style>
