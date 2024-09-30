import { LoginForm } from 'wasp/client/auth';
export function Login() {
    return (<Layout>
      <LoginForm />
    </Layout>);
}
// A layout component to center the content
export function Layout({ children }) {
    return (<div className="w-full h-full bg-white">
      <div className="min-w-full min-h-[75vh] flex items-center justify-center">
        <div className="w-full h-full max-w-sm p-5 bg-white">
          <div>{children}</div>
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=auth.jsx.map