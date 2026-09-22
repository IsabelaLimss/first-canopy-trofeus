const DESTINATION_EMAIL = 'isabela.lima@senaicni.com.br';
const MIN = 3, MAX = 10, MC = 5 * 1024 * 1024, MA = 10 * 1024 * 1024, MT = 25 * 1024 * 1024;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const clean = v => String(v || '').trim();
const ext = n => (n || '').toLowerCase().split('.').pop();
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isUpload = v => v && typeof v.arrayBuffer === 'function' && typeof v.name === 'string';

function safeName(name) {
  return clean(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'arquivo';
}
function b64(buf) {
  const a = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < a.length; i += 32768) {
    s += String.fromCharCode(...a.subarray(i, Math.min(i + 32768, a.length)));
  }
  return btoa(s);
}
async function attachment(file) {
  return { filename: file.name, content: b64(await file.arrayBuffer()) };
}
async function nextProposalId(env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
  `);
  const row = await env.DB.prepare(`
    INSERT INTO counters (name, value)
    VALUES ('proposal', 1)
    ON CONFLICT(name) DO UPDATE SET value = value + 1
    RETURNING value
  `).first();
  const year = new Date().getUTCFullYear();
  return `FC-${year}-${String(row.value).padStart(4, '0')}`;
}
async function putFile(env, proposalId, folder, file, index = null) {
  const prefix = index == null ? '' : String(index).padStart(2, '0') + '-';
  const key = `${proposalId}/${folder}/${prefix}${safeName(file.name)}`;
  await env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { proposalId, originalName: file.name }
  });
  return key;
}
async function trySendEmail(env, team, phone, mail, members, concept, arts, proposalId) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    return { sent: false, reason: 'email_not_configured' };
  }
  const attachments = [
    await attachment(concept),
    ...await Promise.all(arts.map(attachment))
  ];
  const subject = `FIRST CANOPY — Proposta ${proposalId} — ${team}`;
  const text = [
    `ID da proposta: ${proposalId}`,
    `Equipe: ${team}`,
    `Telefone: ${phone}`,
    `E-mail: ${mail}`,
    '',
    'Integrantes:',
    ...members.map((m, i) => `${i + 1}. ${m}`)
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [DESTINATION_EMAIL],
      cc: [mail],
      reply_to: mail,
      subject,
      text,
      attachments
    })
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    console.error('Resend', response.status, data);
    return { sent: false, reason: 'email_failed' };
  }
  return { sent: true, id: data.id || null };
}

async function submit(request, env) {
  if (!env.DB || !env.FILES) {
    return json({ error: 'O armazenamento do formulário ainda não está configurado.' }, 500);
  }

  let fd;
  try { fd = await request.formData(); }
  catch { return json({ error: 'Não foi possível ler os dados enviados.' }, 400); }

  const team = clean(fd.get('teamName'));
  const phone = clean(fd.get('phone'));
  const mail = clean(fd.get('email'));
  const members = fd.getAll('members').map(clean).filter(Boolean);
  const concept = fd.get('conceptFile');
  const arts = fd.getAll('artFiles').filter(isUpload);

  if (!team) return json({ error: 'Informe o nome da equipe.' }, 400);
  if (members.length < MIN) return json({ error: 'Informe pelo menos 3 integrantes.' }, 400);
  if (members.length > MAX) return json({ error: 'O limite é de 10 integrantes.' }, 400);

  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 13) return json({ error: 'Informe um telefone válido com DDD.' }, 400);
  if (!validEmail(mail)) return json({ error: 'Informe um e-mail válido.' }, 400);

  if (!isUpload(concept) || !concept.name) return json({ error: 'Anexe a apresentação do conceito.' }, 400);
  if (!['pdf', 'ppt', 'pptx'].includes(ext(concept.name))) return json({ error: 'A apresentação deve estar em PDF, PPT ou PPTX.' }, 400);
  if (concept.size > MC) return json({ error: 'A apresentação deve ter no máximo 5 MB.' }, 400);

  if (!arts.length) return json({ error: 'Anexe pelo menos um arquivo de arte.' }, 400);
  if (arts.some(f => !['pdf', 'png', 'jpg', 'jpeg'].includes(ext(f.name)))) return json({ error: 'As artes devem estar em PDF, PNG, JPG ou JPEG.' }, 400);
  if (arts.some(f => f.size > MA)) return json({ error: 'Cada arte deve ter no máximo 10 MB.' }, 400);

  const total = concept.size + arts.reduce((s, f) => s + f.size, 0);
  if (total > MT) return json({ error: 'O total dos anexos deve ser de no máximo 25 MB.' }, 400);

  const proposalId = await nextProposalId(env);
  const uploadedKeys = [];

  try {
    const conceptKey = await putFile(env, proposalId, 'conceito', concept);
    uploadedKeys.push(conceptKey);

    const artKeys = [];
    for (let i = 0; i < arts.length; i++) {
      const key = await putFile(env, proposalId, 'artes', arts[i], i + 1);
      uploadedKeys.push(key);
      artKeys.push(key);
    }

    const padded = Array.from({ length: 10 }, (_, i) => members[i] || null);
    const submittedAt = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO submissions (
        id, submitted_at, team_name,
        member_1, member_2, member_3, member_4, member_5,
        member_6, member_7, member_8, member_9, member_10,
        phone, email, concept_file, artwork_files, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      proposalId, submittedAt, team,
      ...padded,
      phone, mail, conceptKey, JSON.stringify(artKeys), 'Enviada'
    ).run();

    const emailResult = await trySendEmail(env, team, phone, mail, members, concept, arts, proposalId);

    return json({
      ok: true,
      proposalId,
      stored: true,
      emailSent: emailResult.sent,
      emailStatus: emailResult.reason || 'sent'
    });
  } catch (error) {
    console.error('Submission error', error);
    if (uploadedKeys.length) {
      await Promise.allSettled(uploadedKeys.map(key => env.FILES.delete(key)));
    }
    return json({ error: 'Não foi possível registrar a proposta. Tente novamente.' }, 500);
  }
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}
async function exportCsv(request, env) {
  if (!env.ADMIN_EXPORT_TOKEN) {
    return json({ error: 'A exportação administrativa ainda não foi configurada.' }, 503);
  }
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== env.ADMIN_EXPORT_TOKEN) return json({ error: 'Não autorizado.' }, 401);

  const { results = [] } = await env.DB.prepare(`
    SELECT id, submitted_at, team_name,
      member_1, member_2, member_3, member_4, member_5,
      member_6, member_7, member_8, member_9, member_10,
      phone, email, concept_file, artwork_files, status
    FROM submissions
    ORDER BY submitted_at DESC
  `).all();

  const headers = [
    'ID da proposta','Data/hora','Nome da equipe',
    'Integrante 1','Integrante 2','Integrante 3','Integrante 4','Integrante 5',
    'Integrante 6','Integrante 7','Integrante 8','Integrante 9','Integrante 10',
    'Telefone','E-mail','Arquivo do conceito','Arquivos de arte','Status'
  ];
  const rows = results.map(r => [
    r.id, r.submitted_at, r.team_name,
    r.member_1, r.member_2, r.member_3, r.member_4, r.member_5,
    r.member_6, r.member_7, r.member_8, r.member_9, r.member_10,
    r.phone, r.email, r.concept_file, r.artwork_files, r.status
  ]);
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="first-canopy-propostas.csv"',
      'cache-control': 'no-store'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/submit') {
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      return submit(request, env);
    }
    if (url.pathname === '/api/export.csv') {
      if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
      return exportCsv(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
