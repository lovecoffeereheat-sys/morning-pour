const https = require('https');

const TOKEN = process.env.ASANA_ACCESS_TOKEN;
const MY_TASKS_PROJECT = '1214131354603805';
const SCHOOL_PROJECT = '1215878061255928';
const LONG_STEEP_PROJECT = '1215878207872980';

function asanaGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'app.asana.com',
      path: `/api/1.0${path}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const view = event.queryStringParameters?.view || 'topthree';

  try {

    // ── TOP THREE ──
    if (view === 'topthree') {
      const today = new Date().toISOString().split('T')[0];
      const res = await asanaGet(
        `/projects/${MY_TASKS_PROJECT}/tasks?opt_fields=name,due_on,completed,assignee_section.name,custom_fields&limit=50`
      );
      const tasks = (res.data || [])
        .filter(t => !t.completed && t.due_on === today)
        .slice(0, 3)
        .map(t => ({
          gid: t.gid,
          name: t.name,
          due_on: t.due_on
        }));
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }

    // ── SCHOOL ──
    if (view === 'school') {
      const res = await asanaGet(
        `/projects/${SCHOOL_PROJECT}/tasks?opt_fields=name,completed,memberships.section.name,custom_fields&limit=100`
      );
      const tasks = (res.data || [])
        .filter(t => !t.completed)
        .map(t => {
          const section = t.memberships?.[0]?.section?.name || '';
          const studentField = (t.custom_fields || []).find(f => f.name === 'Student');
          const student = studentField?.enum_value?.name || '';
          const subjectField = (t.custom_fields || []).find(f => f.name === 'Subject');
          const subject = subjectField?.enum_value?.name || '';
          return { gid: t.gid, name: t.name, section, student, subject };
        });
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }

    // ── LONG STEEP ──
    if (view === 'longsteep') {
      const res = await asanaGet(
        `/projects/${LONG_STEEP_PROJECT}/tasks?opt_fields=name,completed,memberships.section.name,custom_fields,notes&limit=100`
      );
      const tasks = (res.data || [])
        .filter(t => !t.completed)
        .map(t => {
          const section = t.memberships?.[0]?.section?.name || '';
          const catField = (t.custom_fields || []).find(f => f.name === 'Category');
          const category = catField?.enum_value?.name || '';
          const courtField = (t.custom_fields || []).find(f => f.name === 'Whose court');
          const court = courtField?.enum_value?.name || '';
          const nextField = (t.custom_fields || []).find(f => f.name === 'Next action');
          const nextAction = nextField?.text_value || '';
          return { gid: t.gid, name: t.name, section, category, court, nextAction, notes: t.notes || '' };
        });
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown view' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
