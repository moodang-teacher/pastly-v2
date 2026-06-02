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
		(user && pathname.startsWith('/admin')) ||
		(user && pathname.startsWith('/master'));

	if (needsRoleCheck) {
		let role: 'student' | 'teacher' | 'master' = 'student';
		const cached = request.cookies.get(ROLE_COOKIE)?.value;
		let cacheHit = false;

		if (cached) {
			const [cachedUserId, cachedRole] = cached.split(':');
			if (cachedUserId === user!.id) {
				role = cachedRole as typeof role;
				cacheHit = true;
			}
		}

		if (!cacheHit) {
			const { data: teacher } = await supabase
				.from('teachers')
				.select('id, is_master')
				.eq('user_id', user!.id)
				.single();

			if (teacher?.is_master) role = 'master';
			else if (teacher) role = 'teacher';

			supabaseResponse.cookies.set(
				ROLE_COOKIE,
				`${user!.id}:${role}`,
				{
					httpOnly: true,
					sameSite: 'lax',
					maxAge: ROLE_MAX_AGE,
					path: '/',
				},
			);
		}

		const isMaster = role === 'master';
		const isTeacher = role === 'teacher';

		if (pathname === '/home' && isMaster) {
			return NextResponse.redirect(new URL('/master', request.url));
		}
		if (pathname === '/home' && isTeacher) {
			return NextResponse.redirect(new URL('/admin', request.url));
		}
		if (pathname.startsWith('/admin') && !isTeacher) {
			return NextResponse.redirect(new URL('/home', request.url));
		}
		if (pathname.startsWith('/master') && !isMaster) {
			return NextResponse.redirect(new URL('/home', request.url));
		}
	}

	return supabaseResponse;
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|images).*)'],
};
