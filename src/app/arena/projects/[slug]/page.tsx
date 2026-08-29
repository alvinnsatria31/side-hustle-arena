import { notFound } from 'next/navigation';
import { ProjectDetailClient } from './ProjectDetailClient';
import { mockWeeklyProjects } from '@/data/mock/projects';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = mockWeeklyProjects.find((p) => p.slug === slug);
  if (!project) {
    notFound();
  }
  return <ProjectDetailClient slug={slug} />;
}
