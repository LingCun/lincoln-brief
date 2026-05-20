import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { isLocked } from '../../../lib/gating';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return new Response(JSON.stringify({ error: 'missing_slug' }), { status: 400 });
  }

  const posts = await getCollection('blog');
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  }

  if (isLocked(post) && !locals.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const { Content } = await post.render();
  const container = await AstroContainer.create();
  const html = await container.renderToString(Content);

  return new Response(JSON.stringify({ html }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
