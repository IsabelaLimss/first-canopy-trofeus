const DESTINATION_EMAIL = 'isabela.lima@senaicni.com.br';
const MIN_MEMBERS = 3;
const MAX_MEMBERS = 10;
const MAX_CONCEPT_SIZE = 5 * 1024 * 1024;
const MAX_ART_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_UPLOAD = 25 * 1024 * 1024;
const ALLOWED_CONCEPT_EXT = new Set(['pdf','ppt','pptx']);
const ALLOWED_ART_EXT = new Set(['pdf','png','jpg','jpeg']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function clean(value) {
  return String(value || '').trim();
}

function escapeHtml(value) {
  return clean(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function extension(filename = '') {
  return filename.toLowerCase().split('.').pop();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isUpload(value) {
  return value && typeof value === 'object' && typeof value.arrayBuffer === 'function' && typeof value.name === 'string';
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

async function makeAttachment(file) {
  return {
    filename: file.name,
    content: bufferToBase64(await file.arrayBuffer())
  };
}

async function handleSubmission(request, env) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    return json({
      error: 'O envio de e-mail ainda não foi configurado no Cloudflare. Configure RESEND_API_KEY e FROM_EMAIL nas variáveis do projeto.'
    }, 500);
  }

  let form;
  try {
    form = await request.formData();
  } catch (_) {
    return json({ error: 'Não foi possível ler os dados enviados.' }, 400);
  }

  const teamName = clean(form.get('teamName'));
  const phone = clean(form.get('phone'));
  const email = clean(form.get('email'));
  const members = form.getAll('members').map(clean).filter(Boolean);
  const conceptFile = form.get('conceptFile');
  const artFiles = form.getAll('artFiles').filter(isUpload);

  if (!teamName) return json({ error: 'Informe o nome da equipe.' }, 400);
  if (members.length < MIN_MEMBERS) return json({ error: `Informe pelo menos ${MIN_MEMBERS} integrantes.` }, 400);
  if (members.length > MAX_MEMBERS) return json({ error: `O limite é de ${MAX_MEMBERS} integrantes.` }, 400);

  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 13) return json({ error: 'Informe um telefone válido com DDD.' }, 400);
  if (!isEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400);

  if (!isUpload(conceptFile) || !conceptFile.name) return json({ error: 'Anexe a apresentação do conceito.' }, 400);
  if (!ALLOWED_CONCEPT_EXT.has(extension(conceptFile.name))) return json({ error: 'A apresentação deve estar em PDF, PPT ou PPTX.' }, 400);
  if (conceptFile.size > MAX_CONCEPT_SIZE) return json({ error: 'A apresentação deve ter no máximo 5 MB.' }, 400);

  if (!artFiles.length) return json({ error: 'Anexe pelo menos um arquivo de arte.' }, 400);
  if (artFiles.some(file => !ALLOWED_ART_EXT.has(extension(file.name)))) return json({ error: 'As artes devem estar em PDF, PNG, JPG ou JPEG.' }, 400);
  if (artFiles.some(file => file.size > MAX_ART_SIZE)) return json({ error: 'Cada arquivo de arte deve ter no máximo 10 MB.' }, 400);

  const totalSize = conceptFile.size + artFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_UPLOAD) return json({ error: 'O total dos anexos deve ser de no máximo 25 MB.' }, 400);

  const attachments = [
    await makeAttachment(conceptFile),
    ...await Promise.all(artFiles.map(makeAttachment))
  ];

  const membersHtml = members.map((member, index) => `<li>${index + 1}. ${escapeHtml(member)}</li>`).join('');
  const textMembers = members.map((member, index) => `${index + 1}. ${member}`).join('\n');

  const subject = `FIRST CANOPY — Proposta de troféu — ${teamName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#073f52;line-height:1.5">
      <h2 style="margin-bottom:8px">Nova proposta de troféu — FIRST CANOPY</h2>
      <p><strong>Equipe:</strong> ${escapeHtml(teamName)}</p>
      <p><strong>Telefone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
      <p><strong>Integrantes:</strong></p>
      <ol>${membersHtml}</ol>
      <p>Os arquivos da apresentação do conceito e das artes seguem anexados a este e-mail.</p>
    </div>`;

  const text = `Nova proposta de troféu — FIRST CANOPY\n\nEquipe: ${teamName}\nTelefone: ${phone}\nE-mail: ${email}\n\nIntegrantes:\n${textMembers}\n\nOs arquivos da apresentação do conceito e das artes seguem anexados.`;

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [DESTINATION_EMAIL],
      cc: [email],
      reply_to: email,
      subject,
      html,
      text,
      attachments
    })
  });

  let resendData = {};
  try { resendData = await resendResponse.json(); } catch (_) {}

  if (!resendResponse.ok) {
    console.error('Resend error', resendResponse.status, resendData);
    return json({ error: 'A proposta não pôde ser enviada por e-mail. Verifique a configuração do serviço de envio.' }, 502);
  }

  return json({ ok: true, id: resendData.id || null });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/submit') {
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      return handleSubmission(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
