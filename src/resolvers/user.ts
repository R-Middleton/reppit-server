import { User } from '../entities/User';
import { MyContext } from '../types';
import {
  Arg,
  Ctx,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from 'type-graphql';
import argon2 from 'argon2';
import { COOKIENAME, FORGET_PASSWORD_PREFIX } from '../constants';
import { UsernamePasswordInput } from './UsernamePasswordInput';
import { validateRegsiter } from '../util/validateRegister';
import { sendEmail } from '../util/sendEmail';
import { v4 } from 'uuid';

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true }) errors?: FieldError[];

  @Field(() => User, { nullable: true }) user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { req, em }: MyContext) {
    // you are not logged in
    if (!req.session!.userId) {
      return null;
    }
    const user = await em.findOne(User, { _id: req.session!.userId });
    return user;
  }

  @Mutation(() => UserResponse)
  async ChangePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx()
    { redis, em, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 3) {
      return {
        errors: [
          {
            field: 'newPassword',
            message: 'password must be longer than 3 characters',
          },
        ],
      };
    }

    const userId = await redis.get(FORGET_PASSWORD_PREFIX + token);
    if (!userId) {
      return {
        errors: [
          {
            field: 'token',
            message: 'token expired',
          },
        ],
      };
    }

    const user = await em.findOne(User, { _id: parseInt(userId) });
    if (!user) {
      return {
        errors: [
          {
            field: 'token',
            message: 'user no longer exists',
          },
        ],
      };
    }

    user.password = await argon2.hash(newPassword);
    await em.persistAndFlush(user);

    //log user in after resetting password
    req.session.userId = user._id;
    return { user };
  }

  @Mutation(() => Boolean)
  async ForgotPassword(
    @Arg('email') email: string,
    @Ctx() { em, redis }: MyContext
  ) {
    const user = await em.findOne(User, { email });
    if (!user) {
      // the email isnt in the db
      return true;
    }

    const token = v4();
    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user._id,
      'EX',
      1000 * 60 * 60
    );

    sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    );
    return true;
  }

  @Mutation(() => UserResponse)
  async Register(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegsiter(options);
    if (errors) {
      return { errors };
    }
    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
      email: options.email,
    });
    try {
      await em.persistAndFlush(user);
    } catch (err) {
      // duplicate username or email error
      if (err.code === '23505' || err.detail.includes('already exists')) {
        if (err.constraint.includes('username')) {
          return {
            errors: [{ field: 'username', message: 'username already exists' }],
          };
        }
        if (err.constraint.includes('email')) {
          return {
            errors: [{ field: 'email', message: 'email already exists' }],
          };
        }
      }
    }

    req.session!.userId = user._id;

    return {
      user,
    };
  }

  @Mutation(() => UserResponse)
  async Login(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(
      User,
      !usernameOrEmail.includes('@')
        ? { username: usernameOrEmail }
        : { email: usernameOrEmail }
    );
    if (!user) {
      return {
        errors: [
          {
            field: 'usernameOrEmail',
            message: 'that username does not exist',
          },
        ],
      };
    }
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: 'password',
            message: 'incorrect password',
          },
        ],
      };
    }

    // Store user ID session
    // This will set a cookie on the user
    // and keep them logged in
    req.session!.userId = user._id;

    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  async Logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session!.destroy((err) => {
        res.clearCookie(COOKIENAME);
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        resolve(true);
      })
    );
  }
}
