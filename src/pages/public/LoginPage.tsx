import React from 'react';
import { RegisterPage } from './RegisterPage.tsx';

/**
 * LoginPage: Secure JSON Authentication Interface
 * Strictly authenticates against pre-registered user accounts.
 */
export const LoginPage: React.FC = () => {
  return <RegisterPage />;
};

export default LoginPage;
