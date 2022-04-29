import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { COOKIENAME, __prod__ } from './constants';
import microConfig from './mikro-orm.config';
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

declare module 'express-session' {
  interface Session {
    userId: number;
  }
}

const main = async () => {
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up();

  const app = express();

  const RedisStore = connectRedis(session);
  const redis = new Redis();

  app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

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
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res, redis }),
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
