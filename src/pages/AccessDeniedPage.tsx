import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your role{user?.role ? ` (${user.role})` : ''} does not have permission to view this page.
        Contact your administrator if you believe this is a mistake.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
        <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </div>
    </div>
  );
}
