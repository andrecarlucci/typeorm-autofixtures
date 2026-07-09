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
import Team from "./schema-task-tracking/team.entity";
import { TeamSchema } from "./schema-task-tracking/team.schema";
import Company from "./schema-task-tracking/company.entity";
import { CompanySchema } from "./schema-task-tracking/company.schema";
import Product from "./schema-task-tracking/product.entity";
import { ProductSchema } from "./schema-task-tracking/product.schema";
import Position from "./schema-task-tracking/position.entity";
import { PositionSchema } from "./schema-task-tracking/position.schema";

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
  const schemas = [
    ProjectSchema,
    TaskSchema,
    UserSchema,
    UserProfileSchema,
    TeamSchema,
    CompanySchema,
    ProductSchema,
    PositionSchema,
  ];

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

  describe("When creating a Team", () => {
    it("Uses UUID suffix for column-level unique (name)", async () => {
      const team = await fixture.create(Team);
      expect(team.name).toBeDefined();
      expect(team.name).toMatch(/^name\d+-[0-9a-f]{8}$/);
    });

    it("Uses UUID suffix for entity-level unique (code)", async () => {
      const team = await fixture.create(Team);
      expect(team.code).toBeDefined();
      expect(team.code).toMatch(/-[0-9a-f]+$/);
    });

    it("Uses counter suffix for non-unique column (description)", async () => {
      const team = await fixture.create(Team);
      expect(team.description).toBeDefined();
      expect(team.description).toMatch(/^description\d+-[0-9a-z]+$/);
      expect(team.description).not.toMatch(/-[0-9a-f]{8}$/);
    });

    it("Respects max length for code (varchar 15)", async () => {
      const team = await fixture.create(Team);
      expect(team.code.length).toBeLessThanOrEqual(15);
    });

    it("Two teams have different unique values", async () => {
      const team1 = await fixture.create(Team);
      const team2 = await fixture.create(Team);
      expect(team1.name).not.toBe(team2.name);
      expect(team1.code).not.toBe(team2.code);
    });

    it("Provided values override generated ones", async () => {
      const team = await fixture.create(Team, { name: "MyTeam", code: "MT" });
      expect(team.name).toBe("MyTeam");
      expect(team.code).toBe("MT");
    });
  });

  describe("When property name differs from column name", () => {
    it("Auto-generates value for private property with column name mapping", async () => {
      const company = await fixture.create(Company);
      expect(company.id).toBeDefined();
      expect(company._name).toBeDefined();
    });

    it("Resolves override by database column name", async () => {
      const company = await fixture.create(Company, { name: "Acme Corp" } as any);
      expect(company._name).toBe("Acme Corp");
    });

    it("Resolves override by direct property name", async () => {
      const company = await fixture.create(Company, { _name: "Direct Corp" });
      expect(company._name).toBe("Direct Corp");
    });

    it("Property name takes priority over column name", async () => {
      const company = await fixture.create(Company, { _name: "ByProperty", name: "ByColumn" } as any);
      expect(company._name).toBe("ByProperty");
    });
  });

  describe("When entity uses getter/setter with private backing field", () => {
    it("Auto-generates value for private backing field", async () => {
      const product = await fixture.create(Product);
      expect(product.id).toBeDefined();
      expect(product._title).toBeDefined();
    });

    it("Resolves override through setter name", async () => {
      const product = await fixture.create(Product, { title: "My Product" } as any);
      expect(product._title).toBe("My Product");
    });

    it("Resolves override by direct property name", async () => {
      const product = await fixture.create(Product, { _title: "Direct Product" });
      expect(product._title).toBe("Direct Product");
    });

    it("Property name takes priority over setter name", async () => {
      const product = await fixture.create(Product, { title: "BySetter", _title: "ByProperty" } as any);
      expect(product._title).toBe("ByProperty");
    });
  });

  describe("fixture.getOrCreate(type, where, extras)", () => {
    it("Creates a new entity when none matches", async () => {
      const team = await fixture.getOrCreate(Team, { name: "QA" });
      expect(team.id).toBeDefined();
      expect(team.name).toBe("QA");
    });

    it("Returns the existing entity when one matches (by scalar)", async () => {
      const first = await fixture.getOrCreate(Team, { name: "QA" });
      const second = await fixture.getOrCreate(Team, { name: "QA" });
      expect(second.id).toBe(first.id);

      const count = await repository.getRepository(Team).count();
      expect(count).toBe(1);
    });

    it("Applies extras only when creating", async () => {
      const created = await fixture.getOrCreate(Team, { name: "QA" }, { code: "QA-1" });
      expect(created.code).toBe("QA-1");

      // Existing row is returned untouched; extras are ignored on the hit path.
      const found = await fixture.getOrCreate(Team, { name: "QA" }, { code: "QA-2" });
      expect(found.id).toBe(created.id);
      expect(found.code).toBe("QA-1");
    });

    it("Find-or-creates a child scoped to a relation (extras carries the real entity)", async () => {
      const company = await fixture.create(Company);

      const first = await fixture.getOrCreate(
        Position,
        { company: { id: company.id }, name: "Engineer" },
        { company },
      );
      const second = await fixture.getOrCreate(
        Position,
        { company: { id: company.id }, name: "Engineer" },
        { company },
      );

      expect(second.id).toBe(first.id);
      expect(first.companyId).toBe(company.id);
      const count = await repository.getRepository(Position).count();
      expect(count).toBe(1);
    });

    it("Creates distinct rows for the same name in different companies", async () => {
      const companyA = await fixture.create(Company);
      const companyB = await fixture.create(Company);

      const a = await fixture.getOrCreate(Position, { company: { id: companyA.id }, name: "Engineer" }, { company: companyA });
      const b = await fixture.getOrCreate(Position, { company: { id: companyB.id }, name: "Engineer" }, { company: companyB });

      expect(a.id).not.toBe(b.id);
      expect(a.companyId).toBe(companyA.id);
      expect(b.companyId).toBe(companyB.id);
    });

    it("Places the returned entity in the context for later reuse", async () => {
      const company = await fixture.create(Company);
      const existing = await fixture.getOrCreate(Position, { company: { id: company.id }, name: "Engineer" }, { company });

      // A subsequent Position create reuses the company from context (last-created reuse).
      const another = await fixture.create(Position);
      expect(another.companyId).toBe(company.id);
      expect(existing.companyId).toBe(company.id);
    });
  });

  describe("When creating a Position (composite unique)", () => {
    it("Uses UUID suffix for column in composite @Unique([companyId, name])", async () => {
      const company = await fixture.create(Company);
      const position = await fixture.create(Position, { company });
      expect(position.name).toMatch(/^name\d+-[0-9a-f]{8}$/);
    });

    it("Uses UUID suffix for column in composite unique index ([companyId, title])", async () => {
      const company = await fixture.create(Company);
      const position = await fixture.create(Position, { company });
      expect(position.title).toMatch(/^title\d+-[0-9a-f]{8}$/);
    });

    it("Two positions in the same company get distinct values and both save", async () => {
      const company = await fixture.create(Company);
      const a = await fixture.create(Position, { company });
      const b = await fixture.create(Position, { company });
      expect(a.name).not.toBe(b.name);
      expect(a.title).not.toBe(b.title);
      expect(a.companyId).toBe(b.companyId);
    });

    it("Provided values override generated ones", async () => {
      const company = await fixture.create(Company);
      const position = await fixture.create(Position, { company, name: "Engineer", title: "Senior" });
      expect(position.name).toBe("Engineer");
      expect(position.title).toBe("Senior");
    });
  });
});
