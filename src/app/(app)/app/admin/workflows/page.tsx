import { redirect } from 'next/navigation';

/**
 * Trigger Workflow was its own menu entry beside Otomasi, and the two ran the
 * same errand: make something happen now. Splitting them forced an operator to
 * guess which one they wanted, so the form moved into `/app/admin/jobs`.
 *
 * The route stays as a redirect because it is linked from documentation and
 * from operators' bookmarks — deleting it would turn those into 404s for no
 * gain.
 */
export default function AdminWorkflowsPage() {
  redirect('/app/admin/jobs');
}
