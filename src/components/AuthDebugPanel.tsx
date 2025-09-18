import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, User, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const AuthDebugPanel: React.FC = () => {
  const { user, session, loading, refreshUserSession } = useAuth();

  if (!user && !loading) {
    return (
      <Card className="border-destructive">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Authentication Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            You need to be logged in to view evidence. Please refresh your session or log in.
          </p>
          <Button onClick={refreshUserSession} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Session
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-green-700">
          <User className="w-4 h-4" />
          Authentication Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">User ID</Badge>
            <span className="text-sm font-mono">{user?.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Email</Badge>
            <span className="text-sm">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Session</Badge>
            <Badge variant={session ? "default" : "destructive"}>
              {session ? "Active" : "None"}
            </Badge>
          </div>
          <Button onClick={refreshUserSession} variant="outline" size="sm" className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};