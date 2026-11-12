import './style.css';
import { createTempleDefinition } from './temple/model.ts';
import { displayTemple } from './temple/render.ts';

const container = document.querySelector<HTMLElement>('#temple-viewport')!;

try {
  const inspection = import.meta.env.DEV ? new URLSearchParams(location.search).get('compare') : null;
  const definition = createTempleDefinition(inspection === 'benchmark' || inspection === 'hidden' || inspection === 'aggressive' ? inspection : 'balanced');
  const temple = displayTemple(container, definition);
  const rebuild = document.createElement('button');
  rebuild.className = 'rebuild'; rebuild.textContent = '↻  Rebuild';
  rebuild.setAttribute('aria-label', 'Rebuild the Shore Temple');
  rebuild.addEventListener('click', temple.rebuild);
  container.closest('.exhibit')!.append(rebuild);
  container.addEventListener('buildstate', event => {
    rebuild.disabled = (event as CustomEvent<boolean>).detail;
    rebuild.textContent = rebuild.disabled ? 'Assembling…' : '↻  Rebuild';
  });
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('record')) {
    import('./recording.ts').then(({ installRecording }) => installRecording(container, temple.rebuild));
  }
  if (import.meta.hot) import.meta.hot.dispose(() => temple.dispose());
} catch (error) {
  console.error('Unable to display the Shore Temple model.', error);
  container.replaceChildren();
  const message = document.createElement('p');
  message.className = 'render-error';
  message.setAttribute('role', 'alert');
  message.textContent = 'This miniature needs WebGL. Please open it in a browser with hardware acceleration enabled.';
  container.append(message);
  container.closest('figure')?.setAttribute('aria-busy', 'false');
}
