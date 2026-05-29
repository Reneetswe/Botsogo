import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/patient/dashboard') && !data.user) {
    const url = request.nextUrl.clone();
    url.pathname = '/patient/login';
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/staff/dashboard') && !request.cookies.get('botsogo_staff')?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/staff/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/patient/dashboard/:path*', '/staff/dashboard/:path*'],
};
