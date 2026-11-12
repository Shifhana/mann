/** A clockwise rounded rectangle, beginning at the top-left tangent. */
export function borderPath(width: number, height: number) {
  const x = width - .5, y = height - .5;
  const r = Math.min(9, (width - 1) / 2, (height - 1) / 2);
  return `M ${r + .5} .5 H ${x - r} A ${r} ${r} 0 0 1 ${x} ${r + .5} V ${y - r} A ${r} ${r} 0 0 1 ${x - r} ${y} H ${r + .5} A ${r} ${r} 0 0 1 .5 ${y - r} V ${r + .5} A ${r} ${r} 0 0 1 ${r + .5} .5 Z`;
}

export function borderProgress(elapsed: number, finalLock: number) {
  return Math.max(0, Math.min(1, elapsed / finalLock));
}

/** Consume displayed construction time; never run a second animation clock. */
export function installProgressBorder(container: HTMLElement, finalLock: number) {
  const frame = container.closest<HTMLElement>('.exhibit')!;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('progress-border');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('pathLength', '1');
  path.style.strokeDashoffset = '1';
  svg.append(path);
  frame.append(svg);
  frame.classList.add('has-progress-border');
  const resize = () => {
    const { width, height } = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    path.setAttribute('d', borderPath(width, height));
  };
  const observer = new ResizeObserver(resize);
  observer.observe(frame);
  resize();
  const update = (event: Event) => {
    const { elapsed } = (event as CustomEvent<{ elapsed: number }>).detail;
    path.style.strokeDashoffset = String(1 - borderProgress(elapsed, finalLock));
  };
  container.addEventListener('buildprogress', update);
  return () => {
    observer.disconnect();
    container.removeEventListener('buildprogress', update);
    svg.remove();
    frame.classList.remove('has-progress-border');
  };
}
