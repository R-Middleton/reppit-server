import { __prod__ } from './constants';
import { Post } from './entities/Post';
import { MikroORM } from '@mikro-orm/core';
import path from 'path';
import { User } from './entities/User';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

export default {
  migrations: {
    path: path.join(__dirname, './migrations'),
    glob: '*.{ts,js}',
    disableForeignKeys: false,
  },
  allowGlobalContext: true,
  entities: [Post, User],
  dbName: 'reppit',
  user: 'myuser',
  password: '',
  type: 'postgresql',
  debug: !__prod__,
  driver: PostgreSqlDriver,
} as Parameters<typeof MikroORM.init>[0];
