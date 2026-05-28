import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
	let supabaseResponse = NextResponse.next({ request });

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
					cookiesToSet.forEach(({ name, value }) =>
						request.cookies.set(name, value),
					);
					supabaseResponse = NextResponse.next({ request });
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options),
					);
				},
			},
		},
	);

	const {
		data: { user },
	} = await supabase.auth.getUser();
	const { pathname } = request.nextUrl;

	const publicPaths = ['/login', '/auth/callback', '/select-dept'];
	const isPublic = publicPaths.some((p) => pathname.startsWith(p));

	if (!user && !isPublic) {
		return NextResponse.redirect(new URL('/login', request.url));
	}

	if (user && pathname === '/login') {
		return NextResponse.redirect(new URL('/home', request.url));
	}

	// /home 진입 시 선생님이면 /admin으로 이동 (단, ?mode=student면 통과)
	if (user && pathname === '/home') {
		const isStudentMode =
			request.nextUrl.searchParams.get('mode') === 'student';
		if (!isStudentMode) {
			const { data: teacher } = await supabase
				.from('teachers')
				.select('id')
				.eq('user_id', user.id)
				.single();

			if (teacher) {
				return NextResponse.redirect(new URL('/admin', request.url));
			}
		}
	}

	if (pathname.startsWith('/admin')) {
		const { data: teacher } = await supabase
			.from('teachers')
			.select('id')
			.eq('user_id', user?.id)
			.single();

		if (!teacher) {
			return NextResponse.redirect(new URL('/home', request.url));
		}
	}

	return supabaseResponse;
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|images).*)'],
};
