import Link from 'next/link';
import { Button } from '@restaurant/ui';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-2xl font-bold">Restaurant Operations</h1>
      <p className="mb-6 text-gray-600">POS · KDS · Admin console</p>
      <nav className="flex flex-col gap-3">
        <Link href="/onboarding">
          <Button className="w-full">Create restaurant (onboarding)</Button>
        </Link>
        <Link href="/locations">
          <Button variant="outline" className="w-full">
            Manage locations
          </Button>
        </Link>
        <Link href="/branding">
          <Button variant="outline" className="w-full">
            Branding settings
          </Button>
        </Link>
      </nav>
    </main>
  );
}
