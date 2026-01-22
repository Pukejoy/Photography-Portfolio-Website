(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const TO_EMAIL = "contacts@nikolaykesov.com";
  const $ = (sel) => form.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const phoneOk = (v) => {
    if (!v) return true; // optional
    if (!/^[+\d\s().-]+$/.test(v)) return false;
    return (v.match(/\d/g) || []).length >= 7;
  };

  const fields = [
    { key: "name",    el: $("#cf-name"),    err: byId("cf-name-error"),    req: true,
      test: (v) => v.length >= 3, msg: "Моля, въведете име." },

    { key: "email",   el: $("#cf-email"),   err: byId("cf-email-error"),   req: true,
      test: (v) => emailRe.test(v), msg: "Моля, въведете валиден имейл." },

    { key: "phone",   el: $("#cf-phone"),   err: byId("cf-phone-error"),   req: false,
      test: phoneOk, msg: "Невалиден телефон (или оставете празно)." },

    { key: "topic",   el: $("#cf-topic"),   err: byId("cf-topic-error"),   req: true,
      test: (v) => !!v, msg: "Моля, изберете тема." },

    { key: "message", el: $("#cf-message"), err: byId("cf-message-error"), req: true,
      test: (v) => v.length >= 10, msg: "Съобщението трябва да е поне 10 символа." },
  ];

  const setState = (f, ok) => {
    f.el.classList.toggle("is-invalid", !ok);
    f.el.toggleAttribute("aria-invalid", !ok);
    f.err.textContent = ok ? "" : f.msg;
  };

  const validate = (f, showEmpty = false) => {
    const v = f.el.value.trim();
    if (!v && !showEmpty) return setState(f, true), true;
    const ok = f.test(v);
    setState(f, ok);
    return ok;
  };

const validateAll = ({ focusFirstBad = true } = {}) => {
  let ok = true;
  let firstBad = null;

  for (const f of fields) {
    const valid = validate(f, f.req); // required fields show empty errors on submit
    if (!valid) {
      ok = false;
      if (!firstBad) firstBad = f.el;
    }
  }

  if (!ok && focusFirstBad) firstBad?.focus?.();
  return ok;
};

  const get = (key) => fields.find((f) => f.key === key).el.value.trim();

  const buildMailto = () => {
    const name = get("name");
    const email = get("email");
    const phone = get("phone");
    const topic = get("topic");
    const message = get("message");

    const subject = `${topic} — ${name}`;
    const body = [
      `Име: ${name}`,
      `Имейл: ${email}`,
      `Телефон: ${phone || "-"}`,
      "",
      "Съобщение:",
      message,
    ].join("\r\n");

    return `mailto:${TO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  fields.forEach((f) => {
    f.el.addEventListener("blur",  () => validate(f, false));
    f.el.addEventListener("input", () => validate(f, false));
  });

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (validateAll({ focusFirstBad: true })) window.location.href = buildMailto();
  });
})();
