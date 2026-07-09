# typeorm-autofixtures

Automatic fixtures for TypeORM. Speed up creating the database entities you need for your tests.

The fixture object will automatically create and keep track of every entity required to construct the target one. It has an internal context and reuses the last created entity of a given type every time it is required to create a new object.

Requires TypeORM >= 0.3.0.

## Installation

```bash
npm install typeorm-autofixtures
```

## Rules to have in mind

- it only creates non-nullable properties and relations
- for relations
  - One-to-One: create only if not owner*
  - Many-to-One: always create
  - One-to-Many: never create
  - Many-to-Many: never create

*Owner: the side of the relation with a join column (Many-to-Many or One-to-One).

## Simple use

```typescript
import { Fixture } from 'typeorm-autofixtures';

beforeEach(async () => {
    const dataSource = await getDataSource();
    repository = dataSource.createEntityManager();
    fixture = new Fixture(dataSource);
});

it('Creates a Task', async () => {
  const task = await fixture.create(Task);
  expect(task.id).toBeDefined();
  expect(task.project).toBeDefined();
  expect(task.users).toBeUndefined();
});
```

Fixture will:

1. Create the object Task and stub all of its non-nullable properties.
2. Loop through all its properties and relations:
   1. Find MANY-TO-ONE for Task.project -> Project.tasks: Create a Project
   2. Loop through all Project properties and relations:
      1. Find ONE-TO-MANY for Project.tasks -> Task.project: No Action (one-to-many)
   3. Find MANY-TO-MANY for Task.users -> User.tasks: No Action (many-to-many)
3. Returns the Task object populated.

## Using the context

Every time an object is created, it stays in the context.
So, calling methods like this:

```typescript
const task1 = await fixture.create(Task);
const task2 = await fixture.create(Task);
expect(task1.project).toBe(task2.project);
```

Will automatically reuse the previously created Project for both Tasks.

If you don't want this behaviour, just call `fixture.resetContext()` and your next calls will be in a completely different object graph.

```typescript
const task1 = await fixture.create(Task);
fixture.resetContext();
const task2 = await fixture.create(Task);
expect(task1.project).not.toBe(task2.project);
```

## Provide your own values

Every `fixture.create(Type)` accepts a `Partial<Type>` as a parameter where you can specify your own values for the creation of the object.

Ex:
Scalar types:

```typescript
const project = await fixture.create(Project, { name: 'My Project' });
expect(project.name).toBe('My Project');
```

Or objects:

```typescript
const project = await fixture.create(Project);
const task = await fixture.create(Task, { project });
expect(task.project).toBe(project);
```

### Override resolution order

When matching override keys to entity properties, the fixture resolves values in this order:

1. **Property name** — direct match against the TypeORM metadata `propertyName` (e.g., `_name`)
2. **Database column name** — match against `@Column({ name: "..." })` or `EntitySchema` column `name` (e.g., `{ name: "Acme" }` matches property `_name` when `@Column({ name: "name" })` is set)
3. **Setter name** — match against a setter defined on the entity prototype (e.g., `{ title: "My Product" }` matches property `_title` if the class has a `set title(value)` setter)

The first match wins. This means you can use the public-facing name (column name or setter) in your overrides even when the underlying property uses a different name (e.g., prefixed with `_`).

## Batch creation

Use `createMany` to create multiple entities at once:

```typescript
const tasks = await fixture.createMany(5, Task);
expect(tasks).toHaveLength(5);
```

It also accepts optional values applied to every created entity:

```typescript
const tasks = await fixture.createMany(3, Task, { name: 'Bulk Task' });
```

When each entity needs its own values (for example distinct names on a unique column), pass a factory callback that receives the item index instead of a shared object:

```typescript
const people = await fixture.createMany(3, User, (i) => ({ fullName: `Person ${i}` }));
// fullName === 'Person 0', 'Person 1', 'Person 2'
```

## Find-or-create

Use `getOrCreate` to reuse an existing row when one already matches, or create it otherwise. This replaces the hand-rolled find-or-create helpers tests tend to accumulate:

```typescript
// Before
const existing = await repo.findOne({ where: { company: { id: company.id }, level } });
const rank = existing ?? (await repo.save(Rank.create(level, company)));

// After
const rank = await fixture.getOrCreate(Rank, { company: { id: company.id }, level }, { company });
```

The signature is `getOrCreate(Type, where, extras?)`:

- **`where`** — a standard TypeORM find condition used to locate an existing row.
- **`extras`** — creation-only overrides. They are merged over `where` (and win on key collisions) and used **only** when a new entity has to be created. This is where you pass the real relation instances or extra required fields that the find condition expresses by id.

```typescript
// Reuses the same team on the second call — no duplicate row.
const a = await fixture.getOrCreate(Team, { name: 'QA' });
const b = await fixture.getOrCreate(Team, { name: 'QA' });
expect(b.id).toBe(a.id);
```

Whichever path runs, the returned entity is placed in the [context](#using-the-context) like a freshly created one, so later `create` calls can reuse it.

> **Note:** on the find path, `extras` is ignored — an existing row is returned untouched, never updated.

## Nested inline creation of relations

When you override a "belongs to" relation (many-to-one or one-to-one) with a **plain partial object**, the fixture creates that related entity inline using the partial as its overrides. This collapses the usual create-the-parent-then-create-the-child chains into a single call:

```typescript
// Before
const company = await fixture.create(Company, { subdomain: 'acme' });
const user = await fixture.create(User, { fullName: 'Ana' });
const uc = await fixture.create(UserCompany, { user, company, status: 'active' });

// After
const uc = await fixture.create(UserCompany, {
  user: { fullName: 'Ana' },
  company: { subdomain: 'acme' },
  status: 'active',
});
```

The value you pass decides what happens:

| Override value | Behavior |
|---|---|
| A real entity instance (e.g. from a previous `create`) | Used as-is |
| A plain object **carrying the primary key** (e.g. `{ id: 5 }`) | Treated as a reference to an existing row |
| A plain object **without the primary key** (e.g. `{ subdomain: 'acme' }`) | The related entity is **created inline** from the partial |

Nested creation works recursively, so partials can themselves contain partial relations.

## Default values

When creating an entity, non-nullable columns are automatically populated with default values based on their type:

| Column type | Default value |
|---|---|
| `int`, `integer`, `bigint`, `smallint`, `decimal`, `numeric`, `float`, `double`, `real` | `0` |
| `bool`, `boolean` | `false` |
| `date`, `time`, `timestamp`, `datetime` | `new Date(0)` (epoch) |
| `json`, `jsonb` | `{}` |
| `enum` | First enum value |
| `uuid` | Skipped (auto-generated by the database) |
| String types (`varchar`, `text`, etc.) | Generated value (see below) |

## Unique columns

String columns get automatically generated values that respect column length constraints (defaulting to 255 if unspecified).

- **Unique columns** get a random UUID suffix for guaranteed uniqueness: `name1-a3f2b1c0`
- **Non-unique string columns** get a counter-based suffix: `name1-1`

The prefix is built from `{columnName}{index}` and is trimmed as needed so the value always fits within the column's max length.

### Composite unique constraints

Columns that participate in a composite unique constraint (`@Unique([col1, col2])` or `@Index([col1, col2], { unique: true })`) are treated the same as single-column uniques: each participating string column gets the UUID suffix, so two rows sharing the other column (e.g., the same `company_id`) won't collide.

> **Note:** composite uniques are auto-resolved as long as at least one string column participates. If a composite is made up entirely of numeric, enum, or boolean columns (e.g. `@Unique(['companyId', 'rank'])` with `rank: int`), those columns still get their type's default value (`0` for ints) — pass explicit overrides in `fixture.create(...)` to avoid collisions.

## Generating unique values on demand

The automatic uniqueness above only kicks in for columns that have a **database** unique constraint and are **not** overridden. Text columns that need only *app-level* uniqueness (no DB constraint) don't get it — so tests often hand-roll something like:

```typescript
const market = await fixture.create(Market, {
  _name: `Market ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
});
```

Use `fixture.unique(prefix)` instead. It returns a readable, guaranteed-unique string you can drop into any override:

```typescript
const market = await fixture.create(Market, { _name: fixture.unique("Market") });
// market._name === "Market-1-a3f2b1c0"
```

The value has the shape `${prefix}-{counter}-{fragment}`:

- **counter** — a monotonic counter, guaranteeing uniqueness within a single process run.
- **fragment** — a random UUID fragment (8 hex chars by default), guarding against collisions across parallel test workers, each of which starts its own counter.

Pass a second argument to change the fragment length:

```typescript
fixture.unique("Market", 4); // "Market-1-a3f2"
```

## Provided relations echo back

Any relation you pass as an override is guaranteed to come back on the returned instance as the **exact same object reference** you passed in:

```typescript
const company = await fixture.create(Company);
const position = await fixture.create(Position, { company });
expect(position.company).toBe(company); // always true
```

TypeORM's `save` can, on some setups (the owning side of a one-to-one, cascaded relations, subscribers), replace a relation reference with a freshly managed copy — which is why tests sometimes had to re-assign relations by hand (`entity.user = user`) after creating. The fixture re-applies your provided values after saving, so those fixups are no longer needed. Relations created inline from a [partial](#nested-inline-creation-of-relations) keep the entity that was created for them.

## Create / update date column overrides

TypeORM overwrites `@CreateDateColumn` and `@UpdateDateColumn` values with the current time on every insert and update, so passing them as overrides to `create` normally has no effect — the value is lost as soon as the row is saved.

The fixture detects such an override and re-applies it with an explicit follow-up UPDATE, so the value sticks both on the returned instance and in the database. This is handy for controlling ordering or building history in tests:

```typescript
const event = await fixture.create(Event, {
  createdAt: new Date('2020-01-01'),
  updatedAt: new Date('2020-03-01'),
});
// event.createdAt / event.updatedAt hold the provided dates, and so do the persisted columns.
```

## Debug logging

Enable debug logging to see what Fixture is creating:

```typescript
Fixture.IsLogEnabled = true;
```

This is a static property (default `false`). When enabled, creation progress and entity relationships are logged to the console.

You can find many more examples in the [fixture's test](./test/fixture.test.ts) file.
