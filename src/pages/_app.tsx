import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { AuthProvider } from '../contexts/AuthContext';
import Layout from '../components/Layout';

import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Don't show layout on login or logout pages
  const isNoLayoutPage = ['/login', '/logout'].includes(router.pathname);

  return (
    <AuthProvider>
      {isNoLayoutPage ? (
        <Component {...pageProps} />
      ) : (
        <Layout>
          <Component {...pageProps} />
        </Layout>
      )}
    </AuthProvider>
  );
}
