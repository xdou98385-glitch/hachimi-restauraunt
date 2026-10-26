// 每秒刷新时不整块替换，只改有变化的地方，按钮还是原来那个，点击不会丢
export function morph(target: HTMLElement, html: string): void {
  const next = document.createElement(target.tagName);
  next.innerHTML = html;
  patchChildren(target, next);
}

function patchChildren(a: Node, b: Node): void {
  const aKids = [...a.childNodes], bKids = [...b.childNodes];
  for (let i = 0; i < bKids.length; i++) {
    const x = aKids[i], y = bKids[i];
    if (!x) a.appendChild(y);
    else if (!same(x, y)) a.replaceChild(y, x);
    else patch(x, y);
  }
  for (let i = bKids.length; i < aKids.length; i++) a.removeChild(aKids[i]);
}

function same(x: Node, y: Node): boolean {
  return x.nodeType === y.nodeType && x.nodeName === y.nodeName;
}

function patch(x: Node, y: Node): void {
  if (x.nodeType === Node.TEXT_NODE) {
    if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue;
    return;
  }
  if (!(x instanceof Element) || !(y instanceof Element)) return;
  for (const { name } of [...x.attributes]) if (!y.hasAttribute(name)) x.removeAttribute(name);
  for (const { name, value } of [...y.attributes]) if (x.getAttribute(name) !== value) x.setAttribute(name, value);
  if (x instanceof HTMLTextAreaElement) return; // 输入框里的内容别动
  if ("disabled" in x) (x as HTMLButtonElement).disabled = (y as HTMLButtonElement).disabled;
  patchChildren(x, y);
}
