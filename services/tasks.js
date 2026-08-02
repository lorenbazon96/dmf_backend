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
  return projectStatus === "in-progress" && ["start", "pause", "resume", "complete"].includes(action);
}

export function nextRevision(revision) {
  return revision + 1;
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
