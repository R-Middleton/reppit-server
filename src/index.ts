import 'reflect-metadata';
import { COOKIENAME, __prod__ } from './constants';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';
import session from 'express-session';
import Redis from 'ioredis';
import connectRedis from 'connect-redis';
import { MyContext } from './types';
import cors from 'cors';
import { DataSource } from 'typeorm';
import { Post } from './entities/Post';
import { User } from './entities/User';

declare module 'express-session' {
  interface Session {
    userId: number;
  }
}

const main = async () => {
  const dataSource = new DataSource({
    type: 'postgres',
    database: 'reppit',
    username: 'myuser',
    password: '',
    logging: true,
    synchronize: true,
    entities: [Post, User],
  });
  await dataSource.initialize();
  const app = express();

  app.use(
    cors({
      origin: ['http://localhost:3000', 'https://studio.apollographql.com'],
      credentials: true,
    })
  );

  const RedisStore = connectRedis(session);
  const redis = new Redis();

  app.use(
    session({
      name: COOKIENAME,
      store: new RedisStore({
        client: redis as any,
        disableTouch: false,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true,
        secure: __prod__, // cookie only works in https
        sameSite: 'lax', //csrf
      },
      saveUninitialized: false,
      secret: 'keyboard cat',
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ req, res, redis }),
  });

  apolloServer.start().then(() => {
    apolloServer.applyMiddleware({ app, cors: false });
    app.listen(4000, () => {
      console.log('Server started on localhost:4000');
    });
  });
};

main().catch((err) => {
  console.log(err);
});
