import { EntityManager } from "typeorm";
import { Fixture } from "../src/fixture";
import Database from "./database";
import Project from "./schema-task-tracking/project.entity";
import { ProjectSchema } from "./schema-task-tracking/project.schema";
import Task from "./schema-task-tracking/task.entity";
import { TaskSchema } from "./schema-task-tracking/task.schema";
import User from "./schema-task-tracking/user.entity";
import { UserSchema } from "./schema-task-tracking/user.schema";
import UserProfile from "./schema-task-tracking/user-profile.entity";
import { ProfileSchema as UserProfileSchema } from "./schema-task-tracking/user-profile.schema";

/**
 * Rules to decide when to create relations:
   - Only create relations that are "Not Null"
   - One-to-One: create only if not owner
   - Many-to-One: always create
   - One-to-Many: never create
   - Many-to-Many: never create

   *Owner: side of the relation with join column (Many-to-Many or One-to-One)
 */

describe("task-tracking fixture tests", () => {
  const schemas = [ProjectSchema, TaskSchema, UserSchema, UserProfileSchema];

  let database: Database;
  let fixture: Fixture;
  let repository: EntityManager;

  beforeAll(async () => {
    database = new Database(schemas);
    await database.initialize();
  });

  beforeEach(async () => {
    await database.refreshDatabase();
    repository = (await database.getDataSource()).createEntityManager();
    fixture = new Fixture(await database.getDataSource());
    Fixture.IsLogEnabled = true;
  });

  afterAll(async () => {
    await database.destroy();
  });

  describe("When creating a Project", () => {
    /**
     * Project
     * - One-to-Many: has many Tasks: never create
     */
    it("One-to-Many: doesn't create Tasks", async () => {
      const project = await fixture.create(Project);
      expect(project.id).toBeDefined();
      expect(project.tasks).toBeUndefined();
    });
  });

  describe("When creating a Task", () => {
    /**
     * Task
     * - Many-to-One: belongs to Project: always create
     * - Many-to-Many: has many Users: never create
     */
    it("Many-to-One: creates Project", async () => {
      const task = await fixture.create(Task);
      expect(task.id).toBeDefined();
      expect(task.project).toBeDefined();
      expect(task.project.id).toBeDefined();
    });

    it("Many-to-Many: doesn't create Users", async () => {
      const task = await fixture.create(Task);
      expect(task.users).toBeUndefined();
    });
  });

  describe("When creating a User", () => {
    /**
     * User
     * - Many-to-Many: has many Tasks: never create
     * - One-to-One: has one Profile and is not the owner: don't create
     */
    it("Many-to-Many: doesn't create Tasks", async () => {
      const user = await fixture.create(User);
      expect(user.id).toBeDefined();
      expect(user.tasks).toBeUndefined();
    });

    it("One-to-One: doesn't create Profile (inverse side)", async () => {
      const user = await fixture.create(User);
      expect(user.profile).toBeUndefined();
    });
  });

  describe("When creating a UserProfile", () => {
    /**
     * UserProfile
     * - One-to-One: belongs to one User: create (join column is in UserProfile)
     */
    it("One-to-One: creates User (owner side)", async () => {
      const profile = await fixture.create(UserProfile);
      expect(profile.id).toBeDefined();
      expect(profile.user).toBeDefined();
      expect(profile.user.id).toBeDefined();
    });
  });

  describe("When user provides values", () => {
    it("Uses provided Project", async () => {
      const project = await fixture.create(Project);
      const task = await fixture.create(Task, { project });
      expect(task.project).toBe(project);
    });
  });

  describe("Tests for cached objects", () => {
    it("Should reuse project", async () => {
      const task1 = await fixture.create(Task);
      const task2 = await fixture.create(Task);
      expect(task1.project).toBe(task2.project);
    });

    it("Should reset context", async () => {
      const task1 = await fixture.create(Task);
      fixture.resetContext();
      const task2 = await fixture.create(Task);
      expect(task1.project).not.toBe(task2.project);
    });
  });
});
