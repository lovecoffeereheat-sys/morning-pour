const TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = '2022-06-28';

const DATABASES = {
  table: '3935b934-f724-804a-b86e-e9fc94014d58',
  journal: '3945b934-f724-8086-a420-000bf9049731',
  tasks: 'cc2b3915-10c2-41d1-ae9c-d6440919da2a',
  content: '3965b934-f724-80ee-853f-000b39d87c8d',
  podcast: '0b1cdbab-7b2c-4733-aa14-714d4714280c',
  pinterest: '04250405-6f03-43f5-85b4-20f3dd1cc88f',
};

async function notionFetch(path, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res.json();
}

function richText(text) {
  return text ? [{ type: 'text', text: { content: String(text).slice(0, 2000) } }] : [];
}

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const view = event.queryStringParameters?.view;
  const method = event.httpMethod;
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) {}

  try {
    // ── GET MEALS (The Table) ──
    if (view === 'get_meals') {
      const res = await notionFetch(`/data_sources/${DATABASES.table}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 100 }),
      });
      const meals = (res.results || []).map(page => {
        const p = page.properties;
        return {
          id: page.id,
          meal: p.Meal?.title?.[0]?.plain_text || '',
          type: p.Type?.select?.name || '',
          tags: (p.Tags?.multi_select || []).map(t => t.name),
          ingredients: p.Ingredients?.rich_text?.[0]?.plain_text || '',
          notes: p['Recipe notes']?.rich_text?.[0]?.plain_text || '',
          favourite: p.Favourite?.checkbox || p.Favorite?.checkbox || false,
          lastMade: p['Last made']?.date?.start || null,
          whoLikes: (p['Who likes it']?.multi_select || []).map(w => w.name),
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ meals }) };
    }

    // ── ADD MEAL (The Table) ──
    if (view === 'add_meal' && method === 'POST') {
      const { meal, type, tags, ingredients, notes, whoLikes } = body;
      const res = await notionFetch('/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { data_source_id: DATABASES.table },
          properties: {
            Meal: { title: richText(meal) },
            ...(type ? { Type: { select: { name: type } } } : {}),
            ...(tags?.length ? { Tags: { multi_select: tags.map(t => ({ name: t })) } } : {}),
            ...(ingredients ? { Ingredients: { rich_text: richText(ingredients) } } : {}),
            ...(notes ? { 'Recipe notes': { rich_text: richText(notes) } } : {}),
            ...(whoLikes?.length ? { 'Who likes it': { multi_select: whoLikes.map(w => ({ name: w })) } } : {}),
          },
        }),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, page: res }) };
    }

    // ── UPDATE MEAL (mark last made, toggle favourite) ──
    if (view === 'update_meal' && method === 'POST') {
      const { page_id, lastMade, favourite } = body;
      const properties = {};
      if (lastMade) properties['Last made'] = { date: { start: lastMade } };
      if (typeof favourite === 'boolean') properties['Favourite'] = { checkbox: favourite };
      await notionFetch(`/pages/${page_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // ── GET JOURNAL ENTRIES (Morning Steep) ──
    if (view === 'get_journal') {
      const res = await notionFetch(`/data_sources/${DATABASES.journal}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 30, sorts: [{ property: 'Date', direction: 'descending' }] }),
      });
      const entries = (res.results || []).map(page => {
        const p = page.properties;
        return {
          id: page.id,
          date: p.date?.title?.[0]?.plain_text || p.date?.date?.start || '',
          theme: p.theme?.select?.name || '',
          scripture: p['scripture reference']?.rich_text?.[0]?.plain_text || '',
          translation: p.translation?.select?.name || '',
          observation: p.observation?.rich_text?.[0]?.plain_text || '',
          application: p.application?.rich_text?.[0]?.plain_text || '',
          gratitude: [
            p['gratitude 1']?.rich_text?.[0]?.plain_text || '',
            p['gratitude 2']?.rich_text?.[0]?.plain_text || '',
            p['gratitude 3']?.rich_text?.[0]?.plain_text || '',
          ].filter(Boolean),
          prayer: p.prayer?.rich_text?.[0]?.plain_text || '',
          oneWord: p['one word']?.rich_text?.[0]?.plain_text || '',
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ entries }) };
    }

    // ── ADD JOURNAL ENTRY (Morning Steep) ──
    if (view === 'add_journal_entry' && method === 'POST') {
      const { date, theme, scripture, translation, observation, application, gratitude, prayer, oneWord } = body;
      const g = Array.isArray(gratitude) ? gratitude : [];
      const res = await notionFetch('/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { data_source_id: DATABASES.journal },
          properties: {
            date: { title: richText(date) },
            ...(theme ? { theme: { select: { name: theme } } } : {}),
            ...(scripture ? { 'scripture reference': { rich_text: richText(scripture) } } : {}),
            ...(translation ? { translation: { select: { name: translation } } } : {}),
            ...(observation ? { observation: { rich_text: richText(observation) } } : {}),
            ...(application ? { application: { rich_text: richText(application) } } : {}),
            ...(g[0] ? { 'gratitude 1': { rich_text: richText(g[0]) } } : {}),
            ...(g[1] ? { 'gratitude 2': { rich_text: richText(g[1]) } } : {}),
            ...(g[2] ? { 'gratitude 3': { rich_text: richText(g[2]) } } : {}),
            ...(prayer ? { prayer: { rich_text: richText(prayer) } } : {}),
            ...(oneWord ? { 'one word': { rich_text: richText(oneWord) } } : {}),
          },
        }),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, page: res }) };
    }


    // ── GET TASKS (Tasks database) ──
    if (view === 'get_tasks') {
      const res = await notionFetch(`/data_sources/${DATABASES.tasks}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 100 }),
      });
      const tasks = (res.results || []).map(page => {
        const p = page.properties;
        return {
          id: page.id,
          name: p.Task?.title?.[0]?.plain_text || '',
          status: p.Status?.select?.name || 'Brain Dump',
          due_on: p['Due date']?.date?.start || null,
          notes: p.Notes?.rich_text?.[0]?.plain_text || '',
          done: p.Done?.checkbox || false,
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ tasks }) };
    }

    // ── ADD TASK (Tasks database) ──
    if (view === 'add_task' && method === 'POST') {
      const { name, status, notes, due_on } = body;
      const res = await notionFetch('/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { data_source_id: DATABASES.tasks },
          properties: {
            Task: { title: richText(name) },
            Status: { select: { name: status || 'Brain Dump' } },
            ...(notes ? { Notes: { rich_text: richText(notes) } } : {}),
            ...(due_on ? { 'Due date': { date: { start: due_on } } } : {}),
          },
        }),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, page: res }) };
    }

    // ── UPDATE TASK (move status, mark done) ──
    if (view === 'update_task' && method === 'POST') {
      const { page_id, status, done, due_on } = body;
      const properties = {};
      if (status) properties['Status'] = { select: { name: status } };
      if (typeof done === 'boolean') properties['Done'] = { checkbox: done };
      if (due_on) properties['Due date'] = { date: { start: due_on } };
      await notionFetch(`/pages/${page_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }


    // ── GET CONTENT CALENDAR (combined RO_SUBSTACK + Podcast & Lives, by date) ──
    if (view === 'get_content_calendar') {
      const [contentRes, podcastRes] = await Promise.all([
        notionFetch(`/data_sources/${DATABASES.content}/query`, {
          method: 'POST',
          body: JSON.stringify({ page_size: 100 }),
        }),
        notionFetch(`/data_sources/${DATABASES.podcast}/query`, {
          method: 'POST',
          body: JSON.stringify({ page_size: 100 }),
        }),
      ]);

      const contentItems = (contentRes.results || [])
        .map(page => {
          const p = page.properties;
          return {
            id: page.id,
            name: p.Name?.title?.[0]?.plain_text || '',
            date: p['post date']?.rich_text?.[0]?.plain_text || p['post date']?.date?.start || null,
            status: p.Status?.select?.name || p['Section/Column']?.select?.name || '',
            type: p.type?.select?.name || '',
            source: 'Substack',
          };
        })
        .filter(t => t.date && ['Ready', 'Scheduled', 'Published'].includes(t.status));

      const podcastItems = (podcastRes.results || [])
        .map(page => {
          const p = page.properties;
          return {
            id: page.id,
            name: p['Episode title']?.title?.[0]?.plain_text || '',
            date: p['Publish date']?.date?.start || null,
            status: p.Status?.select?.name || '',
            type: p.Type?.select?.name || '',
            source: 'Podcast',
          };
        })
        .filter(t => t.date && ['Ready', 'Published'].includes(t.status));

      const combined = [...contentItems, ...podcastItems].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      return { statusCode: 200, headers, body: JSON.stringify({ items: combined }) };
    }


    // ── GET PIPELINE BOARD (RO_SUBSTACK grouped by Status) ──
    if (view === 'get_pipeline_board') {
      const res = await notionFetch(`/data_sources/${DATABASES.content}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 100 }),
      });
      const columns = { Idea: [], Drafting: [], 'On the Burner': [], Ready: [], Published: [], Archived: [] };
      (res.results || []).forEach(page => {
        const p = page.properties;
        const status = p.Status?.select?.name || p['Section/Column']?.select?.name;
        if (!columns[status]) return;
        columns[status].push({
          id: page.id,
          name: p.Name?.title?.[0]?.plain_text || '',
          due_on: p['post date']?.rich_text?.[0]?.plain_text || null,
          type: p.type?.select?.name || '',
        });
      });
      return { statusCode: 200, headers, body: JSON.stringify({ columns }) };
    }

    // ── UPDATE PIPELINE STATUS ──
    if (view === 'update_pipeline_status' && method === 'POST') {
      const { page_id, status, due_on } = body;
      const properties = {};
      if (status) properties['Status'] = { select: { name: status } };
      if (due_on) properties['post date'] = { rich_text: richText(due_on) };
      await notionFetch(`/pages/${page_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // ── ADD PIPELINE ITEM ──
    if (view === 'add_pipeline_item' && method === 'POST') {
      const { name, type, status } = body;
      const res = await notionFetch('/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { data_source_id: DATABASES.content },
          properties: {
            Name: { title: richText(name) },
            Status: { select: { name: status || 'Idea' } },
            ...(type ? { type: { select: { name: type } } } : {}),
          },
        }),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, page: res }) };
    }

    // ── PODCAST & LIVES COUNTS ──
    if (view === 'podcast_lives_counts') {
      const res = await notionFetch(`/data_sources/${DATABASES.podcast}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 100 }),
      });
      const counts = { ideas: 0, ready: 0, posted: 0 };
      (res.results || []).forEach(page => {
        const status = page.properties?.Status?.select?.name || '';
        if (status === 'Idea') counts.ideas++;
        else if (status === 'Ready') counts.ready++;
        else if (status === 'Published') counts.posted++;
      });
      return { statusCode: 200, headers, body: JSON.stringify(counts) };
    }

    // ── PINTEREST BOARD ──
    if (view === 'ro_pinterest') {
      const res = await notionFetch(`/data_sources/${DATABASES.pinterest}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 100 }),
      });
      const columns = { idea: [], 'design ready': [], scheduled: [], live: [] };
      (res.results || []).forEach(page => {
        const p = page.properties;
        const status = (p.Status?.select?.name || '').toLowerCase();
        const name = p.Name?.title?.[0]?.plain_text || p['Pin name']?.title?.[0]?.plain_text || '';
        if (columns[status]) columns[status].push({ id: page.id, name });
      });
      return { statusCode: 200, headers, body: JSON.stringify({ columns }) };
    }

    // ── PUBLISHING THIS WEEK (RO_SUBSTACK items with dates this week) ──
    if (view === 'publishing_this_week') {
      const res = await notionFetch(`/data_sources/${DATABASES.content}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 100 }),
      });
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
      const ws = weekStart.toISOString().slice(0,10);
      const we = weekEnd.toISOString().slice(0,10);
      const items = (res.results || []).filter(page => {
        const p = page.properties;
        const status = p.Status?.select?.name || p['Section/Column']?.select?.name || '';
        const date = p['post date']?.rich_text?.[0]?.plain_text || p['post date']?.date?.start || '';
        return date >= ws && date < we && ['Ready', 'Published'].includes(status);
      }).map(page => {
        const p = page.properties;
        return {
          id: page.id,
          name: p.Name?.title?.[0]?.plain_text || '',
          date: p['post date']?.rich_text?.[0]?.plain_text || '',
          type: p.type?.select?.name || '',
          status: p.Status?.select?.name || p['Section/Column']?.select?.name || '',
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ items }) };
    }

    // ── IN PROGRESS CONTENT (Drafting / On the Burner) ──
    if (view === 'in_progress_content') {
      const res = await notionFetch(`/data_sources/${DATABASES.content}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 100 }),
      });
      const items = (res.results || []).filter(page => {
        const status = page.properties?.Status?.select?.name || page.properties?.['Section/Column']?.select?.name || '';
        return ['Drafting', 'On the Burner'].includes(status);
      }).map(page => {
        const p = page.properties;
        return {
          id: page.id,
          name: p.Name?.title?.[0]?.plain_text || '',
          type: p.type?.select?.name || '',
          status: p.Status?.select?.name || p['Section/Column']?.select?.name || '',
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ items }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown view' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
