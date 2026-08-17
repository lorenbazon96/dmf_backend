export const taskTransitions = Object.freeze({
  pending: ["in-progress"],
  "in-progress": ["paused", "completed"],
  paused: ["in-progress"],
  completed: [],
});

export function canTransitionTask(from, to) {
  return (taskTransitions[from] || []).includes(to);
}

export function projectAllowsTaskAction(projectStatus, action) {
  return projectStatus === "in-progress" && ["pause", "resume", "complete"].includes(action);
}

export function nextRevision(revision) {
  return revision + 1;
}

export function hasRequiredWorker(drawings = []) {
  const productionDrawings = drawings.filter(drawing => !drawing.isAssemblyDrawing);
  return productionDrawings.every(drawing => (drawing.assignedWorkers || []).some(task => task.workerId));
}

export function findTask(project, taskId) {
  for (const drawing of project.drawings || []) {
    const task = (drawing.assignedWorkers || []).find(item => String(item._id) === String(taskId));
    if (task) return { drawing, task };
  }
  return null;
}

export function elapsedMinutes(task, now) {
  if (!task.startedAt) return 0;
  const paused = (task.totalPausedMs || 0) + (task.pausedAt ? now.getTime() - new Date(task.pausedAt).getTime() : 0);
  return Math.max(0, Math.round((now.getTime() - new Date(task.startedAt).getTime() - paused) / 60000));
}

const operationPhases = [
  ["Rezanje cijevi", "Rezanje lima", "Pipe cutting", "Sheet cutting"],
  ["Savijanje", "Bušenje", "Bending", "Drilling"],
  ["Montaža", "Assembly"],
  ["Zavarivanje", "Welding"],
  ["Brušenje", "Grinding"],
];

export function operationPhase(operation) {
  const phase = operationPhases.findIndex(items => items.includes(operation));
  return phase === -1 ? operationPhases.length : phase;
}

export function taskCanStart(drawing, task) {
  const phase = operationPhase(task.operation);
  return (drawing.assignedWorkers || []).every(other =>
    operationPhase(other.operation) >= phase || other.status === "completed"
  );
}

export function activateAvailableTasks(projects, now, actorUserId) {
  const changed = new Set();
  const busyWorkers = new Set();
  for (const project of projects) {
    if (project.status !== "in-progress") continue;
    for (const drawing of project.drawings || []) {
      for (const task of drawing.assignedWorkers || []) {
        const reservesWorker = task.status === "in-progress" || (task.status === "paused" && !task.pausedByProject);
        if (reservesWorker && task.workerId) busyWorkers.add(String(task.workerId));
      }
    }
  }

  const ordered = [...projects].sort((a, b) =>
    new Date(a.startedAt || a.createdAt || 0) - new Date(b.startedAt || b.createdAt || 0)
  );
  for (const project of ordered) {
    if (project.status !== "in-progress") continue;
    for (const drawing of project.drawings || []) {
      for (const task of drawing.assignedWorkers || []) {
        const resumesWithProject = task.status === "paused" && task.pausedByProject;
        if (task.status !== "pending" && !resumesWithProject) continue;
        if (!resumesWithProject && !taskCanStart(drawing, task)) continue;
        const workerId = String(task.workerId || "");
        if (!workerId || busyWorkers.has(workerId)) continue;

        const from = task.status;
        task.status = "in-progress";
        if (resumesWithProject) {
          task.totalPausedMs = (task.totalPausedMs || 0) + (task.pausedAt ? now - new Date(task.pausedAt) : 0);
          task.pausedAt = null;
          task.pausedByProject = false;
        } else {
          task.startedAt = now;
          task.pausedAt = null;
        }
        task.history ||= [];
        task.history.push({ from, to:"in-progress", at:now, actorUserId, reason:resumesWithProject ? "project-resumed" : "auto-start" });
        busyWorkers.add(workerId);
        changed.add(project);
      }
    }
  }
  return changed;
}
