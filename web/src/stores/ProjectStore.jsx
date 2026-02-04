import { makeAutoObservable, runInAction } from "mobx";

class ProjectStore {
  projects = [];
  queue = [];
  currentProject = null;
  queueMeta = null;
  currentQueueName = "todo";

  currentSessionId = null;
  currentStartTime = null;

  timerState = {
    timeLeft: 0,
    originalDuration: 0,
    paused: true,
    startTime: null,
    activeProjectId: null,
    maxDuration: 0, // Maximum allowed duration for this timer
  };
  timerInterval = null;
  autoSaveInterval = null;

  forcePlay = false;
  forcePlayDuration = null;

  constructor() {
    makeAutoObservable(this);
    this.tick = this.tick.bind(this);
    this.playNotificationSound = this.playNotificationSound.bind(this);
    this.motivationStart = JSON.parse(localStorage.getItem('motivationStart')) || null;
  }

  playNotificationSound() {
    const audio = new Audio('/galo.wav');
    audio.play();
  }

  startIntervals() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(this.tick, 250);

    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(() => {
      this.endSession(true);
    }, 60000);
  }

  stopIntervals() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  tick() {
    if (this.timerState.paused || !this.timerState.startTime) {
      return;
    }

    const elapsed = Date.now() - this.timerState.startTime;
    const newTimeLeft = Math.max(this.timerState.originalDuration - elapsed, 0);

    runInAction(() => {
      this.timerState.timeLeft = newTimeLeft;
    });

    // Check if we've reached the maximum allowed duration
    if (elapsed >= this.timerState.maxDuration) {
      console.log("Timer finished for project", this.timerState.activeProjectId);
      this.playNotificationSound();
      this.pauseTimer();
    }
  }

  startTimer(projectId, duration, maxDuration = duration) {
    if (this.currentSessionId) {
      this.endSession();
    }
    this.startSession(projectId);

    runInAction(() => {
      this.timerState = {
        timeLeft: duration,
        originalDuration: duration,
        paused: false,
        startTime: Date.now(),
        activeProjectId: projectId,
        maxDuration: maxDuration,
      };
      this.startIntervals();
    });
  }


  pauseTimer() {
    this.stopIntervals();

    if (this.currentSessionId) {
      this.endSession();
    }

    runInAction(() => {
      if (!this.timerState.paused) {
        this.timerState.paused = true;
        const elapsed = Date.now() - this.timerState.startTime;
        this.timerState.timeLeft = Math.max(this.timerState.originalDuration - elapsed, 0);
      }
    });
  }

  resumeTimer() {
    const { activeProjectId, timeLeft, originalDuration } = this.timerState;
    if (!activeProjectId || timeLeft <= 0) return;

    this.startSession(activeProjectId);

    runInAction(() => {
      const elapsed = originalDuration - timeLeft;
      this.timerState.startTime = Date.now() - elapsed;
      this.timerState.paused = false;
      this.startIntervals();
    });
  }


  toggleTimer(projectId, duration = null) {
    const isSameProject = this.timerState.activeProjectId === projectId;

    if (this.timerState.paused) {
      if (isSameProject && this.timerState.timeLeft > 0) {
        // If resuming same project, and a new limit is provided, update original/max and recompute timeLeft
        if (duration) {
          const elapsed = this.timerState.originalDuration - this.timerState.timeLeft;
          this.timerState.originalDuration = duration;
          this.timerState.maxDuration = duration;
          this.timerState.timeLeft = Math.max(duration - elapsed, 0);
        }
        this.resumeTimer();
      } else {
        // New timer (same project with no remaining time or different project)
        const timerDuration = duration || this.getRandomTaskTime();
        this.startTimer(projectId, timerDuration, timerDuration);
      }
    } else {
      if (isSameProject) {
        // Running same project -> pause
        this.pauseTimer();
      } else {
        // Switch project -> pause current and start new
        this.pauseTimer();
        const timerDuration = duration || this.getRandomTaskTime();
        this.startTimer(projectId, timerDuration, timerDuration);
      }
    }
  }
  setTimerLimit(limitMs) {
    runInAction(() => {
      const { startTime, paused, originalDuration, timeLeft } = this.timerState;
      let elapsed = 0;

      if (startTime) {
        if (paused) {
          // While paused, timeLeft reflects remaining time; derive elapsed from it
          elapsed = Math.max(originalDuration - timeLeft, 0);
        } else {
          // While running, compute elapsed from startTime
          elapsed = Math.max(Date.now() - startTime, 0);
        }
      }

      // Apply new limit and recompute remaining time preserving elapsed
      this.timerState.originalDuration = limitMs;
      this.timerState.maxDuration = limitMs;
      this.timerState.timeLeft = Math.max(limitMs - elapsed, 0);

      // Keep continuity for running timer
      if (!paused && startTime) {
        this.timerState.startTime = Date.now() - elapsed;
      }
    });
  }

  getTimerStateForProject(projectId) {
    return this.timerState.activeProjectId === projectId ? this.timerState : {
      timeLeft: 0,
      originalDuration: 0,
      paused: true,
      startTime: null,
      activeProjectId: null
    };
  }

  getTotalQueuePotential() {
    return this.queue.reduce((sum, project) => sum + (project.potential || 0), 0);
  }

  getProjectPotentialPercentage(projectId) {
    const total = this.getTotalQueuePotential();
    if (total === 0) return 0;
    const project = this.queue.find(p => p.id === projectId);
    if (!project) return 0;
    return ((project.potential || 0) / total) * 100;
  }

  async fetchProjects() {
    this.loadingProjects = true;
    try {
      const baseUrl = import.meta.env.VITE_API_URL;

      const [res, statsRes] = await Promise.all([
        fetch(`${baseUrl}/api/projects`),
        fetch(`${baseUrl}/api/project_stats`),
      ]);

      const projects = await res.json();
      const stats = await statsRes.json();

      const enriched = projects.map((project) => {
        const stat = stats.find((s) => s.project_id === project.id) || {};

        return {
          ...project,
          timeToday: stat.timeToday || 0,
          timeThisWeek: stat.timeThisWeek || 0,
          timeThisMonth: stat.timeThisMonth || 0,
          timeTotal: stat.timeTotal || 0,
        };
      });

      runInAction(() => {
        this.projects = enriched;
        this.loadingProjects = false;
      });
    } catch (err) {
      console.error("Erro ao buscar projetos:", err);
      runInAction(() => {
        this.loadingProjects = false;
      });
    }
  }

  async fetchQueue(name = this.currentQueueName) {
    this.loadingQueue = true;
    try {
      const baseUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${baseUrl}/api/queues/${name}/projects`);
      const data = await res.json();

      console.log('[QUEUE] Raw data received:', JSON.stringify(data, null, 2));
      console.log('[QUEUE] First project keys:', Object.keys(data.projects?.[0] || {}));
      
      // Preserve any previously fetched task trees to avoid flicker and extra fetches
      const prevQueue = this.queue || [];
      let mergedProjects = (data.projects || []).map(p => {
        const prev = prevQueue.find(q => q.id === p.id);
        if (prev && prev.tasks?.tree) {
          return {
            ...p,
            tasks: {
              ...p.tasks,
              tree: prev.tasks.tree
            }
          };
        }
        return p;
      });

      runInAction(() => {
        this.queue = mergedProjects;
        this.currentProject = this.queue.length > 0 ? this.queue[0] : null;
        this.queueMeta = {
          id: data.id,
          name: data.name,
          project_ids: data.project_ids,
        };
        this.currentQueueName = name;
        this.loadingQueue = false;
      });

      // Log ranking information to console
      if (mergedProjects.length > 0) {
        console.log('[QUEUE] Projects sorted by potential:');
        mergedProjects.forEach((p, idx) => {
          console.log(`  #${idx + 1} "${p.name}": potential=${p.potential?.toFixed(2) || 'N/A'}, velocity=${p.velocity?.toFixed(2) || 'N/A'}, rank=${p.rank || 'N/A'}`);
        });
      }

      // Ensure the queue is sorted by potential on every fetch
      // The server already sorts by potential, so we just use the received order
    } catch (err) {
      console.error("Erro ao buscar queue:", err);
      runInAction(() => {
        this.loadingQueue = false;
      });
    }
  }

  getRandomTaskTime = () => {
    return 60 * 60 * 1000;
  }

  async startSession(projectId) {
    const baseUrl = import.meta.env.VITE_API_URL;
    const startTime = new Date().toISOString();

    try {
      const res = await fetch(`${baseUrl}/api/project_sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          start_counter: startTime,
        }),
      });

      const data = await res.json();

      runInAction(() => {
        this.currentSessionId = data.id;
        this.currentStartTime = startTime;
      });
    } catch (err) {
      console.error("Erro ao iniciar sessão:", err);
    }
  }

  async endSession(update = false) {
    if (!this.currentSessionId) return;

    const baseUrl = import.meta.env.VITE_API_URL;
    const endTime = new Date().toISOString();

    try {
      await fetch(`${baseUrl}/api/project_sessions/${this.currentSessionId}/end`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ end_counter: endTime }),
      });

      if (!update) {
        runInAction(() => {
          this.currentSessionId = null;
          this.currentStartTime = null;
        });
      }
    } catch (err) {
      console.error("Erro ao terminar sessão:", err);
    }
  }

  async saveProject(project) {
    const baseUrl = import.meta.env.VITE_API_URL;
    try {
      const endpoint = project.id
        ? `${baseUrl}/api/projects/${project.id}`
        : `${baseUrl}/api/projects`;

      await fetch(endpoint, {
        method: project.id ? 'PUT' : 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });

      await this.fetchProjects();
      if (this.queueMeta) {
        await this.fetchQueue(this.queueMeta.name);
      }
    } catch (err) {
      console.error("Erro ao salvar projeto:", err);
    }
  }

  async saveQueue(projectIds) {
    if (!this.queueMeta) return;

    try {
      const baseUrl = import.meta.env.VITE_API_URL;
      await fetch(`${baseUrl}/api/queues/${this.queueMeta.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_ids: projectIds }),
        });

      runInAction(() => {
        this.queueMeta.project_ids = projectIds;
      });
    } catch (err) {
      console.error("Erro ao salvar queue:", err);
    }
  }

  async switchQueue(name) {
    if (this.currentQueueName !== name) {
      await this.fetchQueue(name);
    }
  }

  findLeftmostOpenLeafTask(tasks) {
    if (!tasks || tasks.length === 0) return null;

    // Ordenar tarefas pela ordem (assumindo que tasks já vêm ordenadas do servidor)
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

    for (const task of sortedTasks) {
      if (task.completed || task.is_recurring) continue;

      // Se não tem subtarefas ou todas as subtarefas estão completas, é folha
      if (!task.subtasks || task.subtasks.length === 0) {
        return task;
      }

      // Verificar se tem subtarefas abertas (qualquer tipo)
      const hasOpenSubtasks = task.subtasks.some(sub => !sub.completed);
      if (!hasOpenSubtasks) {
        return task;
      }

      // Descer recursivamente
      const leafTask = this.findLeftmostOpenLeafTask(task.subtasks);
      if (leafTask) {
        return leafTask;
      }
    }

    return null;
  }

  getTaskPath(task, allTasks) {
    const path = [];
    let currentTask = task;

    while (currentTask) {
      path.unshift(currentTask.title);
      currentTask = allTasks.find(t => t.id === currentTask.parent_id);
    }

    // Remove first (project name) and last (task title) elements
    if (path.length > 2) {
      return path.slice(1, -1).join(' → ');
    } else if (path.length === 2) {
      return path.slice(1).join(' → '); // Remove only first if only 2 elements
    }

    return ''; // Return empty if only 1 element (root task)
  }

  getTodoItems() {
    return this.queue.map(project => {
      const task = this.findLeftmostOpenLeafTask(project.tasks?.tree || []);
      if (task) {
        // Flatten all tasks from the tree to build the path
        const allTasks = this.flattenTaskTree(project.tasks?.tree || []);
        const path = this.getTaskPath(task, allTasks);
        return { project, task, path };
      }
      return null;
    }).filter(Boolean);
  }

  flattenTaskTree(tasks) {
    const result = [];
    const traverse = (taskList) => {
      for (const task of taskList) {
        result.push(task);
        if (task.subtasks && task.subtasks.length > 0) {
          traverse(task.subtasks);
        }
      }
    };
    traverse(tasks);
    return result;
  }

  async fetchProjectTasks(projectId) {
    try {
      const baseUrl = import.meta.env.VITE_API_URL;
      const response = await fetch(`${baseUrl}/api/tasks/project/${projectId}`);
      const taskTree = await response.json();

      // Update the project in the queue with the task tree
      runInAction(() => {
        const project = this.queue.find(p => p.id === projectId);
        if (project) {
          project.tasks = {
            ...project.tasks,
            tree: [taskTree] // The API returns the root task with subtasks
          };
        }
      });

      return taskTree;
    } catch (err) {
      console.error('Erro ao buscar tarefas do projeto:', err);
      return null;
    }
  }

  async playProject(projectId, duration = null) {
    const projectIndex = this.queue.findIndex(p => p.id === projectId);

    if (projectIndex < 0) return;

    if (this.currentSessionId) {
      this.pauseTimer();
    }

    // Se o projeto já é o primeiro, apenas inicia o timer
    if (projectIndex === 0) {
        this.toggleTimer(projectId, duration);
        return;
    }

    const project = this.queue[projectIndex];
    const newQueue = [
      project,
      ...this.queue.slice(0, projectIndex),
      ...this.queue.slice(projectIndex + 1),
    ];

    this.queue = newQueue;
    this.currentProject = newQueue[0];
    this.saveQueue(newQueue.map(p => p.id));
    // Força o play no useEffect do card com a duração correta (1h default se não vier)
    this.forcePlay = true;
    this.forcePlayDuration = duration || this.getRandomTaskTime();
  }

  async changeProjectState(projectId, newState) {
    const baseUrl = import.meta.env.VITE_API_URL;
    try {
      await fetch(`${baseUrl}/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      });

      runInAction(() => {
        const project = this.projects.find(p => p.id === projectId);
        if (project) {
          project.state = newState;
        }
      });
    } catch (err) {
      console.error("Erro ao mudar estado do projeto:", err);
    }
  }

  async deleteProject(projectId) {
    const baseUrl = import.meta.env.VITE_API_URL;
    try {
      const response = await fetch(`${baseUrl}/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        runInAction(() => {
          this.projects = this.projects.filter(p => p.id !== projectId);
          this.queue = this.queue.filter(p => p.id !== projectId);
        });
      } else {
        throw new Error('Erro ao apagar projeto');
      }
    } catch (err) {
      console.error("Erro ao apagar projeto:", err);
      throw err;
    }
  }

  async fetchProjectsWithoutVision() {
    try {
      const baseUrl = import.meta.env.VITE_API_URL;
      const response = await fetch(`${baseUrl}/api/projects/without-vision`);
      const projects = await response.json();
      
      runInAction(() => {
        this.projectsWithoutVision = projects;
      });
      
      return projects;
    } catch (err) {
      console.error("Erro ao buscar projetos sem visão:", err);
      return [];
    }
  }
}

export const projectStore = new ProjectStore();
