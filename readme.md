# Fixtures

You can use Fixture to speed up creating the database entities you need for your tests.

The fixture object will automatically create and keep track of every entity required to construct the target one. It has an internal context to and reuses the last created entity of a given type every time it is required to create a new object.

## Rules to have in mind

- it only creates non-nullable properties and relations
- for relations
  - One-to-One: create only if not owner
  - Many-to-One: always create
  - One-to-Many: never create
  - Many-to-Many: never create

\*Owner: side of the relation with join column (Many-to-Many or One-to-One)

## Simple use

```
beforeEach(async () => {
    await database.refreshDatabase();
    repository = (await database.getDataSource()).createEntityManager();
    fixture = new Fixture(await database.getDataSource());
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

```
const task1 = await fixture.create(Task);
const task2 = await fixture.create(Task);
expect(task1.project).toBe(task2.project);
```

Will automatically reuse the previously created Project for both Tasks.

If you don't want this behaviour, just call `fixture.resetContext()` and your next calls will be in a completely different object graph.

```
const task1 = await fixture.create(Task);
fixture.resetContext();
const task2 = await fixture.create(Task);
expect(task1.project).not.toBe(task2.project);
```

## Provide your own values

Every `fixture.create(Type)` accepts a `Partial<Type>` as a parameter where you can specify your own values for the creation of the object.

Ex:
Scalar types:

```
const project = await fixture.create(Project, { name: 'My Project' });
expect(project.name).toBe('My Project');
```

Or objects:

```
const project = await fixture.create(Project);
const task = await fixture.create(Task, { project });
expect(task.project).toBe(project);
```

You can find many more examples in the [fixture's test](./test/fixture.test.ts) file.
