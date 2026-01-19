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
    await testManager.refreshDatabase();
    repository = testManager.getEntityManager();
    fixture = new Fixture(testManager.getDataSource());
});

it('Creates an Artist', async () => {
  const artist = await fixture.create(Artist);
  expect(artist.id).toBeDefined();
  expect(artist.profile).toBeUndefined();
});
```

Fixture will:

1. Create the object Artist and stub all of its non-nullable properties.
2. Loop through all its properties:
   1. Find MANY-TO-ONE for Artist.band -> Band.artists: Create a Band
   2. Loop through all Band properties and relations:
      1. Find MANY-TO-ONE for Band.genre -> Genre.bands: Create Genre
      2. Loop through all Genre properties and relations:
         1. Find ONE-TO-MANY for Genre.bands -> Band.genre: Use Provided
         2. This is the invert relation, so it sets the Band in the Genre.bands array
      3. Find ONE-TO-MANY for Band.artists -> Artist.band: Use Provided
      4. This is the invert relation, so it sets the Artist in the Bands.artists array
   3. Find MANY-TO-MANY for Artist.songs -> Song.artists: No Action (many-to-many)
3. Returns the Artist object populated.

## Using the context

Every one object is create, it stays in the context.
So, calling methods like this:

```
const artist = await fixture.create(Artist);
const song1 = await fixture.create(Song);
const song2 = await fixture.create(Song);
```

Will automatically attach the 2 songs in the previously created Artist.

If you don't want this behaviour, just call `fixture.resetContext()` and your next calls will be in completelly different object graph.

## Provide your own values

Every `fixture.create(Type)` accepts a `Partial<Type>` as a parameter where you can specify your own values for the creation of the object.

Ex:
Scalar types:

```
const artist = await fixture.create(Artist, { name: 'A' });
expect(artist.name).toBe('A');
```

Or objects:

```
const genre = await fixture.create(Genre, { name: 'Rock' });
const band = await fixture.create(Band, { name: 'SuperBand', genre });
expect(band.name).toBe('SuperBand');
expect(band.genre).toBe(genre);
expect(band.genre.name).toBe('Rock');
```

You can find many more examples [fixture's test](./fixture.test.ts) file.
