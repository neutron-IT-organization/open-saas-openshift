import { Redirect, Link } from 'react-router-dom';
import { LoginForm, useAuth } from 'wasp/client/auth';
import { AuthPageLayout } from './AuthPageLayout';
export default function Login() {
    const { data: user } = useAuth();
    if (user) {
        return <Redirect to='/demo-app'/>;
    }
    return (<AuthPageLayout>
      <LoginForm />
      <br />
      <span className='text-sm font-medium text-gray-900 dark:text-gray-900'>
        Don't have an account yet?{' '}
        <Link to='/signup' className='underline'>
          go to signup
        </Link>
        .
      </span>
      <br />
      <span className='text-sm font-medium text-gray-900'>
        Forgot your password?{' '}
        <Link to='/request-password-reset' className='underline'>
          reset it
        </Link>
        .
      </span>
    </AuthPageLayout>);
}
//# sourceMappingURL=LoginPage.jsx.map