import { UsernamePasswordInput } from 'src/resolvers/UsernamePasswordInput';

export const validateRegsiter = (options: UsernamePasswordInput) => {
  if (options.username.length <= 2) {
    return [
      {
        field: 'username',
        message: 'username must be longer than 2 characters',
      },
    ];
  }

  if (options.username.includes('@')) {
    return [
      {
        field: 'username',
        message: 'invalid username',
      },
    ];
  }

  if (options.password.length <= 3) {
    return [
      {
        field: 'password',
        message: 'password must be longer than 3 characters',
      },
    ];
  }

  if (!options.email.includes('@')) {
    return [
      {
        field: 'email',
        message: 'invalid email',
      },
    ];
  }

  return null;
};
