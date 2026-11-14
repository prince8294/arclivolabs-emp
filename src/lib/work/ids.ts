import { randomBytes } from "node:crypto";
import Project from "@/models/Project";
import Task from "@/models/Task";

export async function createProjectId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = `PRJ-${randomBytes(4).toString("hex").toUpperCase()}`;
    if (!(await Project.exists({ projectId: id }))) return id;
  }
  throw new Error("Could not allocate a unique project ID.");
}

export async function createTaskId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = `TSK-${randomBytes(4).toString("hex").toUpperCase()}`;
    if (!(await Task.exists({ taskId: id }))) return id;
  }
  throw new Error("Could not allocate a unique task ID.");
}
