(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const TO_EMAIL = "contacts@nikolaykesov.com";

  const els = {
    name: form.querySelector("#cf-name"),
    email: form.querySelector("#cf-email"),
    phone: form.querySelector("#cf-phone"),
    topic: form.querySelector("#cf-topic"),
    message: form.querySelector("#cf-message"),
    status: document.getElementById("form-status"),
    err: {
      name: document.getElementById("cf-name-error"),
      email: document.getElementById("cf-email-error"),
      phone: document.getElementById("cf-phone-error"),
      topic: document.getElementById("cf-topic-error"),
      message: document.getElementById("cf-message-error"),
    }
  };

  function setInvalid(inputEl, errorEl, msg) {
    inputEl.classList.add("is-invalid");
    inputEl.setAttribute("aria-invalid", "true");
    errorEl.textContent = msg;
  }

  function clearInvalid(inputEl, errorEl) {
    inputEl.classList.remove("is-invalid");
    inputEl.removeAttribute("aria-invalid");
    errorEl.textContent = "";
  }

  function isValidEmail(v) {
    const email = v.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function isValidPhone(v) {
    const p = v.trim();
    if (!p) return true; // optional
    if (!/^[+\d\s().-]+$/.test(p)) return false;
    const digits = (p.match(/\d/g) || []).length;
    return digits >= 7;
  }

  function validateField(field, { showEmpty = false } = {}) {
    const v = field.value.trim();

    if (field === els.name) {
      if (!v && !showEmpty) { clearInvalid(field, els.err.name); return true; }
      if (v.length < 3) { setInvalid(field, els.err.name, "Моля, въведете име."); return false; }
      clearInvalid(field, els.err.name); return true;
    }

    if (field === els.email) {
      if (!v && !showEmpty) { clearInvalid(field, els.err.email); return true; }
      if (!isValidEmail(v)) { setInvalid(field, els.err.email, "Моля, въведете валиден имейл."); return false; }
      clearInvalid(field, els.err.email); return true;
    }

    if (field === els.phone) {
      if (!v) { clearInvalid(field, els.err.phone); return true; }
      if (!isValidPhone(v)) { setInvalid(field, els.err.phone, "Невалиден телефон (или оставете празно)."); return false; }
      clearInvalid(field, els.err.phone); return true;
    }

    if (field === els.topic) {
      if (!v && !showEmpty) { clearInvalid(field, els.err.topic); return true; }
      if (!v) { setInvalid(field, els.err.topic, "Моля, изберете тема."); return false; }
      clearInvalid(field, els.err.topic); return true;
    }

    if (field === els.message) {
      if (!v && !showEmpty) { clearInvalid(field, els.err.message); return true; }
      if (v.length < 10) { setInvalid(field, els.err.message, "Съобщението трябва да е поне 10 символа."); return false; }
      clearInvalid(field, els.err.message); return true;
    }

    return true;
  }

  function validateAll({ focusFirstBad = false } = {}) {
    let ok = true;
    let firstBad = null;

    [els.name, els.email, els.phone, els.topic, els.message].forEach((field) => {
      const required = (field === els.name || field === els.email || field === els.topic || field === els.message);
      const valid = validateField(field, { showEmpty: required });
      if (!valid) {
        ok = false;
        if (!firstBad) firstBad = field;
      }
    });

    if (!ok && focusFirstBad && firstBad) firstBad.focus?.();
    return ok;
  }

  function buildMailto() {
    const name = els.name.value.trim();
    const email = els.email.value.trim();
    const phone = els.phone.value.trim();
    const topic = els.topic.value.trim();
    const message = els.message.value.trim();

    const subject = `${topic} — ${name}`;

    // CRLF line breaks for better compatibility in some mail clients
    const body = [
      `Име: ${name}`,
      `Имейл: ${email}`,
      `Телефон: ${phone || "-"}`,
      "",
      "Съобщение:",
      message
    ].join("\r\n");

    return `mailto:${encodeURIComponent(TO_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // ✅ Immediate feedback without focus trap:
  // - validate only the field that was edited
  [els.name, els.email, els.phone, els.topic, els.message].forEach((field) => {
    field.addEventListener("blur", () => validateField(field, { showEmpty: false }));
    field.addEventListener("input", () => {
      // Clear red state as soon as it becomes valid
      validateField(field, { showEmpty: false });
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const ok = validateAll({ focusFirstBad: true });
    if (!ok) return;

    window.location.href = buildMailto();
  });
})();
