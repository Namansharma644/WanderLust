(() => {
  "use strict";
  // Keep form validation local to the form; do not send invalid submissions.
  document.querySelectorAll(".needs-validation").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
        form.querySelector(":invalid")?.focus();
      }
      form.classList.add("was-validated");
    });
  });
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    button.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password",
      );
      button.setAttribute("aria-pressed", String(show));
    });
  });
  const taxSwitch = document.getElementById("taxSwitch");
  taxSwitch?.addEventListener("change", () => {
    document.querySelectorAll(".tax-info").forEach((info) => {
      info.style.display = taxSwitch.checked ? "inline" : "none";
    });
  });
  // Preserve stored image URLs. Only show a truthful fallback on a failed request.
  document.querySelectorAll("[data-listing-photo]").forEach((image) => {
    const fallback = () => {
      image.removeEventListener("error", fallback);
      image.src = "/images/photo-unavailable.svg";
      image.alt = "Photo unavailable for this property";
    };
    image.addEventListener("error", fallback, { once: true });
    if (image.complete && !image.naturalWidth) fallback();
  });
  // Preview stays in the browser. Existing multipart uploads are unchanged.
  const fileInput = document.getElementById("image");
  const preview = document.getElementById("selected-photo");
  let previewUrl;
  if (fileInput && preview) {
    fileInput.addEventListener("change", () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const file = fileInput.files?.[0];
      preview.parentElement.hidden = !file || !file.type.startsWith("image/");
      if (!preview.parentElement.hidden) {
        previewUrl = URL.createObjectURL(file);
        preview.src = previewUrl;
      } else preview.removeAttribute("src");
    });
    window.addEventListener("pagehide", () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
  }
})();

(() => {
  // Native form navigation remains intact. Restore controls when validation or
  // another handler cancels submission, and when returning from browser history.
  const pending = new Map();
  function restore(form) {
    const buttons = pending.get(form);
    if (!buttons) return;
    for (const {button, nodes} of buttons) {
      button.replaceChildren(...nodes);
      button.removeAttribute('aria-disabled');
    }
    form.removeAttribute('aria-busy');
    pending.delete(form);
  }
  [...document.forms].filter(form => form.method.toLowerCase() === 'post').forEach(form => {
    form.addEventListener('submit', event => {
      if (event.defaultPrevented) return;
      if (pending.has(form)) { event.preventDefault(); return; }
      if (!form.checkValidity()) return;
      const buttons = [...form.querySelectorAll('button[type="submit"]')].map(button => ({button,nodes:[...button.childNodes]}));
      pending.set(form, buttons);
      form.setAttribute('aria-busy', 'true');
      for (const {button} of buttons) {
        button.setAttribute('aria-disabled', 'true');
        button.replaceChildren(document.createTextNode('Please wait…'));
      }
      queueMicrotask(() => { if (event.defaultPrevented) restore(form); });
    });
  });
  window.addEventListener('pageshow', () => [...pending.keys()].forEach(restore));
})();
