export default function PageTemplate({ title = "Page Title", description = "" }: { title?: string; description?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {description && <p className="text-gray-600 dark:text-gray-400 mt-2">{description}</p>}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-600 dark:text-gray-400">Content coming soon...</p>
      </div>
    </div>
  );
}
