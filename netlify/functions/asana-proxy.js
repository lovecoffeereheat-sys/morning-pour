const https = require('https');
const TOKEN = process.env.ASANA_ACCESS_TOKEN;

const PROJECTS = {
  my_tasks:        '1214131354603805',
  school:          '1215878061255928',
  long_steep:      '1215878207872980',
  tool_builds:     '1215878061150136',
  copy_assets:     '1215878061161504',
  ro_content:      '1215878207772169',
  content_calendar:'1215878381563758',
  brain_dump:      '1215878246123374',
  weekly_priorities:'1215878061167051',
  admin_finances:  '1215878061169394',
  launches:        '1215878045466897',
  on_the_burner:   '1215878109661034',
  daily_rhythms:   '1215878245861407',
  home_people:     '1215878245923516',
};

const RO_PROJECTS = [
  { id: PROJECTS.tool_builds,      label: 'Tools' },
  { id: PROJECTS.copy_assets,      label: 'Copy & Assets' },
  { id: PROJECTS.weekly_priorities,label: 'Weekly Priorities' },
  { id: PROJECTS.content_calendar, label: 'Content Calendar' },
  { id: PROJECTS.launches,         label: 'Launches' },
];

const PERSONAL_PROJECTS = [
  { id: '1216089110350588',    label: 'On the Burner' },
  { id: PROJECTS.home_people,  label: 'Home & People' },
  { id: PROJECTS.school,       label: 'School' },
];

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

function asanaPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'app.asana.com',
      path: `/api/1.0${path}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
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
    req.write(payload);
    req.end();
  });
}

async function getTasksForProject(projectId, label) {
  try {
    const res = await asanaGet(
      `/projects/${projectId}/tasks?opt_fields=name,completed,due_on,notes&limit=100`
    );
    return (res.data || [])
      .filter(t => !t.completed)
      .map(t => ({
        gid: t.gid,
        name: t.name,
        due_on: t.due_on || null,
        project: label,
        project_id: projectId
      }));
  } catch(e) {
    return [];
  }
}


function detectContentType(name) {
  const lower = name.toLowerCase();
  if (lower.includes('batch')) return 'batch';
  if (lower.includes('tool') || lower.includes('after the call') || 
      lower.includes('before monday') || lower.includes('draft & sips') ||
      lower.includes('draft and sips')) return 'tool';
  if (lower.includes('note')) return 'note';
  return 'post';
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const view = event.queryStringParameters?.view || 'topthree';

  try {

    // ── TOP THREE (legacy, keep for existing index.html) ──
    if (view === 'topthree') {
      const today = new Date().toISOString().split('T')[0];
      const res = await asanaGet(
        `/projects/${PROJECTS.my_tasks}/tasks?opt_fields=name,due_on,completed&limit=50`
      );
      const tasks = (res.data || [])
        .filter(t => !t.completed && t.due_on === today)
        .slice(0, 3)
        .map(t => ({ gid: t.gid, name: t.name, due_on: t.due_on }));
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }

    // ── SCHOOL (legacy) ──
    if (view === 'school') {
      const res = await asanaGet(
        `/projects/${PROJECTS.school}/tasks?opt_fields=name,completed,memberships.section.name,custom_fields&limit=100`
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

    // ── LONG STEEP (legacy) ──
    if (view === 'longsteep') {
      const res = await asanaGet(
        `/projects/${PROJECTS.long_steep}/tasks?opt_fields=name,completed,memberships.section.name,custom_fields,notes&limit=100`
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


    // ── MY TASKS ──
    if (view === 'my_tasks') {
      // Fetch from Today, This Week, Next Week sections only (exclude Brain Dump + Later)
      const ACTIVE_SECTIONS = [
        { gid: '1214127756563294', name: 'TODAY' },
        { gid: '1215944486350612', name: 'THIS WEEK' },
        { gid: '1214127756563295', name: 'NEXT WEEK' },
      ];
      
      const allTasks = [];
      for (const section of ACTIVE_SECTIONS) {
        const res = await asanaGet(
          `/sections/${section.gid}/tasks?opt_fields=name,due_on,completed&limit=100`
        );
        const tasks = (res.data || [])
          .filter(t => !t.completed)
          .map(t => ({
            gid: t.gid,
            name: t.name,
            due_on: t.due_on || null,
            project: section.name,
            project_id: '1214131354603805'
          }));
        allTasks.push(...tasks);
      }
      
      allTasks.sort((a,b) => {
        const order = { 'TODAY': 0, 'THIS WEEK': 1, 'NEXT WEEK': 2 };
        return (order[a.project] || 0) - (order[b.project] || 0);
      });
      
      return { statusCode: 200, headers, body: JSON.stringify({ tasks: allTasks }) };
    }
    
    // ── BRAIN DUMP SECTION ──
    if (view === 'brain_dump') {
      const res = await asanaGet(
        `/sections/1214127756563293/tasks?opt_fields=name,completed,due_on,notes&limit=100`
      );
      const tasks = (res.data || [])
        .filter(t => !t.completed)
        .map(t => ({
          gid: t.gid,
          name: t.name,
          due_on: t.due_on || null,
          notes: t.notes || '',
          project: 'BRAIN DUMP',
          project_id: '1214131354603805'
        }));
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }
    
    // ── MOVE TASK TO SECTION ──
    if (view === 'move_task' && method === 'POST') {
      const { task_gid, section_gid } = body;
      const res = await fetch(`https://app.asana.com/api/1.0/sections/${section_gid}/addTask`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { task: task_gid } })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
    }

    // ── RO TASKS (content lane) ──
    if (view === 'ro_tasks') {
      const results = await Promise.all(
        RO_PROJECTS.map(p => getTasksForProject(p.id, p.label))
      );
      const tasks = results.flat().sort((a, b) => {
        if (!a.due_on && !b.due_on) return 0;
        if (!a.due_on) return 1;
        if (!b.due_on) return -1;
        return a.due_on.localeCompare(b.due_on);
      });
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }

    // ── PERSONAL TASKS (personal/mom life lane) ──
    if (view === 'personal_tasks') {
      const results = await Promise.all(
        PERSONAL_PROJECTS.map(p => getTasksForProject(p.id, p.label))
      );
      const tasks = results.flat().sort((a, b) => {
        if (!a.due_on && !b.due_on) return 0;
        if (!a.due_on) return 1;
        if (!b.due_on) return -1;
        return a.due_on.localeCompare(b.due_on);
      });
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }

    // ── WEEK TASKS (both lanes, due this week) ──
    if (view === 'week_tasks') {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      const [roResults, personalResults] = await Promise.all([
        Promise.all(RO_PROJECTS.map(p => getTasksForProject(p.id, p.label))),
        Promise.all(PERSONAL_PROJECTS.map(p => getTasksForProject(p.id, p.label)))
      ]);

      const filterWeek = tasks => tasks.flat().filter(t =>
        t.due_on && t.due_on >= startStr && t.due_on <= endStr
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ro: filterWeek(roResults),
          personal: filterWeek(personalResults)
        })
      };
    }


    // ── CONTENT CALENDAR ──
    if (view === 'content_calendar') {
      const res = await asanaGet(
        `/projects/1215878381563758/tasks?opt_fields=name,due_on,completed,notes&limit=100`
      );
      const tasks = (res.data || [])
        .filter(t => !t.completed && t.due_on)
        .map(t => ({
          gid: t.gid,
          name: t.name,
          due_on: t.due_on,
          notes: t.notes || '',
          type: detectContentType(t.name)
        }))
        .sort((a,b) => a.due_on.localeCompare(b.due_on));
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }


    // ── PUBLISHING THIS WEEK ──
    if (view === 'publishing_this_week') {
      const today = new Date();
      const day = today.getDay();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - day);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      const startStr = sunday.toISOString().split('T')[0];
      const endStr = saturday.toISOString().split('T')[0];

      const res = await asanaGet(
        `/projects/1215878381563758/tasks?opt_fields=name,due_on,completed,notes&limit=100`
      );
      const tasks = (res.data || [])
        .filter(t => !t.completed && t.due_on && t.due_on >= startStr && t.due_on <= endStr)
        .map(t => ({
          gid: t.gid,
          name: t.name,
          due_on: t.due_on,
          project: 'Content Calendar',
          project_id: '1215878381563758',
          type: detectContentType(t.name)
        }))
        .sort((a,b) => a.due_on.localeCompare(b.due_on));
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }

    // ── IN PROGRESS CONTENT ──
    if (view === 'in_progress_content') {
      // Only pull from Drafting and Ready sections — not Idea
      const ACTIVE_SECTIONS = [
        { gid: '1215878245764271', name: 'Drafting' },
        { gid: '1215878207780841', name: 'Ready' },
      ];
      const allTasks = [];
      for (const section of ACTIVE_SECTIONS) {
        const res = await asanaGet(
          `/sections/${section.gid}/tasks?opt_fields=name,due_on,completed&limit=50`
        );
        const tasks = (res.data || [])
          .filter(t => !t.completed)
          .map(t => ({
            gid: t.gid,
            name: t.name,
            due_on: t.due_on || null,
            project: section.name,
            project_id: '1215878207772169',
            type: detectContentType(t.name)
          }));
        allTasks.push(...tasks);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ tasks: allTasks }) };
    }


    // ── BRAIN DUMP SECTION (My Tasks) ──
    if (view === 'brain_dump_section') {
      const res = await asanaGet(
        `/sections/1214131354603822/tasks?opt_fields=name,completed,due_on,notes&limit=100`
      );
      const tasks = (res.data || [])
        .filter(t => !t.completed)
        .map(t => ({
          gid: t.gid,
          name: t.name,
          due_on: t.due_on || null,
          notes: t.notes || '',
          project: 'Brain Dump',
          project_id: '1214131354603805'
        }));
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }


    // ── MY TASKS SECTIONS (diagnostic) ──
    if (view === 'my_tasks_sections') {
      // Try multiple approaches to get My Tasks sections
      const meRes = await asanaGet('/users/me?opt_fields=gid,workspaces');
      const userGid = meRes.data?.gid;
      
      // Get user task list
      const taskListRes = await asanaGet(`/users/${userGid}/user_task_list?workspace=1182497100078086&opt_fields=gid,name`);
      const taskListGid = taskListRes.data?.gid;
      
      // Try sections on the task list directly
      const sectionsRes = await asanaGet(`/projects/${taskListGid}/sections?opt_fields=name,gid`);
      
      return { statusCode: 200, headers, body: JSON.stringify({ 
        userGid,
        taskListGid,
        sections: sectionsRes.data || [],
        taskListData: taskListRes.data
      }) };
    }


    // ── RO NOTES (for content map notes row) ──
    if (view === 'ro_notes') {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(today.getFullYear(), today.getMonth()+2, 0).toISOString().split('T')[0];
      const res = await asanaGet(
        `/projects/1215878207772169/tasks?opt_fields=name,due_on,completed&limit=100`
      );
      const tasks = (res.data || [])
        .filter(t => !t.completed && t.due_on && t.name.toLowerCase().includes('note'))
        .map(t => ({
          gid: t.gid,
          name: t.name,
          due_on: t.due_on,
          type: 'note',
          project: 'RO Content'
        }))
        .sort((a,b) => a.due_on.localeCompare(b.due_on));
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }

    // ── CREATE TASK ──
    if (view === 'create_task' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { name, project_id, due_on, notes } = body;
      if (!name || !project_id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'name and project_id required' }) };
      }
      const { section_id } = body;
      const taskData = {
        data: {
          name,
          projects: [project_id],
          ...(due_on && { due_on }),
          ...(notes && { notes }),
          ...(section_id && { memberships: [{ project: project_id, section: section_id }] })
        }
      };
      const result = await asanaPost('/tasks', taskData);
      return { statusCode: 200, headers, body: JSON.stringify({ task: result.data }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown view' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
