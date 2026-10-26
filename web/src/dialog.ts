// 页面内的输入框 / 确认框（不用浏览器自带的 prompt/confirm：小程序和一些内嵌页面里没有）
export function ask(title: string, value = ""): Promise<string | null> {
  return open(title, value, true).then((r) => (r === null ? null : r));
}

export function confirmBox(title: string): Promise<boolean> {
  return open(title, "", false).then((r) => r !== null);
}

function open(title: string, value: string, input: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "dialog";
    wrap.innerHTML = `<form><p></p>${input ? `<input id="dialogInput" maxlength="12" autocomplete="off">` : ""}
      <div class="row"><button type="button" data-no>取消</button><button type="submit" class="on">确定</button></div></form>`;
    wrap.querySelector("p")!.textContent = title;
    const field = wrap.querySelector("input");
    if (field) field.value = value;
    const close = (r: string | null) => { wrap.remove(); resolve(r); };
    wrap.querySelector("form")!.addEventListener("submit", (e) => { e.preventDefault(); close(field ? field.value : ""); });
    wrap.querySelector("[data-no]")!.addEventListener("click", (e) => { e.stopPropagation(); close(null); });
    wrap.addEventListener("click", (e) => { e.stopPropagation(); if (e.target === wrap) close(null); });
    document.body.appendChild(wrap);
    (field ?? wrap.querySelector<HTMLButtonElement>("[type=submit]"))!.focus();
  });
}
