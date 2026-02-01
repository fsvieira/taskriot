import { v4 as uuidv4 } from 'uuid';

export const createProjectSession = async (req, res) => {
  const db = req.db;
  const { project_id, start_counter } = req.body;

  if (!project_id || !start_counter) {
    return res.status(400).json({ error: "errors.sessions.missingParameters" });
  }

  try {
    const id = uuidv4();
    await db('project_sessions').insert({
      id,
      project_id,
      start_counter,
      end_counter: null,
    });

    res.json({ id, success: true });
  } catch (err) {
    console.error("Erro ao criar sessão:", err);
    res.status(500).json({ error: "errors.internal.createSession" });
  }
};

export const endProjectSession = async (req, res) => {
  const db = req.db;
  const io = req.io;
  const { id } = req.params;
  const { end_counter } = req.body;

  if (!end_counter) {
    return res.status(400).json({ error: "errors.sessions.endCounterRequired" });
  }

  try {
    const updated = await db('project_sessions')
      .where({ id })
      .update({ end_counter });

    if (updated === 0) {
      return res.status(404).json({ error: "errors.sessions.sessionNotFound" });
    }

    // Emit stats update
    io.emit('stats-update');

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao terminar sessão:", err);
    res.status(500).json({ error: "errors.internal.endSession" });
  }
};

export const getSessionsByProject = async (req, res) => {
  const db = req.db;
  const { project_id } = req.params;

  try {
    const rows = await db('project_sessions')
      .select('*')
      .where({ project_id })
      .orderBy('start_counter', 'desc');

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar sessões:", err);
    res.status(500).json({ error: "errors.internal.fetchSessions" });
  }
};