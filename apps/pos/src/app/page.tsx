import { appConfig } from '@restaurant/config';
import { Button } from '@restaurant/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Restaurant Operations</h1>
      <p className="text-gray-600">POS · KDS · Admin console</p>
      <p className="text-sm text-gray-400">API: {appConfig.apiUrl}</p>
      <Button variant="outline">Open register</Button>
    </main>
  );
}
