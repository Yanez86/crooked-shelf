<script lang="ts">
	import { onMount } from 'svelte';
	import { getT } from '../i18n/index.ts';
	import { esc } from '../content/render.ts';
	import { problemMessage } from '../content/rollTables.ts';

	/**
	 * Il pulsante «Tira» sotto le tabelle di tiro delle pagine (vedi content/render.ts): il server tira, come la pagina
	 * la vede chi legge, e il risultato compare accanto al pulsante. Ogni clic è un tiro nuovo; la pagina non cambia.
	 */
	const t = getT();

	async function roll(btn: HTMLButtonElement) {
		const out = btn.parentElement?.querySelector<HTMLOutputElement>('output.roll-out');
		if (!out || btn.getAttribute('aria-disabled') === 'true') return;
		// Non `disabled`: il fuoco resterebbe nel vuoto, e chi usa la tastiera dovrebbe ritrovare il pulsante.
		btn.setAttribute('aria-disabled', 'true');
		const r = await fetch(`/api/roll-tables/${btn.dataset.rollPage}/${btn.dataset.rollBlock}`, { method: 'POST' }).catch(() => null);
		const data = r && (r.ok || r.status === 422) ? await r.json().catch(() => null) : null;
		// Svuotato e poi riempito: anche lo stesso risultato due volte di fila viene letto di nuovo.
		out.replaceChildren();
		await new Promise((done) => setTimeout(done, 50));
		if (r?.ok && data) {
			const what = data.html || esc(t('rollTables.emptyResult'));
			out.innerHTML = `<span class="roll-value">${esc(t('rollTables.value', { value: data.value, die: data.die }))}</span> ${what}`;
		} else out.textContent = data?.problem ? t(...problemMessage(data.problem)) : t(r?.status === 404 ? 'rollTables.gone' : 'errors.generic');
		btn.removeAttribute('aria-disabled');
	}

	onMount(() => {
		const onClick = (e: MouseEvent) => {
			const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.roll-button');
			if (!btn) return;
			e.preventDefault();
			roll(btn);
		};
		document.addEventListener('click', onClick);
		return () => document.removeEventListener('click', onClick);
	});
</script>
