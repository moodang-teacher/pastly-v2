import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ROLE_COOKIE = 'pastly-role';
const ROLE_MAX_AGE = 60 * 60 * 24; // 24시간

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
		const res = NextResponse.redirect(new URL('/login', request.url));
		res.cookies.delete(ROLE_COOKIE);
		return res;
	}

	if (!user && pathname === '/login') {
		const res = NextResponse.next({ request });
		res.cookies.delete(ROLE_COOKIE);
		return res;
	}

	if (user && pathname === '/login') {
		const res = NextResponse.redirect(new URL('/home', request.url));
		res.cookies.delete(ROLE_COOKIE);
		return res;
	}

	// 역할 확인 (캐시 → DB 순서)
	const needsRoleCheck =
		(user && pathname === '/home' && !request.nextUrl.searchParams.get('mode')) ||
		(user && pathname.startsWith('/admin'));

	if (needsRoleCheck) {
		let isTeacher = false;
		const cached = request.cookies.get(ROLE_COOKIE)?.value;
		let cacheHit = false;

		if (cached) {
			const [cachedUserId, cachedRole] = cached.split(':');
			if (cachedUserId === user!.id) {
				isTeacher = cachedRole === 'teacher';
				cacheHit = true;
			}
			// 다른 user의 캐시이면 무시하고 DB 조회
		}

		if (!cacheHit) {
			const { data: teacher } = await supabase
				.from('teachers')
				.select('id')
				.eq('user_id', user!.id)
				.single();
			isTeacher = !!teacher;

			supabaseResponse.cookies.set(
				ROLE_COOKIE,
				`${user!.id}:${isTeacher ? 'teacher' : 'student'}`,
				{
					httpOnly: true,
					sameSite: 'lax',
					maxAge: ROLE_MAX_AGE,
					path: '/',
				},
			);
		}

		if (pathname === '/home' && isTeacher) {
			return NextResponse.redirect(new URL('/admin', request.url));
		}
		if (pathname.startsWith('/admin') && !isTeacher) {
			return NextResponse.redirect(new URL('/home', request.url));
		}
	}

	return supabaseResponse;
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|images).*)'],
};
