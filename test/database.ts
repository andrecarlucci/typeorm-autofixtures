import { DataSource, EntitySchema } from 'typeorm';
import { DataType, IBackup, IMemoryDb, newDb } from 'pg-mem';

export default class Database {
  private readonly db: IMemoryDb;
  private dbBackup?: IBackup;
  private dataSource?: DataSource;
  private readonly schemas: EntitySchema[];

  public constructor(schemas: EntitySchema[]) {
    this.schemas = schemas;

    this.db = newDb({
      autoCreateForeignKeyIndices: true,
    });
    this.db.public.registerFunction({
      implementation: () => 'test',
      name: 'current_database',
    });
    this.db.public.registerFunction({
      name: 'version',
      implementation: () => 'Some version',
    });

    const stringArray = this.db.public.getType('text' as DataType).asArray();
    this.db.public.registerFunction({
      name: 'string_to_array',
      args: [DataType.text, DataType.text],
      returns: stringArray,
      implementation: (str: string, delim: string) => str.split(delim),
    });

    this.db.public.registerOperator({
      operator: '*',
      left: DataType.interval,
      right: DataType.float,
      returns: DataType.interval,
      implementation: (left, right) => {
        if (!left.days) {
          throw new Error(
            'pg-mem (our code): we only support days in intervals. You can add support for other units if needed.',
          );
        }
        const days = left.days * right;
        return { days: days };
      },
    });
  }

  public async initialize() {
    const dataSource = await this.getDataSource();

    if (dataSource.isInitialized) {
      return;
    }

    await dataSource.initialize();
    await dataSource.synchronize();

    this.dbBackup = this.db.backup();
  }

  public async getDataSource(): Promise<DataSource> {
    if (this.dataSource) {
      return this.dataSource;
    }

    try {
      this.dataSource = await this.db.adapters.createTypeormDataSource({
        name: 'default',
        type: 'postgres',
        entities: this.schemas,
        logging: false,
      });
      if (!this.dataSource) {
        throw new Error('DataSource creation returned undefined');
      }
      return this.dataSource;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create DataSource: ${message}`);
    }
  }

  public async destroy() {
    await this.dataSource?.destroy();
  }

  public async refreshDatabase() {
    this.dbBackup?.restore();
  }
}
