import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, projectsTable, clientsTable } from "@workspace/db";
import {
  CreateProjectBody,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  UpdateProjectResponse,
  DeleteProjectParams,
  ListProjectsQueryParams,
  ListProjectsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let q = db
    .select({
      id: projectsTable.id,
      title: projectsTable.title,
      description: projectsTable.description,
      status: projectsTable.status,
      projectType: projectsTable.projectType,
      clientId: projectsTable.clientId,
      clientName: clientsTable.name,
      sessionDate: projectsTable.sessionDate,
      location: projectsTable.location,
      price: projectsTable.price,
      notes: projectsTable.notes,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .orderBy(desc(projectsTable.updatedAt))
    .$dynamic();

  const conditions: any[] = [];
  if (query.data.status) {
    conditions.push(eq(projectsTable.status, query.data.status));
  }
  if (query.data.clientId) {
    conditions.push(eq(projectsTable.clientId, query.data.clientId));
  }

  if (conditions.length > 0) {
    for (const condition of conditions) {
      q = q.where(condition) as typeof q;
    }
  }

  const projects = await q;
  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values: any = { ...parsed.data };
  if (values.sessionDate) {
    values.sessionDate = new Date(values.sessionDate);
  }

  const [project] = await db.insert(projectsTable).values(values).returning();

  let clientName: string | null = null;
  if (project.clientId) {
    const [client] = await db
      .select({ name: clientsTable.name })
      .from(clientsTable)
      .where(eq(clientsTable.id, project.clientId));
    clientName = client?.name ?? null;
  }

  res.status(201).json(GetProjectResponse.parse({ ...project, clientName }));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select({
      id: projectsTable.id,
      title: projectsTable.title,
      description: projectsTable.description,
      status: projectsTable.status,
      projectType: projectsTable.projectType,
      clientId: projectsTable.clientId,
      clientName: clientsTable.name,
      sessionDate: projectsTable.sessionDate,
      location: projectsTable.location,
      price: projectsTable.price,
      notes: projectsTable.notes,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(GetProjectResponse.parse(project));
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values: any = { ...parsed.data };
  if (values.sessionDate) {
    values.sessionDate = new Date(values.sessionDate);
  }

  const [project] = await db
    .update(projectsTable)
    .set(values)
    .where(eq(projectsTable.id, params.data.id))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  let clientName: string | null = null;
  if (project.clientId) {
    const [client] = await db
      .select({ name: clientsTable.name })
      .from(clientsTable)
      .where(eq(clientsTable.id, project.clientId));
    clientName = client?.name ?? null;
  }

  res.json(UpdateProjectResponse.parse({ ...project, clientName }));
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, params.data.id))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
