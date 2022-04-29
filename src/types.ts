import { EntityManager, IDatabaseDriver, Connection } from '@mikro-orm/core';
import Redis from 'ioredis';
import { Request, Response } from 'express';

export type MyContext = {
  em: EntityManager<IDatabaseDriver<Connection>>;
  req: Request;
  redis: Redis;
  res: Response;
};
