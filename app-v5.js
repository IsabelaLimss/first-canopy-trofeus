const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

const form = $('#proposalForm');
const submitButton = $('#submitProposal');
const formMessage = $('#formMessage');
const memberList = $('#memberList');
const addMemberButton = $('#addMember');
const conceptFile = $('#conceptFile');
const artFiles = $('#artFiles');
const conceptUploadBox = $('#conceptUploadBox');
const artsUploadBox = $('#artsUploadBox');

const MAX_MEMBERS = 10;
const MIN_MEMBERS = 3;
const MAX_CONCEPT_SIZE = 5 * 1024 * 1024;
const MAX_ART_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_UPLOAD = 25 * 1024 * 1024;

const allowedConceptExt = ['pdf', 'ppt', 'pptx'];
const allowedArtExt = ['pdf', 'png', 'jpg', 'jpeg'];

function value(id) {
  return ($(id)?.value || '').trim();
}

function getExtension(filename = '') {
  return filename.toLowerCase().split('.').pop();
}

function setError(id, message = '') {
  const el = $(id);
  if (el) el.textContent = message;
}

function setInvalid(el, isInvalid) {
  if (!el) return;
  el.classList.toggle('invalid', Boolean(isInvalid));
  el.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
}

function updateMemberIndexes() {
  $$('.member-row', memberList).forEach((row, index) => {
    const badge = $('.member-index', row);
    const input = $('.member-name', row);
    if (badge) badge.textContent = String(index + 1);
    if (input) {
      input.placeholder = `Nome completo do integrante ${index + 1}`;
      input.setAttribute('aria-label', `Nome do integrante ${index + 1}`);
    }
  });
  addMemberButton.disabled = $$('.member-row', memberList).length >= MAX_MEMBERS;
}

function wireRemove(button) {
  button.addEventListener('click', () => {
    const rows = $$('.member-row', memberList);
    if (rows.length <= MIN_MEMBERS) {
      setError('#membersError', `É necessário manter pelo menos ${MIN_MEMBERS} integrantes.`);
      return;
    }
    button.closest('.member-row')?.remove();
    updateMemberIndexes();
    validateForm(false);
  });
}

$$('.remove-member').forEach(wireRemove);
updateMemberIndexes();

addMemberButton?.addEventListener('click', () => {
  const rows = $$('.member-row', memberList);
  if (rows.length >= MAX_MEMBERS) return;

  const row = document.createElement('div');
  row.className = 'member-row';
  row.innerHTML = `
    <span class="member-index">${rows.length + 1}</span>
    <input class="input member-name" name="members" type="text" required placeholder="Nome completo do integrante ${rows.length + 1}" aria-label="Nome do integrante ${rows.length + 1}">
    <button class="remove-member" type="button" aria-label="Remover integrante" title="Remover integrante">×</button>
  `;
  memberList.appendChild(row);
  wireRemove($('.remove-member', row));
  $('.member-name', row)?.focus();
  updateMemberIndexes();
  validateForm(false);
});

function validateTeamName(showErrors) {
  const input = $('#teamName');
  const ok = value('#teamName').length > 0;
  if (showErrors) {
    setInvalid(input, !ok);
    setError('#teamNameError', ok ? '' : 'Informe o nome da equipe.');
  } else if (ok) {
    setInvalid(input, false);
    setError('#teamNameError', '');
  }
  return ok;
}

function validateMembers(showErrors) {
  const inputs = $$('.member-name');
  const names = inputs.map(input => input.value.trim());
  const filled = names.filter(Boolean);
  const allVisibleRowsFilled = names.every(Boolean);
  const ok = filled.length >= MIN_MEMBERS && allVisibleRowsFilled;

  inputs.forEach(input => {
    if (showErrors) setInvalid(input, !input.value.trim());
    else if (input.value.trim()) setInvalid(input, false);
  });

  let message = '';
  if (filled.length < MIN_MEMBERS) message = `Informe pelo menos ${MIN_MEMBERS} integrantes.`;
  else if (!allVisibleRowsFilled) message = 'Preencha todos os integrantes adicionados ou remova os campos extras.';

  if (showErrors || ok) setError('#membersError', ok ? '' : message);
  return ok;
}

function validatePhone(showErrors) {
  const input = $('#phone');
  const digits = value('#phone').replace(/\D/g, '');
  const ok = digits.length >= 10 && digits.length <= 13;
  if (showErrors) {
    setInvalid(input, !ok);
    setError('#phoneError', ok ? '' : 'Informe um telefone válido com DDD.');
  } else if (ok) {
    setInvalid(input, false);
    setError('#phoneError', '');
  }
  return ok;
}

function validateEmail(showErrors) {
  const input = $('#email');
  const email = value('#email');
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (showErrors) {
    setInvalid(input, !ok);
    setError('#emailError', ok ? '' : 'Informe um e-mail válido.');
  } else if (ok) {
    setInvalid(input, false);
    setError('#emailError', '');
  }
  return ok;
}

function validateConcept(showErrors) {
  const file = conceptFile?.files?.[0];
  let message = '';
  let ok = Boolean(file);

  if (!file) message = 'Anexe a apresentação do conceito.';
  else if (!allowedConceptExt.includes(getExtension(file.name))) {
    ok = false;
    message = 'Formato inválido. Use PDF, PPT ou PPTX.';
  } else if (file.size > MAX_CONCEPT_SIZE) {
    ok = false;
    message = 'A apresentação deve ter no máximo 5 MB.';
  }

  if (showErrors || ok) {
    conceptUploadBox?.classList.toggle('invalid', !ok);
    setError('#conceptFileError', ok ? '' : message);
  }
  return ok;
}

function validateArts(showErrors) {
  const files = [...(artFiles?.files || [])];
  let message = '';
  let ok = files.length > 0;

  if (!files.length) message = 'Anexe pelo menos um arquivo de arte.';
  else if (files.some(file => !allowedArtExt.includes(getExtension(file.name)))) {
    ok = false;
    message = 'Formato inválido. Use PDF, PNG, JPG ou JPEG.';
  } else if (files.some(file => file.size > MAX_ART_SIZE)) {
    ok = false;
    message = 'Cada arquivo de arte deve ter no máximo 10 MB.';
  }

  const conceptSize = conceptFile?.files?.[0]?.size || 0;
  const total = files.reduce((sum, file) => sum + file.size, conceptSize);
  if (ok && total > MAX_TOTAL_UPLOAD) {
    ok = false;
    message = 'O total dos anexos deve ser de no máximo 25 MB.';
  }

  if (showErrors || ok) {
    artsUploadBox?.classList.toggle('invalid', !ok);
    setError('#artFilesError', ok ? '' : message);
  }
  return ok;
}

function validateForm(showErrors = false) {
  const checks = [
    validateTeamName(showErrors),
    validateMembers(showErrors),
    validatePhone(showErrors),
    validateEmail(showErrors),
    validateConcept(showErrors),
    validateArts(showErrors)
  ];
  const valid = checks.every(Boolean);
  submitButton.disabled = !valid;
  return valid;
}

function formatPhone(event) {
  const input = event.target;
  let digits = input.value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) input.value = digits ? `(${digits}` : '';
  else if (digits.length <= 6) input.value = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  else if (digits.length <= 10) input.value = `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  else input.value = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

$('#phone')?.addEventListener('input', event => {
  formatPhone(event);
  validateForm(false);
});

form?.addEventListener('input', event => {
  if (!event.target.matches('#phone')) validateForm(false);
});

conceptFile?.addEventListener('change', () => {
  const file = conceptFile.files?.[0];
  $('#conceptFileName').textContent = file ? file.name : 'Nenhum arquivo selecionado.';
  conceptUploadBox?.classList.toggle('has-file', Boolean(file));
  validateForm(false);
});

artFiles?.addEventListener('change', () => {
  const files = [...(artFiles.files || [])];
  $('#artFilesName').textContent = files.length ? files.map(file => file.name).join(' • ') : 'Nenhum arquivo selecionado.';
  artsUploadBox?.classList.toggle('has-file', files.length > 0);
  validateForm(false);
});

function showFormMessage(message, type = 'error') {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
  formMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearFormMessage() {
  formMessage.textContent = '';
  formMessage.className = 'form-message';
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  clearFormMessage();

  if (!validateForm(true)) {
    showFormMessage('Revise os campos obrigatórios antes de enviar a proposta.');
    return;
  }

  const formData = new FormData(form);
  submitButton.disabled = true;
  submitButton.classList.add('sending');
  $('.button-label', submitButton).textContent = 'Enviando...';

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: formData
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
      throw new Error(data.error || 'Não foi possível enviar a proposta. Tente novamente.');
    }

    const email = value('#email');
    $('#successText').textContent = `A proposta foi enviada para a organização e uma cópia foi encaminhada para ${email}.`;
    $('#successModal').classList.add('open');
    $('#successModal').setAttribute('aria-hidden', 'false');
    showFormMessage('Proposta enviada com sucesso.', 'success');
  } catch (error) {
    showFormMessage(error.message || 'Ocorreu um erro ao enviar a proposta.');
  } finally {
    submitButton.classList.remove('sending');
    $('.button-label', submitButton).textContent = 'Enviar proposta';
    validateForm(false);
  }
});

$('#closeSuccess')?.addEventListener('click', () => {
  $('#successModal').classList.remove('open');
  $('#successModal').setAttribute('aria-hidden', 'true');
});

$('#successModal')?.addEventListener('click', event => {
  if (event.target.id === 'successModal') $('#closeSuccess')?.click();
});

validateForm(false);
