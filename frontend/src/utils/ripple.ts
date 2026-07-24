/**
 * App-wide delegated click-ripple effect. Attached once at the root so every
 * button (present or future, on any page) gets the same premium feedback
 * without each page having to opt in individually.
 */
export function initRippleEffect(): () => void {
  const handleClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement)?.closest(
      'button, .btn, [data-ripple]'
    ) as HTMLElement | null;

    if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') {
      return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const computedStyle = getComputedStyle(target);
    if (computedStyle.position === 'static') {
      target.style.position = 'relative';
    }
    if (computedStyle.overflow === 'visible') {
      target.style.overflow = 'hidden';
    }

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;

    const span = document.createElement('span');
    span.className = 'ripple-span';
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.left = `${e.clientX - rect.left - size / 2}px`;
    span.style.top = `${e.clientY - rect.top - size / 2}px`;

    target.appendChild(span);
    window.setTimeout(() => span.remove(), 700);
  };

  document.addEventListener('click', handleClick, true);
  return () => document.removeEventListener('click', handleClick, true);
}
