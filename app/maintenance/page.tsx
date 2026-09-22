// app/maintenance/page.tsx
export default function MaintenancePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gray-50">
      <div className="max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          🚧 Maintenance Mode
        </h1>
        <p className="text-lg font-bold text-gray-600">
          NOT ACCESSIBLE AT THE MOMENT!
        </p>
      </div>
    </main>
  );
}
